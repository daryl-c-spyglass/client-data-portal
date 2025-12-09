import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createMLSGridClient } from "./mlsgrid-client";
import { triggerManualSync } from "./mlsgrid-sync";
import { getHomeReviewClient, mapHomeReviewPropertyToSchema, type PropertySearchParams } from "./homereview-client";
import { initRepliersClient, getRepliersClient, isRepliersConfigured } from "./repliers-client";
import { geocodeAddress, geocodeProperties, isMapboxConfigured } from "./mapbox-geocoding";
import { searchCriteriaSchema, insertCmaSchema, insertUserSchema, insertSellerUpdateSchema, updateSellerUpdateSchema, updateLeadGateSettingsSchema } from "@shared/schema";
import { findMatchingProperties, calculateMarketSummary } from "./seller-update-service";
import { z } from "zod";
import bcrypt from "bcryptjs";
import passport from "passport";
import { requireAuth, requireRole } from "./auth";
import { fetchExternalUsers, fetchFromExternalApi } from "./external-api";

export async function registerRoutes(app: Express): Promise<Server> {
  const mlsGridClient = createMLSGridClient();
  const repliersClient = initRepliersClient();

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      // Rename passwordHash field to password for client-facing API
      const { passwordHash, ...rest } = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(rest.email);
      if (existingUser) {
        res.status(400).json({ error: "Email already in use" });
        return;
      }

      const hashedPassword = await bcrypt.hash(passwordHash, 10);
      const user = await storage.createUser({ ...rest, passwordHash: hashedPassword });
      
      // SECURITY: Never return password hash to client
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to register user" });
      }
    }
  });

  app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
    // req.user is already sanitized by passport.deserializeUser
    res.json(req.user);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    // req.user is already sanitized by passport.deserializeUser
    res.json(req.user);
  });

  // External API integration routes
  app.get("/api/external/users", async (req, res) => {
    try {
      const result = await fetchExternalUsers();
      
      if (!result.success) {
        res.status(500).json({ error: result.error || 'Failed to fetch external users' });
        return;
      }
      
      res.json(result.data);
    } catch (error) {
      console.error('Error in /api/external/users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Lead Gate Settings routes (admin only)
  app.get("/api/lead-gate/settings", async (req, res) => {
    try {
      let settings = await storage.getLeadGateSettings();
      
      // If no settings exist, return defaults
      if (!settings) {
        settings = {
          id: '',
          enabled: false,
          freeViewsAllowed: 3,
          countPropertyDetails: true,
          countListViews: false,
          updatedAt: new Date(),
        };
      }
      
      res.json(settings);
    } catch (error) {
      console.error('Error fetching lead gate settings:', error);
      res.status(500).json({ error: 'Failed to fetch lead gate settings' });
    }
  });

  app.put("/api/lead-gate/settings", requireAuth, async (req, res) => {
    try {
      const settings = updateLeadGateSettingsSchema.parse(req.body);
      const updated = await storage.updateLeadGateSettings(settings);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid settings data", details: error.errors });
      } else {
        console.error('Error updating lead gate settings:', error);
        res.status(500).json({ error: 'Failed to update lead gate settings' });
      }
    }
  });

  // Public endpoint to track property views (uses cookies to track anonymous users)
  app.post("/api/lead-gate/track-view", async (req, res) => {
    try {
      const settings = await storage.getLeadGateSettings();
      
      // If lead gate is disabled, just acknowledge and return
      if (!settings?.enabled) {
        res.json({ allowed: true, viewsRemaining: null, gateEnabled: false });
        return;
      }

      // Get current view count from cookie
      const viewCookie = req.cookies?.propertyViews;
      let currentViews = 0;
      
      if (viewCookie) {
        try {
          currentViews = parseInt(viewCookie, 10);
        } catch {
          currentViews = 0;
        }
      }

      // Increment view count
      const newViewCount = currentViews + 1;
      
      // Set cookie with new view count (expires in 30 days)
      res.cookie('propertyViews', newViewCount.toString(), {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      const viewsRemaining = Math.max(0, settings.freeViewsAllowed - newViewCount);
      const allowed = newViewCount <= settings.freeViewsAllowed;

      res.json({
        allowed,
        viewsRemaining,
        gateEnabled: true,
        currentViews: newViewCount,
        maxViews: settings.freeViewsAllowed,
      });
    } catch (error) {
      console.error('Error tracking property view:', error);
      res.status(500).json({ error: 'Failed to track property view' });
    }
  });

  // Check current view status without incrementing
  app.get("/api/lead-gate/status", async (req, res) => {
    try {
      const settings = await storage.getLeadGateSettings();
      
      if (!settings?.enabled) {
        res.json({ gateEnabled: false, allowed: true });
        return;
      }

      const viewCookie = req.cookies?.propertyViews;
      let currentViews = 0;
      
      if (viewCookie) {
        try {
          currentViews = parseInt(viewCookie, 10);
        } catch {
          currentViews = 0;
        }
      }

      const viewsRemaining = Math.max(0, settings.freeViewsAllowed - currentViews);
      const allowed = currentViews < settings.freeViewsAllowed;

      res.json({
        gateEnabled: true,
        allowed,
        viewsRemaining,
        currentViews,
        maxViews: settings.freeViewsAllowed,
      });
    } catch (error) {
      console.error('Error checking lead gate status:', error);
      res.status(500).json({ error: 'Failed to check lead gate status' });
    }
  });

  // Unified Property Search API
  // Routes to Repliers for active listings, HomeReview for closed/sold
  app.get("/api/search", async (req, res) => {
    try {
      const {
        status = 'active',
        postalCode,
        subdivision,
        city,
        minPrice,
        maxPrice,
        bedsMin,
        bathsMin,
        limit = '50',
      } = req.query as Record<string, string | undefined>;

      const parsedLimit = Math.min(parseInt(limit || '50', 10), 200);

      // Normalize results to consistent format
      interface NormalizedProperty {
        id: string;
        address: string;
        city: string;
        state: string;
        postalCode: string;
        listPrice: number;
        closePrice: number | null;
        status: string;
        beds: number | null;
        baths: number | null;
        livingArea: number | null;
        yearBuilt: number | null;
        latitude: number | null;
        longitude: number | null;
        photos: string[];
        subdivision: string | null;
        daysOnMarket: number | null;
      }

      let results: NormalizedProperty[] = [];

      if (status === 'active' || status === 'under_contract') {
        // Use Repliers API for active listings
        if (!isRepliersConfigured()) {
          res.status(503).json({ error: 'Repliers API not configured' });
          return;
        }

        const repliersClient = getRepliersClient();
        if (!repliersClient) {
          res.status(503).json({ error: 'Repliers client not available' });
          return;
        }

        const repliersStatus = status === 'active' ? 'A' : 'U';
        const response = await repliersClient.searchListings({
          status: repliersStatus,
          postalCode: postalCode,
          city: city,
          minPrice: minPrice ? parseInt(minPrice, 10) : undefined,
          maxPrice: maxPrice ? parseInt(maxPrice, 10) : undefined,
          minBeds: bedsMin ? parseInt(bedsMin, 10) : undefined,
          minBaths: bathsMin ? parseInt(bathsMin, 10) : undefined,
          resultsPerPage: parsedLimit,
        });

        results = (response.listings || []).map((listing: any) => {
          const addr = listing.address || {};
          const details = listing.details || {};
          const map = listing.map || {};

          const fullAddress = [
            addr.streetNumber,
            addr.streetName,
            addr.streetSuffix,
            addr.unitNumber ? `#${addr.unitNumber}` : null,
          ].filter(Boolean).join(' ');

          // Map Repliers status codes to MLS-standard values
          const statusMap: Record<string, string> = {
            'A': 'Active',
            'U': 'Active Under Contract',
            'S': 'Closed',
            'P': 'Pending',
          };
          const mappedStatus = statusMap[listing.status] || listing.status || 'Active';

          // Helper to get numeric value
          const toNumber = (val: any): number | null => {
            if (val == null) return null;
            const num = Number(val);
            return isNaN(num) ? null : num;
          };

          // Get the first bath value if it's an array
          const bathsRaw = details.bathrooms ?? listing.bathroomsTotalInteger;
          const baths = Array.isArray(bathsRaw) ? toNumber(bathsRaw[0]) : toNumber(bathsRaw);

          return {
            id: listing.mlsNumber || listing.listingId,
            address: fullAddress || listing.unparsedAddress || 'Unknown Address',
            city: addr.city || listing.city || '',
            state: addr.state || listing.stateOrProvince || 'TX',
            postalCode: addr.zip || listing.postalCode || '',
            listPrice: toNumber(listing.listPrice) || 0,
            closePrice: toNumber(listing.soldPrice) || null,
            status: mappedStatus,
            beds: toNumber(details.bedrooms ?? listing.bedroomsTotal),
            baths: baths,
            livingArea: toNumber(details.sqft || listing.livingArea),
            yearBuilt: toNumber(details.yearBuilt || listing.yearBuilt),
            latitude: toNumber(map.latitude ?? listing.latitude),
            longitude: toNumber(map.longitude ?? listing.longitude),
            photos: listing.photos || [],
            subdivision: addr.neighborhood || listing.subdivisionName || null,
            daysOnMarket: toNumber(listing.daysOnMarket),
            cumulativeDaysOnMarket: toNumber(listing.cumulativeDaysOnMarket) || toNumber(listing.daysOnMarket),
            lotSizeSquareFeet: toNumber(details.lotSize || listing.lotSizeSquareFeet),
            lotSizeAcres: toNumber(listing.lotSizeAcres),
            garageSpaces: toNumber(details.garage || listing.garageSpaces),
            closeDate: listing.soldDate || listing.closeDate || null,
          };
        });

        // Server-side subdivision filter (Repliers doesn't support subdivision param directly)
        if (subdivision) {
          const subdivisionLower = subdivision.toLowerCase();
          results = results.filter(p => 
            p.subdivision?.toLowerCase().includes(subdivisionLower)
          );
        }

      } else if (status === 'closed' || status === 'sold') {
        // Note: Repliers API only supports status 'A' (Active) and 'U' (Under Contract)
        // Repliers does NOT support status 'S' (Sold) - it returns a 400 error
        // Therefore, closed/sold listings must come from the local PostgreSQL database
        // which contains historical MLS Grid data
        console.log('📦 Using local database for closed/sold listings (Repliers does not support sold status)...');
        
        const dbResults = await storage.getProperties({
          status: ['Closed'],
          zipCodes: postalCode ? [postalCode] : undefined,
          subdivisions: subdivision ? [subdivision] : undefined,
          cities: city ? [city] : undefined,
          listPriceMin: minPrice ? parseInt(minPrice, 10) : undefined,
          listPriceMax: maxPrice ? parseInt(maxPrice, 10) : undefined,
          bedroomsMin: bedsMin ? parseInt(bedsMin, 10) : undefined,
          fullBathsMin: bathsMin ? parseInt(bathsMin, 10) : undefined,
        }, parsedLimit, 0);

        // Helper to get numeric value
        const toNum = (val: any): number | null => {
          if (val == null) return null;
          const num = Number(val);
          return isNaN(num) ? null : num;
        };

        results = dbResults.map((p: any) => ({
          id: p.listingId || p.id,
          address: p.unparsedAddress || [p.streetNumber, p.streetName, p.streetSuffix].filter(Boolean).join(' '),
          city: p.city || '',
          state: p.stateOrProvince || 'TX',
          postalCode: p.postalCode || '',
          listPrice: toNum(p.listPrice) || 0,
          closePrice: toNum(p.closePrice) || null,
          status: 'Closed',
          beds: toNum(p.bedroomsTotal),
          baths: toNum(p.bathroomsTotalInteger),
          livingArea: toNum(p.livingArea),
          yearBuilt: toNum(p.yearBuilt),
          latitude: toNum(p.latitude),
          longitude: toNum(p.longitude),
          photos: p.photos || [],
          subdivision: p.subdivisionName || null,
          daysOnMarket: toNum(p.daysOnMarket),
          cumulativeDaysOnMarket: toNum(p.cumulativeDaysOnMarket) || toNum(p.daysOnMarket),
          lotSizeSquareFeet: toNum(p.lotSizeSquareFeet),
          lotSizeAcres: toNum(p.lotSizeAcres),
          garageSpaces: toNum(p.garageSpaces),
          closeDate: p.closeDate || null,
        }));
        
        console.log(`📦 Database returned ${results.length} closed/sold listings`);

      } else {
        res.status(400).json({ error: 'Invalid status. Use: active, under_contract, closed, or sold' });
        return;
      }

      res.json({
        properties: results,
        count: results.length,
        status: status,
      });
    } catch (error) {
      console.error('Unified search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Property routes
  app.get("/api/properties/search", async (req, res) => {
    try {
      // Pre-transform array.values/array.mode query params to arrays
      const transformedQuery: any = { ...req.query };
      
      // DEBUG: Log the raw query to see what's coming in
      console.log('🔍 Raw query:', JSON.stringify(req.query, null, 2));
      
      // Transform all .values array parameters to their canonical array names
      const arrayFieldMappings: Record<string, string> = {
        'subdivision.values': 'subdivisions',
        'zipCodes.values': 'zipCodes',
        'cities.values': 'cities',
        'countyOrParish.values': 'countyOrParish',
        'elementarySchools.values': 'elementarySchools',
        'middleSchools.values': 'middleSchools',
        'highSchools.values': 'highSchools',
        'schoolDistrict.values': 'schoolDistrict',
      };
      
      for (const [queryParam, canonicalName] of Object.entries(arrayFieldMappings)) {
        if (transformedQuery[queryParam]) {
          transformedQuery[canonicalName] = Array.isArray(transformedQuery[queryParam])
            ? transformedQuery[queryParam]
            : [transformedQuery[queryParam]];
          delete transformedQuery[queryParam];
          delete transformedQuery[queryParam.replace('.values', '.mode')];
        }
      }
      
      // Parse and coerce query params to proper types
      const rawCriteria = searchCriteriaSchema.parse(transformedQuery);
      
      // DEBUG: Log the parsed criteria
      console.log('✅ Parsed criteria.zipCodes:', rawCriteria.zipCodes);
      
      // Transform dot-notation fields into nested objects
      const criteria: any = { ...rawCriteria };
      
      // Handle yearBuilt range
      if (criteria['yearBuilt.min'] || criteria['yearBuilt.max']) {
        criteria.yearBuilt = {
          min: criteria['yearBuilt.min'],
          max: criteria['yearBuilt.max'],
        };
        delete criteria['yearBuilt.min'];
        delete criteria['yearBuilt.max'];
      }
      
      // Handle livingArea range
      if (criteria['livingArea.min'] || criteria['livingArea.max']) {
        criteria.livingArea = {
          min: criteria['livingArea.min'],
          max: criteria['livingArea.max'],
        };
        delete criteria['livingArea.min'];
        delete criteria['livingArea.max'];
      }
      
      // Handle lotSizeSquareFeet range
      if (criteria['lotSizeSquareFeet.min'] || criteria['lotSizeSquareFeet.max']) {
        criteria.lotSizeSquareFeet = {
          min: criteria['lotSizeSquareFeet.min'],
          max: criteria['lotSizeSquareFeet.max'],
        };
        delete criteria['lotSizeSquareFeet.min'];
        delete criteria['lotSizeSquareFeet.max'];
      }
      
      // Handle lotSizeAcres range
      if (criteria['lotSizeAcres.min'] || criteria['lotSizeAcres.max']) {
        criteria.lotSizeAcres = {
          min: criteria['lotSizeAcres.min'],
          max: criteria['lotSizeAcres.max'],
        };
        delete criteria['lotSizeAcres.min'];
        delete criteria['lotSizeAcres.max'];
      }
      
      // Limit to 50 properties by default to prevent OOM errors
      // Supports optional limit and offset query parameters for pagination
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Pass limit and offset to storage layer for database-level pagination
      const paginatedProperties = await storage.getProperties(criteria, limit, offset);
      
      res.json(paginatedProperties);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Search validation error:", error.errors);
        res.status(400).json({ error: "Invalid search criteria", details: error.errors });
      } else {
        console.error("Search error:", error);
        res.status(500).json({ error: "Failed to search properties" });
      }
    }
  });

  app.get("/api/properties/count", async (req, res) => {
    try {
      const count = await storage.getPropertyCount();
      res.json({ count });
    } catch (error) {
      console.error("Failed to fetch property count:", error);
      res.status(500).json({ error: "Failed to fetch property count" });
    }
  });

  app.get("/api/properties/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { source } = req.query;
      
      // If source=repliers, try Repliers API first (for active listings)
      if (source === 'repliers' && isRepliersConfigured()) {
        const repliersClient = getRepliersClient();
        if (repliersClient) {
          const listing = await repliersClient.getListing(id);
          if (listing) {
            // Normalize Repliers listing to standard format
            const addr = listing.address || {};
            const details = listing.details || {};
            const map = listing.map || {};
            
            const fullAddress = [
              addr.streetNumber,
              addr.streetName,
              addr.streetSuffix,
              addr.unitNumber ? `#${addr.unitNumber}` : null,
            ].filter(Boolean).join(' ');

            const normalizedProperty = {
              id: listing.mlsNumber,
              listingId: listing.mlsNumber,
              listingKey: listing.mlsNumber,
              standardStatus: listing.status === 'A' ? 'Active' : listing.status === 'U' ? 'Under Contract' : listing.status,
              listPrice: String(listing.listPrice || 0),
              closePrice: listing.soldPrice ? String(listing.soldPrice) : null,
              originalListPrice: listing.originalPrice ? String(listing.originalPrice) : null,
              propertyType: details.propertyType || 'Residential',
              city: addr.city || '',
              stateOrProvince: addr.state || 'TX',
              postalCode: addr.zip || '',
              subdivisionName: addr.neighborhood || null,
              unparsedAddress: fullAddress || 'Unknown Address',
              latitude: map.latitude ? String(map.latitude) : null,
              longitude: map.longitude ? String(map.longitude) : null,
              bedroomsTotal: details.bedrooms ?? null,
              bathroomsTotalInteger: details.bathrooms ?? null,
              livingArea: details.sqft ? String(details.sqft) : null,
              lotSizeSquareFeet: details.lotSize ? String(details.lotSize) : null,
              yearBuilt: details.yearBuilt ?? null,
              garageSpaces: details.garage ?? null,
              photos: listing.photos || [],
              photosCount: listing.photos?.length || 0,
              publicRemarks: details.description || null,
              daysOnMarket: listing.daysOnMarket ?? null,
              listAgentFullName: listing.agent?.name || null,
              listAgentEmail: listing.agent?.email || null,
              listAgentDirectPhone: listing.agent?.phone || null,
              listOfficeName: listing.office?.name || null,
              listDate: listing.listDate || null,
              soldDate: listing.soldDate || null,
              modificationTimestamp: new Date().toISOString(),
              originatingSystemName: 'Repliers',
            };
            
            res.json(normalizedProperty);
            return;
          }
        }
      }
      
      // Default: try local database
      const property = await storage.getProperty(id);
      if (property) {
        res.json(property);
        return;
      }
      
      // Also try by listing ID if direct ID lookup fails
      const propertyByListingId = await storage.getPropertyByListingId(id);
      if (propertyByListingId) {
        res.json(propertyByListingId);
        return;
      }
      
      res.status(404).json({ error: "Property not found" });
    } catch (error) {
      console.error('Error fetching property:', error);
      res.status(500).json({ error: "Failed to fetch property" });
    }
  });

  app.get("/api/properties", async (req, res) => {
    try {
      // Limit to 1000 properties by default to prevent OOM
      // Frontend uses search endpoint for filtered/criteria-based queries
      const limit = parseInt(req.query.limit as string) || 1000;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const allProperties = await storage.getAllProperties();
      const paginatedProperties = allProperties.slice(offset, offset + limit);
      
      res.json(paginatedProperties);
    } catch (error) {
      console.error("Failed to fetch properties:", error);
      res.status(500).json({ error: "Failed to fetch properties" });
    }
  });

  // Media routes
  app.get("/api/media/:id", async (req, res) => {
    try {
      const media = await storage.getMedia(req.params.id);
      if (!media) {
        res.status(404).json({ error: "Media not found" });
        return;
      }
      res.json(media);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch media" });
    }
  });

  app.get("/api/media/property/:listingId", async (req, res) => {
    try {
      const media = await storage.getMediaByResourceKey(req.params.listingId);
      res.json(media);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch media" });
    }
  });

  // Saved search routes
  app.get("/api/searches", async (req, res) => {
    try {
      const searches = await storage.getAllSavedSearches();
      res.json(searches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch saved searches" });
    }
  });

  app.get("/api/searches/:id", async (req, res) => {
    try {
      const search = await storage.getSavedSearch(req.params.id);
      if (!search) {
        res.status(404).json({ error: "Saved search not found" });
        return;
      }
      res.json(search);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch saved search" });
    }
  });

  app.post("/api/searches", async (req, res) => {
    try {
      const search = await storage.createSavedSearch(req.body);
      res.status(201).json(search);
    } catch (error) {
      res.status(500).json({ error: "Failed to create saved search" });
    }
  });

  app.delete("/api/searches/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSavedSearch(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Saved search not found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete saved search" });
    }
  });

  // CMA routes
  app.get("/api/cmas", async (req, res) => {
    try {
      const cmas = await storage.getAllCmas();
      res.json(cmas);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CMAs" });
    }
  });

  app.get("/api/cmas/:id", async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        res.status(404).json({ error: "CMA not found" });
        return;
      }
      res.json(cma);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CMA" });
    }
  });

  app.post("/api/cmas", async (req, res) => {
    try {
      // Get user ID if authenticated, otherwise leave null
      const user = req.user as any;
      const userId = user?.id || null;
      
      const cmaData = insertCmaSchema.parse({
        ...req.body,
        userId,
      });
      const cma = await storage.createCma(cmaData);
      res.status(201).json(cma);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("CMA validation error:", error.errors);
        res.status(400).json({ error: "Invalid CMA data", details: error.errors });
      } else {
        console.error("CMA creation error:", error);
        res.status(500).json({ error: "Failed to create CMA" });
      }
    }
  });

  app.put("/api/cmas/:id", async (req, res) => {
    try {
      const cma = await storage.updateCma(req.params.id, req.body);
      if (!cma) {
        res.status(404).json({ error: "CMA not found" });
        return;
      }
      res.json(cma);
    } catch (error) {
      res.status(500).json({ error: "Failed to update CMA" });
    }
  });

  app.delete("/api/cmas/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCma(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "CMA not found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete CMA" });
    }
  });

  // CMA Share Link routes
  app.post("/api/cmas/:id/share", async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        res.status(404).json({ error: "CMA not found" });
        return;
      }

      // Ownership check - if CMA has an owner, verify the user owns it
      const user = req.user as any;
      if (cma.userId && cma.userId !== user?.id) {
        res.status(403).json({ error: "Not authorized to share this CMA" });
        return;
      }

      // Always generate a new token (regenerates if one already exists)
      const shareToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await storage.updateCma(req.params.id, {
        publicLink: shareToken,
        expiresAt,
      });

      res.json({
        shareToken,
        shareUrl: `/share/cma/${shareToken}`,
        expiresAt,
      });
    } catch (error) {
      console.error("Error generating share link:", error);
      res.status(500).json({ error: "Failed to generate share link" });
    }
  });

  app.delete("/api/cmas/:id/share", async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        res.status(404).json({ error: "CMA not found" });
        return;
      }

      // Ownership check - if CMA has an owner, verify the user owns it
      const user = req.user as any;
      if (cma.userId && cma.userId !== user?.id) {
        res.status(403).json({ error: "Not authorized to manage this CMA" });
        return;
      }

      await storage.updateCma(req.params.id, {
        publicLink: null,
        expiresAt: null,
      });

      res.json({ message: "Share link removed" });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove share link" });
    }
  });

  // Public CMA access via share token (no auth required, but sanitized response)
  app.get("/api/share/cma/:token", async (req, res) => {
    try {
      const cma = await storage.getCmaByShareToken(req.params.token);
      if (!cma) {
        res.status(404).json({ error: "CMA not found or link expired" });
        return;
      }

      if (cma.expiresAt && new Date(cma.expiresAt) < new Date()) {
        res.status(410).json({ error: "This share link has expired" });
        return;
      }

      const propertyIds = [
        ...(cma.subjectPropertyId ? [cma.subjectPropertyId] : []),
        ...(cma.comparablePropertyIds || [])
      ];

      const properties: any[] = [];
      for (const id of propertyIds) {
        const property = await storage.getProperty(id);
        if (property) {
          properties.push(property);
        }
      }

      const statistics = await storage.calculateStatistics(propertyIds);
      const timelineData = await storage.getTimelineData(propertyIds);

      // SECURITY: Only return public-safe CMA data (exclude internal notes, userId, etc.)
      res.json({
        cma: {
          id: cma.id,
          name: cma.name,
          createdAt: cma.createdAt,
          expiresAt: cma.expiresAt,
        },
        properties,
        statistics,
        timelineData,
      });
    } catch (error) {
      console.error("Error fetching shared CMA:", error);
      res.status(500).json({ error: "Failed to fetch shared CMA" });
    }
  });

  // Seller Update routes - Quick Seller Update feature
  app.get("/api/seller-updates", async (req, res) => {
    try {
      const updates = await storage.getAllSellerUpdates();
      res.json(updates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch seller updates" });
    }
  });

  app.get("/api/seller-updates/:id", async (req, res) => {
    try {
      const update = await storage.getSellerUpdate(req.params.id);
      if (!update) {
        res.status(404).json({ error: "Seller update not found" });
        return;
      }
      res.json(update);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch seller update" });
    }
  });

  app.post("/api/seller-updates", async (req, res) => {
    try {
      const updateData = insertSellerUpdateSchema.parse(req.body);
      
      // For embeddable widgets: create or find user by email if userId is "guest"
      let userId = updateData.userId;
      if (userId === "guest") {
        const email = updateData.email;
        let user = await storage.getUserByEmail(email);
        
        if (!user) {
          // Create a new user with minimal info from the form
          user = await storage.createUser({
            email,
            passwordHash: "", // Empty for guest users created from embed forms
            role: "client",
            firstName: updateData.name.split(' ')[0],
            lastName: updateData.name.split(' ').slice(1).join(' ') || "",
          });
        }
        
        userId = user.id;
      }
      
      const update = await storage.createSellerUpdate({
        ...updateData,
        userId,
      });
      res.status(201).json(update);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid seller update data", details: error.errors });
      } else {
        console.error("Error creating seller update:", error);
        res.status(500).json({ error: "Failed to create seller update" });
      }
    }
  });

  app.patch("/api/seller-updates/:id", async (req, res) => {
    try {
      const updateData = updateSellerUpdateSchema.parse(req.body);
      const update = await storage.updateSellerUpdate(req.params.id, updateData);
      if (!update) {
        res.status(404).json({ error: "Seller update not found" });
        return;
      }
      res.json(update);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid update data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update seller update" });
      }
    }
  });

  app.delete("/api/seller-updates/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSellerUpdate(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Seller update not found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete seller update" });
    }
  });

  // Elementary schools autocomplete endpoint
  app.get("/api/schools/elementary", async (req, res) => {
    try {
      const search = (req.query.search as string) || '';
      const allProperties = await storage.getAllProperties();
      
      // Get unique elementary schools, filter by search, and sort
      const schools = Array.from(new Set(
        allProperties
          .map(p => p.elementarySchool)
          .filter((school): school is string => 
            school !== null && 
            school !== undefined && 
            school.trim() !== '' &&
            school.toLowerCase().includes(search.toLowerCase())
          )
      )).sort();
      
      res.json(schools.slice(0, 50)); // Limit to 50 results for autocomplete
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch elementary schools" });
    }
  });

  app.get("/api/properties/types", async (req, res) => {
    try {
      const allProperties = await storage.getAllProperties();
      
      // Get unique property subtypes and sort
      const types = Array.from(new Set(
        allProperties
          .map(p => p.propertySubType)
          .filter((type): type is string => 
            type !== null && 
            type !== undefined && 
            type.trim() !== ''
          )
      )).sort();
      
      res.json(types);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch property types" });
    }
  });
  
  // Autocomplete endpoints for location fields (optimized with direct DB queries)
  
  // Get unique cities for autocomplete
  app.get("/api/autocomplete/cities", async (req, res) => {
    try {
      const search = (req.query.search as string) || '';
      const cities = await storage.getAutocompleteCities(search, 50);
      res.json(cities);
    } catch (error) {
      console.error("Cities autocomplete error:", error);
      res.status(500).json({ error: "Failed to fetch cities" });
    }
  });
  
  // Get unique zip codes for autocomplete
  app.get("/api/autocomplete/zipcodes", async (req, res) => {
    try {
      const search = (req.query.search as string) || '';
      const zipcodes = await storage.getAutocompleteZipCodes(search, 50);
      res.json(zipcodes);
    } catch (error) {
      console.error("Zipcodes autocomplete error:", error);
      res.status(500).json({ error: "Failed to fetch zip codes" });
    }
  });
  
  // Get unique subdivisions for autocomplete
  app.get("/api/autocomplete/subdivisions", async (req, res) => {
    try {
      const search = (req.query.search as string) || '';
      const subdivisions = await storage.getAutocompleteSubdivisions(search, 50);
      res.json(subdivisions);
    } catch (error) {
      console.error("Subdivisions autocomplete error:", error);
      res.status(500).json({ error: "Failed to fetch subdivisions" });
    }
  });
  
  // Get unique neighborhoods for autocomplete (uses subdivision data)
  app.get("/api/autocomplete/neighborhoods", async (req, res) => {
    try {
      const search = (req.query.search as string) || '';
      const neighborhoods = await storage.getAutocompleteSubdivisions(search, 50);
      res.json(neighborhoods);
    } catch (error) {
      console.error("Neighborhoods autocomplete error:", error);
      res.status(500).json({ error: "Failed to fetch neighborhoods" });
    }
  });

  // Preview matching properties for a seller update
  app.get("/api/seller-updates/:id/preview", async (req, res) => {
    try {
      const sellerUpdate = await storage.getSellerUpdate(req.params.id);
      if (!sellerUpdate) {
        res.status(404).json({ error: "Seller update not found" });
        return;
      }
      
      const result = await findMatchingProperties(sellerUpdate);
      const marketSummary = calculateMarketSummary(result.properties);
      
      res.json({
        ...result,
        marketSummary,
        properties: result.properties.slice(0, 20), // Limit to 20 for preview
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to preview matching properties" });
    }
  });

  // CMA Statistics - calculate from stored propertiesData
  app.get("/api/cmas/:id/statistics", async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        res.status(404).json({ error: "CMA not found" });
        return;
      }

      const properties = (cma as any).propertiesData || [];
      
      if (properties.length === 0) {
        const emptyStats = { range: { min: 0, max: 0 }, average: 0, median: 0 };
        res.json({
          price: emptyStats,
          livingArea: emptyStats,
          pricePerSqFt: emptyStats,
          daysOnMarket: emptyStats,
          lotSize: emptyStats,
          acres: emptyStats,
          yearBuilt: emptyStats,
          bedrooms: emptyStats,
          bathrooms: emptyStats,
          activeListings: 0,
        });
        return;
      }

      const getNumericValues = (values: number[]) => values.filter(v => !isNaN(v) && v > 0);
      
      const calculateStats = (values: number[]) => {
        if (values.length === 0) return { range: { min: 0, max: 0 }, average: 0, median: 0 };
        const sorted = [...values].sort((a, b) => a - b);
        return {
          range: { min: sorted[0], max: sorted[sorted.length - 1] },
          average: values.reduce((a, b) => a + b, 0) / values.length,
          median: sorted[Math.floor(sorted.length / 2)],
        };
      };

      const prices = getNumericValues(properties.map((p: any) => Number(p.closePrice || p.listPrice)));
      const livingAreas = getNumericValues(properties.map((p: any) => Number(p.livingArea)));
      const pricesPerSqFt = getNumericValues(properties.map((p: any) => {
        const price = Number(p.closePrice || p.listPrice);
        const area = Number(p.livingArea);
        return area > 0 ? price / area : 0;
      }));
      const daysOnMarket = getNumericValues(properties.map((p: any) => Number(p.daysOnMarket || p.cumulativeDaysOnMarket)));
      const lotSizes = getNumericValues(properties.map((p: any) => Number(p.lotSizeSquareFeet)));
      const acres = getNumericValues(properties.map((p: any) => Number(p.lotSizeAcres || (p.lotSizeSquareFeet ? p.lotSizeSquareFeet / 43560 : 0))));
      const yearsBuilt = getNumericValues(properties.map((p: any) => Number(p.yearBuilt)));
      const bedrooms = getNumericValues(properties.map((p: any) => Number(p.bedroomsTotal)));
      const bathrooms = getNumericValues(properties.map((p: any) => Number(p.bathroomsTotalInteger || p.bathroomsFull)));
      const activeCount = properties.filter((p: any) => p.standardStatus === 'Active').length;

      res.json({
        price: calculateStats(prices),
        livingArea: calculateStats(livingAreas),
        pricePerSqFt: calculateStats(pricesPerSqFt),
        daysOnMarket: calculateStats(daysOnMarket),
        lotSize: calculateStats(lotSizes),
        acres: calculateStats(acres),
        yearBuilt: calculateStats(yearsBuilt),
        bedrooms: calculateStats(bedrooms),
        bathrooms: calculateStats(bathrooms),
        activeListings: activeCount,
      });
    } catch (error) {
      console.error("Error calculating statistics:", error);
      res.status(500).json({ error: "Failed to calculate statistics" });
    }
  });

  // CMA Timeline - calculate from stored propertiesData
  app.get("/api/cmas/:id/timeline", async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        res.status(404).json({ error: "CMA not found" });
        return;
      }

      const properties = (cma as any).propertiesData || [];
      
      const timelineData = properties
        .filter((p: any) => p.closeDate || p.listingContractDate)
        .map((p: any) => ({
          date: p.closeDate || p.listingContractDate,
          price: Number(p.closePrice || p.listPrice),
          status: p.standardStatus || 'Unknown',
          propertyId: p.id || p.listingId,
        }))
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      res.json(timelineData);
    } catch (error) {
      res.status(500).json({ error: "Failed to get timeline data" });
    }
  });

  // MLS Grid sync endpoint - triggers manual sync
  app.post("/api/sync", requireAuth, async (req, res) => {
    try {
      if (!mlsGridClient) {
        res.status(503).json({ error: "MLS Grid API not configured" });
        return;
      }

      console.log('🔄 Manual MLS Grid sync triggered by user');
      
      // Start sync in background and respond immediately
      triggerManualSync()
        .then(() => console.log('✅ Manual MLS Grid sync completed'))
        .catch(err => console.error('❌ Manual MLS Grid sync failed:', err));
      
      res.json({ 
        message: "Sync initiated - this may take several minutes", 
        timestamp: new Date().toISOString(),
        note: "Check server logs for progress"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to initiate sync" });
    }
  });
  
  // Get sync status
  app.get("/api/sync/status", async (req, res) => {
    try {
      // Get current time in CST for next scheduled sync info
      const now = new Date();
      const cstFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      });
      
      res.json({
        mlsGridConfigured: !!mlsGridClient,
        scheduledSyncTime: "12:00 AM CST (daily)",
        currentTimeCst: cstFormatter.format(now),
        message: "MLS Grid sync runs automatically at 12:00 AM CST daily"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get sync status" });
    }
  });

  // MLS Grid direct search endpoint (real-time Active listings from IDX)
  app.get("/api/mlsgrid/search", async (req, res) => {
    try {
      if (!mlsGridClient) {
        res.status(503).json({ 
          error: "MLS Grid API not configured",
          properties: [],
          total: 0 
        });
        return;
      }

      const parseArray = (val: any): string[] | undefined => {
        if (!val) return undefined;
        return Array.isArray(val) ? val as string[] : [val as string];
      };

      const params = {
        standardStatus: parseArray(req.query.standardStatus) || ['Active'],
        minListPrice: req.query.minListPrice ? parseInt(req.query.minListPrice as string) : undefined,
        maxListPrice: req.query.maxListPrice ? parseInt(req.query.maxListPrice as string) : undefined,
        minBedroomsTotal: req.query.minBedroomsTotal ? parseInt(req.query.minBedroomsTotal as string) : undefined,
        maxBedroomsTotal: req.query.maxBedroomsTotal ? parseInt(req.query.maxBedroomsTotal as string) : undefined,
        minBathroomsTotalInteger: req.query.minBathroomsTotalInteger ? parseInt(req.query.minBathroomsTotalInteger as string) : undefined,
        maxBathroomsTotalInteger: req.query.maxBathroomsTotalInteger ? parseInt(req.query.maxBathroomsTotalInteger as string) : undefined,
        minLivingArea: req.query.minLivingArea ? parseInt(req.query.minLivingArea as string) : undefined,
        maxLivingArea: req.query.maxLivingArea ? parseInt(req.query.maxLivingArea as string) : undefined,
        minYearBuilt: req.query.minYearBuilt ? parseInt(req.query.minYearBuilt as string) : undefined,
        maxYearBuilt: req.query.maxYearBuilt ? parseInt(req.query.maxYearBuilt as string) : undefined,
        postalCodes: parseArray(req.query.postalCodes) || parseArray(req.query.zipCodes),
        cities: parseArray(req.query.cities),
        subdivisions: parseArray(req.query.subdivisions),
        propertySubType: parseArray(req.query.propertySubType),
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        skip: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      console.log('[MLS Grid Search] Params:', JSON.stringify(params, null, 2));

      const result = await mlsGridClient.searchProperties(params);
      
      // Map MLS Grid response to our property format
      const properties = (result.value || []).map((prop: any) => ({
        id: prop.ListingId || prop.ListingKey,
        listingId: prop.ListingId,
        listingKey: prop.ListingKey,
        standardStatus: prop.StandardStatus,
        listPrice: prop.ListPrice,
        closePrice: prop.ClosePrice,
        originalListPrice: prop.OriginalListPrice,
        streetNumber: prop.StreetNumber,
        streetName: prop.StreetName,
        streetSuffix: prop.StreetSuffix,
        unitNumber: prop.UnitNumber,
        city: prop.City,
        stateOrProvince: prop.StateOrProvince,
        postalCode: prop.PostalCode,
        county: prop.CountyOrParish,
        subdivision: prop.SubdivisionName,
        propertyType: prop.PropertyType,
        propertySubType: prop.PropertySubType,
        bedroomsTotal: prop.BedroomsTotal,
        bathroomsTotalInteger: prop.BathroomsTotalInteger,
        bathroomsFull: prop.BathroomsFull,
        bathroomsHalf: prop.BathroomsHalf,
        livingArea: prop.LivingArea,
        lotSizeSquareFeet: prop.LotSizeSquareFeet,
        lotSizeAcres: prop.LotSizeAcres,
        yearBuilt: prop.YearBuilt,
        garageSpaces: prop.GarageSpaces,
        stories: prop.Stories,
        poolPrivateYN: prop.PoolPrivateYN,
        waterfrontYN: prop.WaterfrontYN,
        view: prop.View,
        publicRemarks: prop.PublicRemarks,
        listAgentFullName: prop.ListAgentFullName,
        listOfficeName: prop.ListOfficeName,
        daysOnMarket: prop.DaysOnMarket,
        listingContractDate: prop.ListingContractDate,
        closeDate: prop.CloseDate,
        media: prop.Media || [],
        latitude: prop.Latitude,
        longitude: prop.Longitude,
      }));

      res.json({
        properties,
        total: result['@odata.count'] || properties.length,
        hasMore: properties.length === params.limit,
        source: 'MLS Grid IDX',
      });
    } catch (error: any) {
      console.error('[MLS Grid Search] Error:', error.message);
      res.status(500).json({ 
        error: "Failed to search MLS Grid",
        message: error.message,
        properties: [],
        total: 0 
      });
    }
  });

  // ========== HomeReview API Integration Routes ==========
  // These routes proxy requests to the HomeReview-AI app which contains
  // all sold data from 1996-present and neighborhood boundaries
  
  const homeReviewClient = getHomeReviewClient();

  // HomeReview API health check
  app.get("/api/homereview/health", async (req, res) => {
    try {
      const health = await homeReviewClient.checkHealth();
      res.json(health);
    } catch (error: any) {
      res.json({
        available: false,
        message: 'Failed to check HomeReview API status',
      });
    }
  });

  // Search properties via HomeReview API (with sold data from 1996-present)
  app.get("/api/homereview/properties", async (req, res) => {
    try {
      const parseArray = (val: any): string[] | undefined => {
        if (!val) return undefined;
        return Array.isArray(val) ? val as string[] : [val as string];
      };
      
      const params: PropertySearchParams = {
        city: req.query.city as string,
        cities: parseArray(req.query.cities),
        subdivision: req.query.subdivision as string,
        subdivisions: parseArray(req.query.subdivisions),
        status: req.query.status as string,
        statuses: parseArray(req.query.statuses),
        minPrice: req.query.minPrice ? parseInt(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseInt(req.query.maxPrice as string) : undefined,
        minBeds: req.query.minBeds ? parseInt(req.query.minBeds as string) : undefined,
        maxBeds: req.query.maxBeds ? parseInt(req.query.maxBeds as string) : undefined,
        minBaths: req.query.minBaths ? parseInt(req.query.minBaths as string) : undefined,
        maxBaths: req.query.maxBaths ? parseInt(req.query.maxBaths as string) : undefined,
        minSqft: req.query.minSqft ? parseInt(req.query.minSqft as string) : undefined,
        maxSqft: req.query.maxSqft ? parseInt(req.query.maxSqft as string) : undefined,
        minYearBuilt: req.query.minYearBuilt ? parseInt(req.query.minYearBuilt as string) : undefined,
        maxYearBuilt: req.query.maxYearBuilt ? parseInt(req.query.maxYearBuilt as string) : undefined,
        minLotSize: req.query.minLotSize ? parseInt(req.query.minLotSize as string) : undefined,
        maxLotSize: req.query.maxLotSize ? parseInt(req.query.maxLotSize as string) : undefined,
        propertyTypes: parseArray(req.query.propertyTypes),
        propertySubTypes: parseArray(req.query.propertySubTypes),
        hasPool: req.query.hasPool === 'true' ? true : req.query.hasPool === 'false' ? false : undefined,
        hasWaterfront: req.query.hasWaterfront === 'true' ? true : req.query.hasWaterfront === 'false' ? false : undefined,
        hasView: req.query.hasView === 'true' ? true : req.query.hasView === 'false' ? false : undefined,
        minGarageSpaces: req.query.minGarageSpaces ? parseInt(req.query.minGarageSpaces as string) : undefined,
        postalCodes: parseArray(req.query.postalCodes) || parseArray(req.query.postalCode),
        counties: parseArray(req.query.counties),
        elementarySchools: parseArray(req.query.elementarySchools),
        middleSchools: parseArray(req.query.middleSchools),
        highSchools: parseArray(req.query.highSchools),
        keywords: req.query.keywords as string,
        listingAgentName: req.query.listingAgentName as string,
        listingOfficeName: req.query.listingOfficeName as string,
        minDaysOnMarket: req.query.minDaysOnMarket ? parseInt(req.query.minDaysOnMarket as string) : undefined,
        maxDaysOnMarket: req.query.maxDaysOnMarket ? parseInt(req.query.maxDaysOnMarket as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await homeReviewClient.searchProperties(params);
      
      // Map properties to our schema format
      const mappedProperties = result.properties.map(mapHomeReviewPropertyToSchema);
      
      res.json({
        properties: mappedProperties,
        total: result.total,
        hasMore: result.hasMore,
        source: 'homereview',
      });
    } catch (error: any) {
      console.error('HomeReview properties error:', error.message);
      res.status(500).json({ error: 'Failed to fetch properties from HomeReview API' });
    }
  });

  // Get single property from HomeReview API
  app.get("/api/homereview/properties/:listingId", async (req, res) => {
    try {
      const property = await homeReviewClient.getProperty(req.params.listingId);
      
      if (!property) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }
      
      res.json(mapHomeReviewPropertyToSchema(property));
    } catch (error: any) {
      console.error('HomeReview property error:', error.message);
      res.status(500).json({ error: 'Failed to fetch property from HomeReview API' });
    }
  });

  // Get market statistics from HomeReview API
  app.get("/api/homereview/stats", async (req, res) => {
    try {
      const subdivision = req.query.subdivision as string;
      
      if (!subdivision) {
        res.status(400).json({ error: 'Subdivision is required' });
        return;
      }
      
      const stats = await homeReviewClient.getMarketStats(subdivision);
      
      if (!stats) {
        res.status(404).json({ error: 'No statistics found for subdivision' });
        return;
      }
      
      res.json(stats);
    } catch (error: any) {
      console.error('HomeReview stats error:', error.message);
      res.status(500).json({ error: 'Failed to fetch market statistics' });
    }
  });

  // Neighborhood lookup by coordinates
  app.get("/api/homereview/neighborhoods/lookup", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      
      if (isNaN(lat) || isNaN(lon)) {
        res.status(400).json({ error: 'Valid latitude and longitude are required' });
        return;
      }
      
      const neighborhood = await homeReviewClient.lookupNeighborhood(lat, lon);
      
      if (!neighborhood) {
        res.status(404).json({ error: 'No neighborhood found at coordinates' });
        return;
      }
      
      res.json(neighborhood);
    } catch (error: any) {
      console.error('HomeReview neighborhood lookup error:', error.message);
      res.status(500).json({ error: 'Failed to lookup neighborhood' });
    }
  });

  // Search neighborhoods by name
  app.get("/api/homereview/neighborhoods/search", async (req, res) => {
    try {
      const name = req.query.name as string;
      const city = req.query.city as string;
      
      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      
      const neighborhoods = await homeReviewClient.searchNeighborhoods(name, city);
      res.json(neighborhoods);
    } catch (error: any) {
      console.error('HomeReview neighborhood search error:', error.message);
      res.status(500).json({ error: 'Failed to search neighborhoods' });
    }
  });

  // Get all neighborhoods in a city
  app.get("/api/homereview/neighborhoods/city/:city", async (req, res) => {
    try {
      const neighborhoods = await homeReviewClient.getNeighborhoodsByCity(req.params.city);
      res.json(neighborhoods);
    } catch (error: any) {
      console.error('HomeReview city neighborhoods error:', error.message);
      res.status(500).json({ error: 'Failed to fetch city neighborhoods' });
    }
  });

  // Get neighborhood GeoJSON for a city
  app.get("/api/homereview/neighborhoods/geojson", async (req, res) => {
    try {
      const city = req.query.city as string;
      
      if (!city) {
        res.status(400).json({ error: 'City is required' });
        return;
      }
      
      const geojson = await homeReviewClient.getNeighborhoodGeoJSON(city);
      
      if (!geojson) {
        res.status(404).json({ error: 'No GeoJSON found for city' });
        return;
      }
      
      res.json(geojson);
    } catch (error: any) {
      console.error('HomeReview GeoJSON error:', error.message);
      res.status(500).json({ error: 'Failed to fetch neighborhood GeoJSON' });
    }
  });

  // Match MLS subdivision to neighborhood
  app.get("/api/homereview/neighborhoods/match-mls", async (req, res) => {
    try {
      const subdivision = req.query.subdivision as string;
      const city = req.query.city as string;
      
      if (!subdivision || !city) {
        res.status(400).json({ error: 'Subdivision and city are required' });
        return;
      }
      
      const neighborhood = await homeReviewClient.matchMLSSubdivision(subdivision, city);
      
      if (!neighborhood) {
        res.status(404).json({ error: 'No matching neighborhood found' });
        return;
      }
      
      res.json(neighborhood);
    } catch (error: any) {
      console.error('HomeReview MLS match error:', error.message);
      res.status(500).json({ error: 'Failed to match MLS subdivision' });
    }
  });

  // Mapbox Geocoding endpoints - require authentication and rate limiting
  const geocodeRateLimiter = new Map<string, { count: number; resetTime: number }>();
  const GEOCODE_RATE_LIMIT = 100;
  const GEOCODE_RATE_WINDOW = 60 * 1000;

  const checkGeocodeRateLimit = (clientId: string): boolean => {
    const now = Date.now();
    const record = geocodeRateLimiter.get(clientId);
    
    if (!record || record.resetTime < now) {
      geocodeRateLimiter.set(clientId, { count: 1, resetTime: now + GEOCODE_RATE_WINDOW });
      return true;
    }
    
    if (record.count >= GEOCODE_RATE_LIMIT) {
      return false;
    }
    
    record.count++;
    return true;
  };

  app.get("/api/geocode", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id || 'anonymous';
      
      if (!checkGeocodeRateLimit(userId)) {
        res.status(429).json({ error: "Rate limit exceeded. Try again in a minute." });
        return;
      }

      const address = req.query.address as string;
      
      if (!address) {
        res.status(400).json({ error: "Address is required" });
        return;
      }

      if (!isMapboxConfigured()) {
        res.status(503).json({ error: "Geocoding service not configured" });
        return;
      }

      const result = await geocodeAddress(address);
      
      if (!result) {
        res.status(404).json({ error: "Could not geocode address" });
        return;
      }

      res.json(result);
    } catch (error: any) {
      console.error("Geocoding error:", error.message);
      res.status(500).json({ error: "Geocoding failed" });
    }
  });

  app.post("/api/geocode/batch", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id || 'anonymous';
      
      if (!checkGeocodeRateLimit(userId)) {
        res.status(429).json({ error: "Rate limit exceeded. Try again in a minute." });
        return;
      }

      const { properties } = req.body;
      
      if (!Array.isArray(properties) || properties.length === 0) {
        res.status(400).json({ error: "Properties array is required" });
        return;
      }

      if (!isMapboxConfigured()) {
        res.status(503).json({ error: "Geocoding service not configured" });
        return;
      }

      if (properties.length > 50) {
        res.status(400).json({ error: "Maximum 50 properties per batch request" });
        return;
      }

      const results = await geocodeProperties(properties);
      res.json({ geocoded: results, total: results.length });
    } catch (error: any) {
      console.error("Batch geocoding error:", error.message);
      res.status(500).json({ error: "Batch geocoding failed" });
    }
  });

  // Repliers API endpoints
  app.get("/api/repliers/listings", async (req, res) => {
    try {
      const client = getRepliersClient();
      if (!client) {
        res.status(503).json({ error: "Repliers API not configured" });
        return;
      }

      const params: any = {};
      
      // Server-side filters (Repliers doesn't support these directly)
      const propertySubTypeFilter = req.query.propertySubType as string | undefined;
      const streetNameFilter = req.query.streetName as string | undefined;
      const streetNumberMin = req.query.streetNumberMin ? parseInt(req.query.streetNumberMin as string) : undefined;
      const streetNumberMax = req.query.streetNumberMax ? parseInt(req.query.streetNumberMax as string) : undefined;
      const needsServerSideFiltering = !!(propertySubTypeFilter || streetNameFilter || streetNumberMin || streetNumberMax);
      
      const requestedResultsPerPage = req.query.resultsPerPage 
        ? parseInt(req.query.resultsPerPage as string) 
        : 50;
      
      if (req.query.status) params.status = req.query.status as string;
      if (req.query.minPrice) params.minPrice = parseInt(req.query.minPrice as string);
      if (req.query.maxPrice) params.maxPrice = parseInt(req.query.maxPrice as string);
      if (req.query.minBeds) params.minBeds = parseInt(req.query.minBeds as string);
      if (req.query.maxBeds) params.maxBeds = parseInt(req.query.maxBeds as string);
      if (req.query.minBaths) params.minBaths = parseInt(req.query.minBaths as string);
      if (req.query.maxBaths) params.maxBaths = parseInt(req.query.maxBaths as string);
      if (req.query.minSqft) params.minSqft = parseInt(req.query.minSqft as string);
      if (req.query.maxSqft) params.maxSqft = parseInt(req.query.maxSqft as string);
      if (req.query.propertyType) params.propertyType = req.query.propertyType as string;
      if (req.query.city) params.city = req.query.city as string;
      if (req.query.postalCode) params.postalCode = req.query.postalCode as string;
      if (req.query.neighborhood) params.neighborhood = req.query.neighborhood as string;
      if (req.query.pageNum) params.pageNum = parseInt(req.query.pageNum as string);
      if (req.query.sortBy) params.sortBy = req.query.sortBy as string;
      if (req.query.class) params.class = req.query.class as string;
      
      // If filtering by street address, try to geocode and use bounding box
      if (streetNameFilter && isMapboxConfigured()) {
        try {
          // Build address string for geocoding
          const addressParts = [streetNameFilter];
          if (req.query.city) addressParts.push(req.query.city as string);
          if (req.query.postalCode) addressParts.push(req.query.postalCode as string);
          addressParts.push('TX'); // Default to Texas
          
          const geocodeResult = await geocodeAddress(addressParts.join(', '));
          if (geocodeResult.latitude && geocodeResult.longitude) {
            // Create a tight bounding box (~0.01 degrees = ~1km radius)
            const delta = 0.01;
            params.minLat = geocodeResult.latitude - delta;
            params.maxLat = geocodeResult.latitude + delta;
            params.minLng = geocodeResult.longitude - delta;
            params.maxLng = geocodeResult.longitude + delta;
            console.log(`Geocoded "${addressParts.join(', ')}" to lat/lng bounding box: ${params.minLat},${params.maxLat},${params.minLng},${params.maxLng}`);
          }
        } catch (geocodeError) {
          console.log('Geocoding failed for street address search, will filter server-side:', geocodeError);
        }
      }
      
      // If filtering by server-side params, fetch more results to ensure enough after filtering
      params.resultsPerPage = needsServerSideFiltering 
        ? Math.min(requestedResultsPerPage * 4, 200) 
        : requestedResultsPerPage;

      const response = await client.searchListings(params);
      
      let standardizedProperties = response.listings.map(listing => 
        client.mapToStandardProperty(listing)
      );
      
      // Apply server-side propertySubType filter
      if (propertySubTypeFilter) {
        const filterLower = propertySubTypeFilter.toLowerCase().trim();
        standardizedProperties = standardizedProperties.filter(prop => {
          const propSubType = (prop.propertySubType || prop.style || '').toLowerCase().trim();
          // Exact match or contains the filter term
          if (filterLower === 'single family') {
            // Exclude land, lots, and unimproved properties when filtering for Single Family
            const excludeTerms = ['land', 'lot', 'unimproved', 'vacant'];
            const hasExcludeTerm = excludeTerms.some(term => propSubType.includes(term));
            return propSubType.includes('single') || 
                   propSubType.includes('detached') || 
                   (propSubType.includes('family') && !hasExcludeTerm);
          }
          return propSubType.includes(filterLower) || propSubType === filterLower;
        });
      }
      
      // Apply server-side street name filter
      if (streetNameFilter) {
        const streetLower = streetNameFilter.toLowerCase().trim();
        standardizedProperties = standardizedProperties.filter(prop => {
          const propStreetName = (prop.streetName || '').toLowerCase().trim();
          const propAddress = (prop.unparsedAddress || prop.address || '').toLowerCase();
          return propStreetName.includes(streetLower) || propAddress.includes(streetLower);
        });
      }
      
      // Apply server-side street number filter
      if (streetNumberMin !== undefined || streetNumberMax !== undefined) {
        standardizedProperties = standardizedProperties.filter(prop => {
          const streetNum = parseInt(prop.streetNumber || '0', 10);
          if (isNaN(streetNum)) return false;
          if (streetNumberMin !== undefined && streetNum < streetNumberMin) return false;
          if (streetNumberMax !== undefined && streetNum > streetNumberMax) return false;
          return true;
        });
      }
      
      // Limit to requested count after all filtering
      if (needsServerSideFiltering) {
        standardizedProperties = standardizedProperties.slice(0, requestedResultsPerPage);
      }

      res.json({
        properties: standardizedProperties,
        total: needsServerSideFiltering ? standardizedProperties.length : response.count,
        page: response.currentPage,
        totalPages: response.numPages,
        resultsPerPage: needsServerSideFiltering ? standardizedProperties.length : response.resultsPerPage,
      });
    } catch (error: any) {
      console.error("Repliers listings error:", error.message);
      res.status(500).json({ error: "Failed to fetch listings from Repliers" });
    }
  });

  app.get("/api/repliers/listings/:mlsNumber", async (req, res) => {
    try {
      const client = getRepliersClient();
      if (!client) {
        res.status(503).json({ error: "Repliers API not configured" });
        return;
      }

      const listing = await client.getListing(req.params.mlsNumber);
      
      if (!listing) {
        res.status(404).json({ error: "Listing not found" });
        return;
      }

      res.json(client.mapToStandardProperty(listing));
    } catch (error: any) {
      console.error("Repliers listing detail error:", error.message);
      res.status(500).json({ error: "Failed to fetch listing from Repliers" });
    }
  });

  app.get("/api/repliers/locations", async (req, res) => {
    try {
      const client = getRepliersClient();
      if (!client) {
        res.status(503).json({ error: "Repliers API not configured" });
        return;
      }

      const params: any = {};
      if (req.query.area) params.area = req.query.area as string;
      if (req.query.city) params.city = req.query.city as string;

      const locations = await client.getLocations(params);
      res.json(locations);
    } catch (error: any) {
      console.error("Repliers locations error:", error.message);
      res.status(500).json({ error: "Failed to fetch locations from Repliers" });
    }
  });

  app.post("/api/repliers/nlp", async (req, res) => {
    try {
      const client = getRepliersClient();
      if (!client) {
        res.status(503).json({ error: "Repliers API not configured" });
        return;
      }

      const { prompt, nlpId } = req.body;
      
      if (!prompt) {
        res.status(400).json({ error: "Prompt is required" });
        return;
      }

      const result = await client.nlpSearch(prompt, nlpId);
      res.json(result);
    } catch (error: any) {
      console.error("Repliers NLP error:", error.message);
      res.status(500).json({ error: "Failed to perform NLP search" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      mlsGridConfigured: mlsGridClient !== null,
      homeReviewConfigured: true,
      repliersConfigured: isRepliersConfigured(),
      mapboxConfigured: isMapboxConfigured(),
      timestamp: new Date().toISOString() 
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}
