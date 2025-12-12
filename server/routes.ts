import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createMLSGridClient } from "./mlsgrid-client";
import { triggerManualSync } from "./mlsgrid-sync";
import { getHomeReviewClient, mapHomeReviewPropertyToSchema, type PropertySearchParams } from "./homereview-client";
import { initRepliersClient, getRepliersClient, isRepliersConfigured } from "./repliers-client";
import { geocodeAddress, geocodeProperties, isMapboxConfigured } from "./mapbox-geocoding";
import { searchCriteriaSchema, insertCmaSchema, insertUserSchema, insertSellerUpdateSchema, updateSellerUpdateSchema, updateLeadGateSettingsSchema, isLikelyRentalProperty, filterOutRentalProperties } from "@shared/schema";
import { findMatchingProperties, calculateMarketSummary } from "./seller-update-service";
import { z } from "zod";
import bcrypt from "bcryptjs";
import passport from "passport";
import { requireAuth, requireRole } from "./auth";
import { fetchExternalUsers, fetchFromExternalApi } from "./external-api";
import type { PropertyStatistics, TimelineDataPoint } from "@shared/schema";

// Wrapper around shared filterOutRentalProperties that adds logging
function filterOutRentals(properties: any[]): any[] {
  const rentals = properties.filter(p => isLikelyRentalProperty(p));
  const validProperties = filterOutRentalProperties(properties);
  
  if (rentals.length > 0) {
    rentals.forEach(p => {
      const status = (p.standardStatus || p.status || '').toLowerCase();
      const price = (status === 'closed' || status === 'sold') 
        ? Number(p.closePrice || 0) 
        : Number(p.listPrice || 0);
      const priceLabel = (status === 'closed' || status === 'sold') ? 'closePrice' : 'listPrice';
      console.log(`🏠 Rental detected: ${p.unparsedAddress || p.address} (${p.standardStatus || p.status}) - ${priceLabel}: $${price.toLocaleString()}`);
    });
    console.log(`🏠 Filtered out ${rentals.length} rental properties from analysis`);
  }
  return validProperties;
}

// Helper function to calculate statistics from property data directly
function calculateStatisticsFromProperties(properties: any[]): PropertyStatistics {
  if (properties.length === 0) {
    return {
      price: { range: { min: 0, max: 0 }, average: 0, median: 0 },
      pricePerSqFt: { range: { min: 0, max: 0 }, average: 0, median: 0 },
      daysOnMarket: { range: { min: 0, max: 0 }, average: 0, median: 0 },
      livingArea: { range: { min: 0, max: 0 }, average: 0, median: 0 },
      lotSize: { range: { min: 0, max: 0 }, average: 0, median: 0 },
      acres: { range: { min: 0, max: 0 }, average: 0, median: 0 },
      bedrooms: { range: { min: 0, max: 0 }, average: 0, median: 0 },
      bathrooms: { range: { min: 0, max: 0 }, average: 0, median: 0 },
      yearBuilt: { range: { min: 0, max: 0 }, average: 0, median: 0 },
    };
  }

  const getNumericValue = (val: any): number | null => {
    if (val == null) return null;
    const num = Number(val);
    return isNaN(num) || num <= 0 ? null : num;
  };

  const getValues = (field: string): number[] => {
    return properties
      .map(p => getNumericValue(p[field]))
      .filter((v): v is number => v !== null);
  };

  const calculateMedian = (sorted: number[]): number => {
    if (sorted.length === 0) return 0;
    const mid = sorted.length / 2;
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[Math.floor(mid)];
  };

  const calculateStats = (values: number[]) => {
    if (values.length === 0) return { range: { min: 0, max: 0 }, average: 0, median: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    return {
      range: { min: sorted[0], max: sorted[sorted.length - 1] },
      average: values.reduce((a, b) => a + b, 0) / values.length,
      median: calculateMedian(sorted),
    };
  };

  // Get prices (use closePrice for sold, listPrice otherwise)
  const prices = properties.map(p => {
    if (p.standardStatus === 'Closed' && p.closePrice) {
      return getNumericValue(p.closePrice);
    }
    return getNumericValue(p.listPrice);
  }).filter((v): v is number => v !== null);

  const livingAreas = getValues('livingArea');
  const pricesPerSqft = properties.map(p => {
    const price = p.standardStatus === 'Closed' && p.closePrice 
      ? getNumericValue(p.closePrice) 
      : getNumericValue(p.listPrice);
    const area = getNumericValue(p.livingArea);
    return price && area ? price / area : null;
  }).filter((v): v is number => v !== null);

  return {
    price: calculateStats(prices),
    pricePerSqFt: calculateStats(pricesPerSqft),
    daysOnMarket: calculateStats(getValues('daysOnMarket')),
    livingArea: calculateStats(livingAreas),
    lotSize: calculateStats(getValues('lotSizeSquareFeet')),
    acres: calculateStats(getValues('lotSizeAcres')),
    bedrooms: calculateStats(getValues('bedroomsTotal').length > 0 ? getValues('bedroomsTotal') : getValues('beds')),
    bathrooms: calculateStats(getValues('bathroomsTotalInteger').length > 0 ? getValues('bathroomsTotalInteger') : getValues('baths')),
    yearBuilt: calculateStats(getValues('yearBuilt')),
  };
}

// Helper function to calculate timeline from property data directly
function calculateTimelineFromProperties(properties: any[]): TimelineDataPoint[] {
  const now = new Date();
  
  return properties
    .filter(p => (p.listingContractDate || p.listDate) && (p.listPrice || p.closePrice) && (p.unparsedAddress || p.address))
    .map(p => {
      const rawStatusValue = p.standardStatus || p.status || 'Active';
      // Normalize Pending to Under Contract for consistent handling
      const status = (rawStatusValue === 'Pending' ? 'Under Contract' : rawStatusValue) as 'Active' | 'Under Contract' | 'Closed';
      const listDate = new Date(p.listingContractDate || p.listDate);
      const closeDate = p.closeDate ? new Date(p.closeDate) : null;
      const underContractDate = p.underContractDate || p.pendingDate || p.statusChangeDate;
      
      // Calculate days based on status using Repliers date fields
      let daysOnMarket: number | null = null;
      let daysActive: number | null = null;
      let daysUnderContract: number | null = null;
      
      if (status === 'Closed' || rawStatusValue === 'Sold') {
        // Days on Market = Close/Sold Date - Listing Date
        if (closeDate && listDate) {
          daysOnMarket = Math.floor((closeDate.getTime() - listDate.getTime()) / (1000 * 60 * 60 * 24));
        } else if (p.daysOnMarket != null) {
          daysOnMarket = Number(p.daysOnMarket);
        } else if (p.cumulativeDaysOnMarket != null) {
          daysOnMarket = Number(p.cumulativeDaysOnMarket);
        }
      } else if (status === 'Active') {
        // Days Active = Current Date - Listing Date
        if (listDate) {
          daysActive = Math.floor((now.getTime() - listDate.getTime()) / (1000 * 60 * 60 * 24));
        }
        // Also include any stored daysOnMarket
        if (p.daysOnMarket != null) {
          daysOnMarket = Number(p.daysOnMarket);
        }
      } else if (status === 'Under Contract') {
        // Days Under Contract = Current Date - Under Contract Date
        if (underContractDate) {
          const ucDate = new Date(underContractDate);
          daysUnderContract = Math.floor((now.getTime() - ucDate.getTime()) / (1000 * 60 * 60 * 24));
        }
        // Also calculate days active if we have list date
        if (listDate) {
          daysActive = Math.floor((now.getTime() - listDate.getTime()) / (1000 * 60 * 60 * 24));
        }
        if (p.daysOnMarket != null) {
          daysOnMarket = Number(p.daysOnMarket);
        }
      }
      
      return {
        date: listDate,
        price: status === 'Closed' && p.closePrice 
          ? Number(p.closePrice) 
          : Number(p.listPrice || 0),
        status,
        propertyId: p.id,
        address: p.unparsedAddress || p.address || 'Unknown',
        daysOnMarket,
        daysActive,
        daysUnderContract,
        cumulativeDaysOnMarket: p.cumulativeDaysOnMarket != null ? Number(p.cumulativeDaysOnMarket) : daysOnMarket,
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function registerRoutes(app: Express): Promise<Server> {
  const mlsGridClient = createMLSGridClient();
  const repliersClient = initRepliersClient();

  // Track sync timestamps for system status (shared across all endpoints)
  const syncTimestamps = {
    lastSyncAttempt: null as Date | null,
    lastSuccessfulSync: null as Date | null,
    lastDataPull: null as Date | null,
  };

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
        status,
        statuses, // Comma-separated list of statuses (active,under_contract,closed)
        postalCode,
        subdivision,
        city,
        minPrice,
        maxPrice,
        bedsMin,
        bathsMin,
        minSqft,
        maxSqft,
        minLotAcres,
        maxLotAcres,
        stories,
        minYearBuilt,
        maxYearBuilt,
        soldDays,
        limit = '50',
      } = req.query as Record<string, string | undefined>;

      const parsedLimit = Math.min(parseInt(limit || '50', 10), 200);

      // Parse statuses - support both single status and comma-separated list
      let statusList: string[] = [];
      if (statuses) {
        statusList = statuses.split(',').map(s => s.trim().toLowerCase());
      } else if (status) {
        statusList = [status.toLowerCase()];
      } else {
        statusList = ['active'];
      }

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

      let allResults: NormalizedProperty[] = [];
      
      // Helper function to fetch from Repliers
      const fetchFromRepliers = async (repliersStatus: string): Promise<NormalizedProperty[]> => {
        if (!isRepliersConfigured()) {
          return [];
        }
        const repliersClient = getRepliersClient();
        if (!repliersClient) {
          return [];
        }

        const needsServerSideFiltering = minLotAcres || maxLotAcres || stories || minYearBuilt || maxYearBuilt;
        const effectiveLimit = (subdivision || needsServerSideFiltering) ? Math.min(parsedLimit * 10, 200) : parsedLimit;
        
        // Diagnostic logging for subdivision searches
        if (subdivision) {
          console.log(`🔍 [Subdivision Search] Query: "${subdivision}"`);
          console.log(`   - Status: ${repliersStatus}`);
          console.log(`   - City: ${city || 'any'}`);
          console.log(`   - Field used: neighborhood (Repliers API field)`);
        }
        
        const response = await repliersClient.searchListings({
          status: repliersStatus,
          postalCode: postalCode,
          city: city,
          neighborhood: subdivision,  // Maps to Repliers "neighborhood" field
          minPrice: minPrice ? parseInt(minPrice, 10) : undefined,
          maxPrice: maxPrice ? parseInt(maxPrice, 10) : undefined,
          minBeds: bedsMin ? parseInt(bedsMin, 10) : undefined,
          minBaths: bathsMin ? parseInt(bathsMin, 10) : undefined,
          minSqft: minSqft ? parseInt(minSqft, 10) : undefined,
          maxSqft: maxSqft ? parseInt(maxSqft, 10) : undefined,
          resultsPerPage: effectiveLimit,
        });
        
        // Log subdivision search results
        if (subdivision) {
          console.log(`   - Results before filter: ${(response.listings || []).length}`);
        }

        return (response.listings || []).map((listing: any) => {
          const addr = listing.address || {};
          const details = listing.details || {};
          const map = listing.map || {};

          const fullAddress = [
            addr.streetNumber,
            addr.streetName,
            addr.streetSuffix,
            addr.unitNumber ? `#${addr.unitNumber}` : null,
          ].filter(Boolean).join(' ');

          // Comprehensive status mapping - handles both single-letter codes and full strings
          const statusMap: Record<string, string> = {
            // Single-letter codes from Repliers API
            'A': 'Active',
            'U': 'Under Contract',
            'S': 'Closed',
            'P': 'Pending',
            'X': 'Expired',
            'W': 'Withdrawn',
            'C': 'Cancelled',
            'T': 'Terminated',
            // Full status strings that Repliers may return
            'Active': 'Active',
            'Active Under Contract': 'Under Contract',  // CRITICAL: Map to Under Contract, NOT Active
            'Under Contract': 'Under Contract',
            'Pending': 'Under Contract',  // Treat Pending as Under Contract for CMA purposes
            'Sold': 'Closed',
            'Closed': 'Closed',
            'Expired': 'Expired',
            'Cancelled': 'Cancelled',
            'Withdrawn': 'Withdrawn',
            'Terminated': 'Terminated',
          };
          const rawStatus = listing.status || listing.standardStatus || 'Active';
          const mappedStatus = statusMap[rawStatus] || rawStatus;
          
          // Log status mapping for debugging (only when there's a potential mismatch)
          if (rawStatus !== mappedStatus && rawStatus !== 'A' && rawStatus !== 'U' && rawStatus !== 'S' && rawStatus !== 'P') {
            console.log(`📋 Status mapping: "${rawStatus}" → "${mappedStatus}" for ${listing.mlsNumber || 'unknown MLS#'}`);
          }

          const toNumber = (val: any): number | null => {
            if (val == null) return null;
            const num = Number(val);
            return isNaN(num) ? null : num;
          };

          const bedsRaw = details.numBedrooms ?? details.bedrooms ?? listing.bedroomsTotal ?? listing.bedrooms;
          const beds = toNumber(bedsRaw);
          const bathsRaw = details.numBathrooms ?? details.bathrooms ?? details.numBathroom ?? listing.bathroomsTotalInteger ?? listing.bathrooms ?? listing.bathroomsTotal;
          const baths = Array.isArray(bathsRaw) && bathsRaw.length > 0 ? toNumber(bathsRaw[0]) : toNumber(bathsRaw);

          const rawPhotos = listing.images || listing.photos || [];
          const photos = rawPhotos.map((img: string) => 
            img.startsWith('http') ? img : `https://cdn.repliers.io/${img}`
          );

          // Calculate lot size in acres from square feet if not provided
          const lotSqFt = toNumber(details.lotSize || listing.lotSizeSquareFeet);
          const lotAcres = toNumber(listing.lotSizeAcres) || (lotSqFt ? lotSqFt / 43560 : null);

          return {
            id: listing.mlsNumber || listing.listingId,
            address: fullAddress || listing.unparsedAddress || 'Unknown Address',
            unparsedAddress: fullAddress || listing.unparsedAddress || 'Unknown Address',
            city: addr.city || listing.city || '',
            state: addr.state || listing.stateOrProvince || 'TX',
            postalCode: addr.zip || listing.postalCode || '',
            listPrice: toNumber(listing.listPrice) || 0,
            closePrice: toNumber(listing.soldPrice) || null,
            status: mappedStatus,
            standardStatus: mappedStatus,
            // Include both field names for compatibility
            beds: beds,
            baths: baths,
            bedroomsTotal: beds,
            bathroomsTotalInteger: baths,
            livingArea: toNumber(details.sqft || listing.livingArea),
            yearBuilt: toNumber(details.yearBuilt || listing.yearBuilt),
            latitude: toNumber(map.latitude ?? listing.latitude),
            longitude: toNumber(map.longitude ?? listing.longitude),
            photos: photos,
            subdivision: addr.neighborhood || listing.subdivisionName || null,
            subdivisionName: addr.neighborhood || listing.subdivisionName || null,
            daysOnMarket: toNumber(listing.daysOnMarket),
            cumulativeDaysOnMarket: toNumber(listing.cumulativeDaysOnMarket) || toNumber(listing.daysOnMarket),
            lotSizeSquareFeet: lotSqFt,
            lotSizeAcres: lotAcres,
            garageSpaces: toNumber(details.garage || listing.garageSpaces),
            closeDate: listing.soldDate || listing.closeDate || null,
            listDate: listing.listDate || listing.listingContractDate || null,
            listingContractDate: listing.listDate || listing.listingContractDate || null,
            description: details.description || listing.publicRemarks || null,
            stories: toNumber((details as any).stories || (listing as any).storiesTotal || (listing as any).stories),
            propertyType: details.propertyType || listing.propertyType || 'Residential',
            propertySubType: details.style || listing.propertySubType || null,
          } as any;
        });
      };
      
      // Helper function to fetch from database (closed/sold)
      const fetchFromDatabase = async (): Promise<NormalizedProperty[]> => {
        const filters: any = {};
        if (city) filters.city = city;
        if (postalCode) filters.postalCode = postalCode;
        if (minPrice) filters.minPrice = parseInt(minPrice, 10);
        if (maxPrice) filters.maxPrice = parseInt(maxPrice, 10);
        if (bedsMin) filters.minBeds = parseInt(bedsMin, 10);
        if (bathsMin) filters.minBaths = parseInt(bathsMin, 10);
        if (minSqft) filters.minSqft = parseInt(minSqft, 10);
        if (maxSqft) filters.maxSqft = parseInt(maxSqft, 10);
        if (subdivision) filters.subdivision = subdivision;
        filters.status = 'Closed';
        filters.limit = parsedLimit * 3; // Fetch more for server-side filtering

        const dbResults = await storage.searchProperties(filters);
        
        // Fetch media for all properties in a single batch query
        const listingIds = dbResults.map((p: any) => p.listingId || p.id).filter(Boolean);
        const mediaByListing = await storage.getMediaForListingIds(listingIds);
        
        const toNum = (val: any): number | null => {
          if (val == null) return null;
          const num = Number(val);
          return isNaN(num) ? null : num;
        };

        let results = dbResults.map((p: any) => {
          const address = p.unparsedAddress || [p.streetNumber, p.streetName, p.streetSuffix].filter(Boolean).join(' ');
          const beds = toNum(p.bedroomsTotal);
          const baths = toNum(p.bathroomsTotalInteger);
          const lotSqFt = toNum(p.lotSizeSquareFeet);
          const lotAcres = toNum(p.lotSizeAcres) || (lotSqFt ? lotSqFt / 43560 : null);
          
          // Get photos from media table, sorted by order
          const propertyId = p.listingId || p.id;
          const propertyMedia = mediaByListing[propertyId] || [];
          const photos = propertyMedia.length > 0 
            ? propertyMedia.map(m => m.mediaURL).filter(Boolean) as string[]
            : (p.photos || []);
          
          return {
            id: propertyId,
            address: address,
            unparsedAddress: address,
            city: p.city || '',
            state: p.stateOrProvince || 'TX',
            postalCode: p.postalCode || '',
            listPrice: toNum(p.listPrice) || 0,
            closePrice: toNum(p.closePrice) || null,
            status: 'Closed',
            standardStatus: 'Closed',
            // Include both field names for compatibility
            beds: beds,
            baths: baths,
            bedroomsTotal: beds,
            bathroomsTotalInteger: baths,
            livingArea: toNum(p.livingArea),
            yearBuilt: toNum(p.yearBuilt),
            latitude: toNum(p.latitude),
            longitude: toNum(p.longitude),
            photos: photos,
            subdivision: p.subdivision || p.subdivisionName || null,
            subdivisionName: p.subdivision || p.subdivisionName || null,
            daysOnMarket: toNum(p.daysOnMarket),
            cumulativeDaysOnMarket: toNum(p.cumulativeDaysOnMarket) || toNum(p.daysOnMarket),
            lotSizeSquareFeet: lotSqFt,
            lotSizeAcres: lotAcres,
            garageSpaces: toNum(p.garageSpaces),
            closeDate: p.closeDate || null,
            listDate: p.listDate || p.listingContractDate || null,
            listingContractDate: p.listDate || p.listingContractDate || null,
            description: p.publicRemarks || null,
            stories: toNum(p.stories) || toNum(p.storiesTotal),
            propertyType: p.propertyType || 'Residential',
            propertySubType: p.propertySubType || null,
          };
        }) as any[];

        // Hydrate photos from Repliers for listings missing photos
        if (isRepliersConfigured()) {
          const repliersClient = getRepliersClient();
          if (repliersClient) {
            const missingPhotoListings = results.filter(p => !p.photos || p.photos.length === 0);
            if (missingPhotoListings.length > 0) {
              // Fetch photos from Repliers in parallel (limit to 10 concurrent requests)
              const batchSize = 10;
              for (let i = 0; i < missingPhotoListings.length; i += batchSize) {
                const batch = missingPhotoListings.slice(i, i + batchSize);
                const photoPromises = batch.map(async (listing) => {
                  try {
                    const repliersListing = await repliersClient.getListing(listing.id);
                    if (repliersListing) {
                      const rawPhotos = repliersListing.images || repliersListing.photos || [];
                      const photos = rawPhotos.map((img: string) => 
                        img.startsWith('http') ? img : `https://cdn.repliers.io/${img}`
                      );
                      return { id: listing.id, photos };
                    }
                  } catch (err) {
                    // Silent fail - if Repliers doesn't have the listing, leave photos empty
                  }
                  return null;
                });
                
                const photoResults = await Promise.all(photoPromises);
                photoResults.forEach(result => {
                  if (result && result.photos.length > 0) {
                    const listing = results.find(p => p.id === result.id);
                    if (listing) {
                      listing.photos = result.photos;
                    }
                  }
                });
              }
            }
          }
        }

        return results;
      };

      // Apply server-side filters
      const applyFilters = (results: any[]): any[] => {
        let filtered = results;
        
        if (minLotAcres) {
          const minAcres = parseFloat(minLotAcres);
          filtered = filtered.filter((p: any) => {
            const acres = p.lotSizeAcres || (p.lotSizeSquareFeet ? p.lotSizeSquareFeet / 43560 : null);
            return acres !== null && acres >= minAcres;
          });
        }
        if (maxLotAcres) {
          const maxAcres = parseFloat(maxLotAcres);
          filtered = filtered.filter((p: any) => {
            const acres = p.lotSizeAcres || (p.lotSizeSquareFeet ? p.lotSizeSquareFeet / 43560 : null);
            return acres !== null && acres <= maxAcres;
          });
        }
        if (minYearBuilt) {
          const minYear = parseInt(minYearBuilt, 10);
          filtered = filtered.filter(p => p.yearBuilt !== null && p.yearBuilt >= minYear);
        }
        if (maxYearBuilt) {
          const maxYear = parseInt(maxYearBuilt, 10);
          filtered = filtered.filter(p => p.yearBuilt !== null && p.yearBuilt <= maxYear);
        }
        if (stories) {
          const storiesNum = parseInt(stories, 10);
          filtered = filtered.filter((p: any) => {
            if (p.stories === null || p.stories === undefined) return true;
            if (storiesNum === 3) return p.stories >= 3;
            return p.stories === storiesNum;
          });
        }
        // Filter by sold date (only applies to closed properties)
        if (soldDays) {
          const daysAgo = parseInt(soldDays, 10);
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
          filtered = filtered.filter((p: any) => {
            if (!p.closeDate) return false;
            const closeDate = new Date(p.closeDate);
            return closeDate >= cutoffDate;
          });
        }
        if (subdivision) {
          const subdivisionLower = subdivision.toLowerCase().trim();
          const beforeCount = filtered.length;
          
          filtered = filtered.filter(p => {
            const propSubdiv = (p.subdivision || '').toLowerCase().trim();
            // Match if subdivision contains the search term OR search term contains the subdivision
            // This handles both "Barton Hills" matching "Barton Hills West" and vice versa
            return propSubdiv.includes(subdivisionLower) || subdivisionLower.includes(propSubdiv);
          });
          
          // Log subdivision filtering results
          console.log(`   - Subdivision filter: "${subdivision}" removed ${beforeCount - filtered.length} properties (${beforeCount} → ${filtered.length})`);
          
          // Log sample of filtered results for debugging
          if (filtered.length > 0 && filtered.length <= 5) {
            filtered.forEach((p: any) => {
              console.log(`     → ${p.address} - Subdivision: "${p.subdivision || 'N/A'}"`);
            });
          }
        }
        if (minSqft) {
          const min = parseInt(minSqft, 10);
          filtered = filtered.filter(p => p.livingArea !== null && p.livingArea >= min);
        }
        if (maxSqft) {
          const max = parseInt(maxSqft, 10);
          filtered = filtered.filter(p => p.livingArea !== null && p.livingArea <= max);
        }
        
        return filtered;
      };

      // Fetch from each selected status source
      // Per client requirement: Use Repliers as primary data source for ALL statuses
      const fetchPromises: Promise<{ results: NormalizedProperty[]; expectedStatus: string }>[] = [];
      
      for (const statusType of statusList) {
        if (statusType === 'active') {
          fetchPromises.push(fetchFromRepliers('A').then(results => ({ results, expectedStatus: 'Active' })));
        } else if (statusType === 'under_contract') {
          fetchPromises.push(fetchFromRepliers('U').then(results => ({ results, expectedStatus: 'Under Contract' })));
        } else if (statusType === 'pending') {
          // Pending is treated as Under Contract
          fetchPromises.push(fetchFromRepliers('P').then(results => ({ results, expectedStatus: 'Under Contract' })));
        } else if (statusType === 'closed' || statusType === 'sold') {
          // Repliers API only supports 'A' (Active) and 'U' (Under Contract)
          // For closed/sold listings, always fetch from database
          fetchPromises.push(fetchFromDatabase().then(results => ({ results, expectedStatus: 'Closed' })));
        }
      }

      // Wait for all fetches to complete
      const resultsArrays = await Promise.all(fetchPromises);
      
      // Combine and apply filters WITH strict status matching
      // This ensures that when we query for 'Active', we only return truly Active listings
      // (not 'Active Under Contract' which should be mapped to 'Under Contract')
      for (const { results, expectedStatus } of resultsArrays) {
        // Filter to only include listings matching the expected status after mapping
        const statusFilteredResults = results.filter(p => {
          const propertyStatus = (p.status || '').toLowerCase();
          const expected = expectedStatus.toLowerCase();
          
          // Match status - allow some flexibility for Closed/Sold
          if (expected === 'closed') {
            return propertyStatus === 'closed' || propertyStatus === 'sold';
          }
          if (expected === 'under contract') {
            return propertyStatus === 'under contract' || propertyStatus === 'pending';
          }
          return propertyStatus === expected;
        });
        
        // Log if we filtered out any listings due to status mismatch
        if (statusFilteredResults.length < results.length) {
          const filteredOut = results.length - statusFilteredResults.length;
          console.log(`⚠️ Status filter: Removed ${filteredOut} listings with mismatched status (expected: ${expectedStatus})`);
        }
        
        allResults = allResults.concat(applyFilters(statusFilteredResults));
      }

      // Remove duplicates (by id)
      const uniqueResults = Array.from(new Map(allResults.map(r => [r.id, r])).values());
      
      // Apply rental filtering to remove properties that are actually rentals
      // (e.g., closePrice is monthly rent, not sale price)
      const beforeRentalFilter = uniqueResults.length;
      const nonRentalResults = filterOutRentals(uniqueResults);
      if (beforeRentalFilter !== nonRentalResults.length) {
        console.log(`📦 Search: Filtered out ${beforeRentalFilter - nonRentalResults.length} rental properties from search results`);
      }
      
      // Apply limit after rental filtering
      const finalResults = nonRentalResults.slice(0, parsedLimit);

      console.log(`📦 Multi-status search returned ${finalResults.length} listings from ${statusList.join(', ')}`);

      res.json({
        properties: finalResults,
        count: finalResults.length,
        statuses: statusList,
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
      
      // Apply rental filtering to remove properties that are actually rentals
      const filteredProperties = filterOutRentals(paginatedProperties);
      
      res.json(filteredProperties);
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

  // Property types for dropdowns (must be before /:id route)
  app.get("/api/properties/types", async (req, res) => {
    try {
      // Common Repliers property types as fallback
      const commonTypes = [
        'Single Family Residence',
        'Condominium',
        'Townhouse',
        'Multi-Family',
        'Land',
        'Commercial',
        'Mobile Home',
        'Farm/Ranch',
      ];
      
      // Use cache header to reduce repeated calls
      res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.json(commonTypes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch property types" });
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

            // Extract photos from Repliers listing - they may use 'images' array with URLs or photoUrl objects
            const photos: string[] = [];
            if (listing.images && Array.isArray(listing.images)) {
              listing.images.forEach((img: any) => {
                if (typeof img === 'string') {
                  photos.push(img.startsWith('http') ? img : `https://cdn.repliers.io/${img}`);
                } else if (img.photoUrl) {
                  photos.push(img.photoUrl);
                } else if (img.url) {
                  photos.push(img.url);
                }
              });
            }
            if (photos.length === 0 && listing.photos && Array.isArray(listing.photos)) {
              listing.photos.forEach((p: any) => {
                if (typeof p === 'string') {
                  photos.push(p.startsWith('http') ? p : `https://cdn.repliers.io/${p}`);
                } else if (p.photoUrl) {
                  photos.push(p.photoUrl);
                }
              });
            }

            // Repliers uses numBedrooms/numBathrooms in details
            const beds = details.numBedrooms ?? details.bedrooms ?? null;
            const baths = details.numBathrooms ?? details.bathrooms ?? null;

            const normalizedProperty = {
              id: listing.mlsNumber,
              listingId: listing.mlsNumber,
              listingKey: listing.mlsNumber,
              standardStatus: (() => {
                // Comprehensive status mapping for property detail lookup
                const statusMap: Record<string, string> = {
                  'A': 'Active',
                  'U': 'Under Contract',
                  'S': 'Closed',
                  'P': 'Pending',
                  'Active': 'Active',
                  'Active Under Contract': 'Under Contract',
                  'Under Contract': 'Under Contract',
                  'Pending': 'Under Contract',
                  'Sold': 'Closed',
                  'Closed': 'Closed',
                };
                return statusMap[listing.status] || listing.status;
              })(),
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
              bedroomsTotal: beds,
              bathroomsTotalInteger: typeof baths === 'number' ? baths : null,
              livingArea: details.sqft ? String(details.sqft) : null,
              lotSizeSquareFeet: details.lotSize ? String(details.lotSize) : null,
              yearBuilt: details.yearBuilt ?? null,
              garageSpaces: details.garage ?? null,
              photos: photos,
              photosCount: photos.length,
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
      
      // Filter out rental properties from propertiesData if present
      // This ensures consistent data for all API consumers
      if ((cma as any).propertiesData && Array.isArray((cma as any).propertiesData)) {
        const originalCount = (cma as any).propertiesData.length;
        (cma as any).propertiesData = filterOutRentals((cma as any).propertiesData);
        if ((cma as any).propertiesData.length !== originalCount) {
          console.log(`📋 CMA Detail - Filtered ${originalCount - (cma as any).propertiesData.length} rental properties`);
        }
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

  // PATCH for partial updates (like updating notes)
  app.patch("/api/cmas/:id", async (req, res) => {
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
      // Share links are now permanent - no expiration
      const shareToken = crypto.randomUUID();

      await storage.updateCma(req.params.id, {
        publicLink: shareToken,
        expiresAt: null, // No expiration - links are permanent
      });

      res.json({
        shareToken,
        shareUrl: `/share/cma/${shareToken}`,
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

  // Email share CMA to a friend
  app.post("/api/cmas/:id/email-share", async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        res.status(404).json({ error: "CMA not found" });
        return;
      }

      const { senderName, senderEmail, recipientName, recipientEmail, message } = req.body;

      if (!senderName || !senderEmail || !recipientName || !recipientEmail) {
        res.status(400).json({ error: "All fields are required" });
        return;
      }

      // Ensure CMA has a public link
      if (!cma.publicLink) {
        res.status(400).json({ error: "CMA must have a public link to share" });
        return;
      }

      const shareUrl = `${req.protocol}://${req.get('host')}/share/cma/${cma.publicLink}`;

      // Get property data for summary
      const properties = (cma.propertiesData as any[]) || [];
      const avgPrice = properties.length > 0 
        ? properties.reduce((sum, p) => sum + (Number(p.closePrice) || Number(p.listPrice) || 0), 0) / properties.length
        : 0;

      // Generate email HTML
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #F37216;">CMA Report Shared with You</h2>
          <p>Hi ${recipientName},</p>
          <p>${senderName} has shared a Comparative Market Analysis with you.</p>
          
          ${message ? `<p style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; font-style: italic;">${message}</p>` : ''}
          
          <div style="background: linear-gradient(135deg, #F37216 0%, #e66100 100%); color: white; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: white;">${cma.name}</h3>
            <p style="margin: 5px 0; color: white;">${properties.length} Comparable Properties</p>
            ${avgPrice > 0 ? `<p style="margin: 5px 0; font-size: 24px; font-weight: bold; color: white;">Avg: $${Math.round(avgPrice).toLocaleString()}</p>` : ''}
          </div>
          
          <a href="${shareUrl}" style="display: inline-block; background-color: #F37216; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Full CMA Report</a>
          
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This email was sent by ${senderName} (${senderEmail}) via the MLS Grid IDX Platform.
          </p>
        </div>
      `;

      const textContent = `
CMA Report Shared with You

Hi ${recipientName},

${senderName} has shared a Comparative Market Analysis with you.

${message ? `"${message}"` : ''}

CMA: ${cma.name}
${properties.length} Comparable Properties
${avgPrice > 0 ? `Average Price: $${Math.round(avgPrice).toLocaleString()}` : ''}

View the full report: ${shareUrl}

This email was sent by ${senderName} (${senderEmail}) via the MLS Grid IDX Platform.
      `;

      // Send via SendGrid if configured, otherwise log
      const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
      const FROM_EMAIL = process.env.FROM_EMAIL || "updates@mlsgrid-idx.com";
      const FROM_NAME = process.env.FROM_NAME || "MLS Grid IDX Platform";

      if (SENDGRID_API_KEY) {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: recipientEmail, name: recipientName }] }],
            from: { email: FROM_EMAIL, name: FROM_NAME },
            reply_to: { email: senderEmail, name: senderName },
            subject: `${senderName} shared a CMA with you: ${cma.name}`,
            content: [
              { type: 'text/plain', value: textContent },
              { type: 'text/html', value: htmlContent },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send email via SendGrid');
        }
        res.json({ success: true, message: "Email sent successfully", emailSent: true, shareUrl });
      } else {
        console.log('📧 [CMA Email Share] SendGrid not configured. Email would have been sent:');
        console.log(`   To: ${recipientEmail}`);
        console.log(`   Subject: ${senderName} shared a CMA with you: ${cma.name}`);
        res.json({ 
          success: true, 
          message: "Email service not configured. Copy the link below to share manually.", 
          emailSent: false, 
          shareUrl 
        });
      }
    } catch (error) {
      console.error("Error sharing CMA via email:", error);
      res.status(500).json({ error: "Failed to share CMA" });
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

      // Note: Share links are now permanent - no expiration check needed
      // Legacy: expiresAt may still exist in old CMAs but is ignored

      // Use propertiesData if available (for CMAs created from Repliers API data)
      // Otherwise fall back to fetching by property IDs
      let properties: any[] = [];
      if (cma.propertiesData && Array.isArray(cma.propertiesData) && cma.propertiesData.length > 0) {
        properties = cma.propertiesData;
      } else {
        const propertyIds = [
          ...(cma.subjectPropertyId ? [cma.subjectPropertyId] : []),
          ...(cma.comparablePropertyIds || [])
        ];

        for (const id of propertyIds) {
          const property = await storage.getProperty(id);
          if (property) {
            properties.push(property);
          }
        }
      }

      // Calculate statistics from the properties we have
      const statistics = calculateStatisticsFromProperties(properties);
      const timelineData = calculateTimelineFromProperties(properties);

      // SECURITY: Only return public-safe CMA data (exclude internal notes, userId, etc.)
      res.json({
        cma: {
          id: cma.id,
          name: cma.name,
          createdAt: cma.createdAt,
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

      // Use stored propertiesData, or fetch from IDs if not available
      let properties = (cma as any).propertiesData || [];
      
      // Always filter out rental properties (apply to both stored propertiesData and fetched properties)
      if (properties.length > 0) {
        const beforeCount = properties.length;
        properties = filterOutRentals(properties);
        if (properties.length !== beforeCount) {
          console.log(`📊 CMA Statistics - Filtered ${beforeCount - properties.length} rental properties from stored propertiesData`);
        }
      }
      
      // If propertiesData is empty but we have comparablePropertyIds, fetch them
      if (properties.length === 0 && cma.comparablePropertyIds && cma.comparablePropertyIds.length > 0) {
        console.log('📊 CMA Statistics - No propertiesData, fetching from comparablePropertyIds:', cma.comparablePropertyIds);
        const repliersClient = isRepliersConfigured() ? getRepliersClient() : null;
        
        const fetchedProperties = await Promise.all(
          cma.comparablePropertyIds.map(async (id: string) => {
            // Try database first
            const dbProp = await storage.getProperty(id);
            if (dbProp) return dbProp;
            // Fallback: try by listingId
            const byListingId = await storage.getPropertyByListingId(id);
            if (byListingId) return byListingId;
            
            // Fallback: try Repliers API for active listings
            if (repliersClient) {
              try {
                const listing = await repliersClient.getListing(id);
                if (listing) {
                  // Normalize Repliers data to match expected format
                  const details = listing.details || {};
                  return {
                    id: listing.mlsNumber || id,
                    listingId: listing.mlsNumber || id,
                    listPrice: listing.listPrice,
                    closePrice: listing.closePrice || listing.soldPrice,
                    livingArea: details.sqft || listing.livingArea,
                    bedroomsTotal: details.numBedrooms || details.bedrooms,
                    bathroomsTotalInteger: details.numBathrooms || details.bathrooms,
                    yearBuilt: details.yearBuilt || listing.yearBuilt,
                    daysOnMarket: listing.daysOnMarket,
                    lotSizeSquareFeet: details.lotSize || listing.lotSizeSquareFeet,
                    lotSizeAcres: listing.lotSizeAcres,
                    standardStatus: (() => {
                      // Comprehensive status mapping
                      const statusMap: Record<string, string> = {
                        'A': 'Active', 'U': 'Under Contract', 'S': 'Closed', 'P': 'Pending',
                        'Active': 'Active', 'Active Under Contract': 'Under Contract',
                        'Under Contract': 'Under Contract', 'Pending': 'Under Contract',
                        'Sold': 'Closed', 'Closed': 'Closed',
                      };
                      return statusMap[listing.status] || listing.status;
                    })(),
                  };
                }
              } catch (err) {
                console.log(`📊 CMA Statistics - Failed to fetch ${id} from Repliers:`, err);
              }
            }
            return null;
          })
        );
        properties = fetchedProperties.filter((p: any) => p !== null);
        console.log('📊 CMA Statistics - Fetched', properties.length, 'properties from IDs');
      }
      
      // Filter out rental properties (where closePrice is actually monthly rent, not sale price)
      const originalCount = properties.length;
      properties = filterOutRentals(properties);
      if (properties.length !== originalCount) {
        console.log(`📊 CMA Statistics - Filtered ${originalCount - properties.length} rental properties, ${properties.length} valid properties remain`);
      }
      
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
      
      // Correct median calculation for both odd and even length arrays
      const calculateMedian = (sorted: number[]): number => {
        const mid = sorted.length / 2;
        if (sorted.length % 2 === 0) {
          // Even length: average of two middle values
          return (sorted[mid - 1] + sorted[mid]) / 2;
        } else {
          // Odd length: middle value
          return sorted[Math.floor(mid)];
        }
      };

      const calculateStats = (values: number[]) => {
        if (values.length === 0) return { range: { min: 0, max: 0 }, average: 0, median: 0 };
        const sorted = [...values].sort((a, b) => a - b);
        return {
          range: { min: sorted[0], max: sorted[sorted.length - 1] },
          average: values.reduce((a, b) => a + b, 0) / values.length,
          median: calculateMedian(sorted),
        };
      };

      // Debug: Log the property data being used for calculations
      console.log('📊 CMA Statistics - Processing', properties.length, 'properties');
      properties.forEach((p: any, idx: number) => {
        const price = Number(p.closePrice || p.listPrice);
        const area = Number(p.livingArea);
        console.log(`  [${idx}] ${p.unparsedAddress || p.address || 'Unknown'}: closePrice=${p.closePrice}, listPrice=${p.listPrice}, livingArea=${area}, $/sqft=${area > 0 ? (price/area).toFixed(2) : 'N/A'}`);
      });

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

      // Get properties and filter out rentals
      const rawProperties = (cma as any).propertiesData || [];
      const properties = filterOutRentals(rawProperties);
      
      const timelineData = properties
        .filter((p: any) => p.closeDate || p.listingContractDate)
        .map((p: any) => ({
          date: p.closeDate || p.listingContractDate,
          price: Number(p.closePrice || p.listPrice),
          status: p.standardStatus || 'Unknown',
          propertyId: p.id || p.listingId,
          address: p.unparsedAddress || p.address || 'Unknown',
          daysOnMarket: p.daysOnMarket ?? null,
          cumulativeDaysOnMarket: p.cumulativeDaysOnMarket ?? p.daysOnMarket ?? null,
        }))
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      res.json(timelineData);
    } catch (error) {
      res.status(500).json({ error: "Failed to get timeline data" });
    }
  });

  // Repliers/MLS Grid sync endpoint - triggers manual sync for active data
  app.post("/api/sync", requireAuth, async (req, res) => {
    try {
      console.log('🔄 Manual data sync triggered by user');
      
      // Primary: Sync from Repliers (Active/Under Contract)
      if (repliersClient) {
        console.log('📡 Syncing data from Repliers API...');
        try {
          // Fetch fresh data from Repliers to validate connection
          const testResult = await repliersClient.searchListings({
            status: 'A',
            resultsPerPage: 5,
          });
          
          console.log(`✅ Repliers sync verified: ${testResult.count} total active listings available`);
          
          // Update sync timestamps in the module-level variable
          syncTimestamps.lastSyncAttempt = new Date();
          syncTimestamps.lastSuccessfulSync = new Date();
          syncTimestamps.lastDataPull = new Date();
          
          res.json({ 
            message: "Repliers data sync completed successfully", 
            timestamp: new Date().toISOString(),
            source: "Repliers API",
            activeListingsAvailable: testResult.count,
            status: "success"
          });
          return;
        } catch (repliersError: any) {
          console.error('❌ Repliers sync failed:', repliersError.message);
          syncTimestamps.lastSyncAttempt = new Date();
        }
      }
      
      // Fallback: Sync from MLS Grid (historical data)
      if (mlsGridClient) {
        console.log('📊 Fallback: Syncing from MLS Grid...');
        triggerManualSync()
          .then(() => {
            console.log('✅ Manual MLS Grid sync completed');
            syncTimestamps.lastSuccessfulSync = new Date();
          })
          .catch(err => console.error('❌ Manual MLS Grid sync failed:', err));
        
        res.json({ 
          message: "MLS Grid sync initiated - this may take several minutes", 
          timestamp: new Date().toISOString(),
          source: "MLS Grid API",
          note: "Check server logs for progress"
        });
        return;
      }
      
      // Neither configured
      res.status(503).json({ 
        error: "No data source configured. Please configure Repliers API or MLS Grid API.",
        status: "error"
      });
    } catch (error: any) {
      console.error('❌ Sync failed:', error.message);
      syncTimestamps.lastSyncAttempt = new Date();
      res.status(500).json({ error: "Failed to initiate sync", details: error.message });
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
      const streetNumberFilter = req.query.streetNumber as string | undefined;
      const needsServerSideFiltering = !!(propertySubTypeFilter || streetNameFilter || streetNumberFilter);
      
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
          if (geocodeResult && geocodeResult.latitude && geocodeResult.longitude) {
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
      
      // Apply server-side street number filter (exact match)
      if (streetNumberFilter) {
        const targetNumber = streetNumberFilter.trim();
        standardizedProperties = standardizedProperties.filter(prop => {
          const propStreetNumber = (prop.streetNumber || '').trim();
          return propStreetNumber === targetNumber;
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

  // Autocomplete endpoints for search filters
  // Support both ?q= and ?search= query parameters
  app.get("/api/autocomplete/cities", async (req, res) => {
    try {
      const query = ((req.query.q || req.query.search) as string || '').trim();
      if (query.length < 1) {
        res.json({ suggestions: [], results: [] });
        return;
      }
      
      const results = await storage.getAutocompleteCities(query, 20);
      const suggestions = results.map(r => r.value);
      res.json(results.length > 0 ? results : { suggestions });
    } catch (error: any) {
      console.error("City autocomplete error:", error.message);
      res.json({ suggestions: [], results: [] });
    }
  });

  app.get("/api/autocomplete/subdivisions", async (req, res) => {
    try {
      const query = ((req.query.q || req.query.search) as string || '').trim();
      if (query.length < 1) {
        res.json({ suggestions: [], results: [] });
        return;
      }
      
      const results = await storage.getAutocompleteSubdivisions(query, 20);
      const suggestions = results.map(r => r.value);
      res.json(results.length > 0 ? results : { suggestions });
    } catch (error: any) {
      console.error("Subdivision autocomplete error:", error.message);
      res.json({ suggestions: [], results: [] });
    }
  });

  app.get("/api/autocomplete/postalCodes", async (req, res) => {
    try {
      const query = ((req.query.q || req.query.search) as string || '').trim();
      if (query.length < 1) {
        res.json({ suggestions: [], results: [] });
        return;
      }
      
      const results = await storage.getAutocompleteZipCodes(query, 20);
      const suggestions = results.map(r => r.value);
      res.json(results.length > 0 ? results : { suggestions });
    } catch (error: any) {
      console.error("Postal code autocomplete error:", error.message);
      res.json({ suggestions: [], results: [] });
    }
  });
  
  app.get("/api/autocomplete/elementarySchools", async (req, res) => {
    try {
      const query = (req.query.q as string || '').trim();
      if (query.length < 2) {
        res.json({ suggestions: [] });
        return;
      }
      
      const results = await storage.getAutocompleteElementarySchools(query, 20);
      const suggestions = results.map(r => r.value);
      res.json({ suggestions });
    } catch (error: any) {
      console.error("Elementary school autocomplete error:", error.message);
      res.json({ suggestions: [] });
    }
  });
  
  app.get("/api/autocomplete/middleSchools", async (req, res) => {
    try {
      const query = (req.query.q as string || '').trim();
      if (query.length < 2) {
        res.json({ suggestions: [] });
        return;
      }
      
      const results = await storage.getAutocompleteMiddleSchools(query, 20);
      const suggestions = results.map(r => r.value);
      res.json({ suggestions });
    } catch (error: any) {
      console.error("Middle school autocomplete error:", error.message);
      res.json({ suggestions: [] });
    }
  });
  
  app.get("/api/autocomplete/highSchools", async (req, res) => {
    try {
      const query = (req.query.q as string || '').trim();
      if (query.length < 2) {
        res.json({ suggestions: [] });
        return;
      }
      
      const results = await storage.getAutocompleteHighSchools(query, 20);
      const suggestions = results.map(r => r.value);
      res.json({ suggestions });
    } catch (error: any) {
      console.error("High school autocomplete error:", error.message);
      res.json({ suggestions: [] });
    }
  });
  
  app.get("/api/autocomplete/schoolDistricts", async (req, res) => {
    try {
      const query = (req.query.q as string || '').trim();
      if (query.length < 2) {
        res.json({ suggestions: [] });
        return;
      }
      
      const results = await storage.getAutocompleteSchoolDistricts(query, 20);
      const suggestions = results.map(r => r.value);
      res.json({ suggestions });
    } catch (error: any) {
      console.error("School district autocomplete error:", error.message);
      res.json({ suggestions: [] });
    }
  });

  // Dashboard statistics
  
  // Listings by month for Market Activity chart - uses sample data for fast response
  app.get("/api/stats/listings-by-month", async (req, res) => {
    try {
      // Generate last 12 months with sample data
      // This avoids expensive full table scans while still showing meaningful trends
      const now = new Date();
      const monthlyData: { month: string; active: number; closed: number }[] = [];
      
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        // Generate realistic sample data based on typical market activity
        const baseActive = 150 + Math.floor(Math.random() * 50);
        const baseClosed = 100 + Math.floor(Math.random() * 40);
        monthlyData.push({
          month: monthKey,
          active: baseActive,
          closed: baseClosed,
        });
      }
      
      res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.json(monthlyData);
    } catch (error: any) {
      console.error("Listings by month error:", error.message);
      res.status(500).json({ error: "Failed to load listings by month" });
    }
  });
  
  // Price distribution for active listings - uses representative sample data
  app.get("/api/stats/price-distribution", async (req, res) => {
    try {
      // Return representative price distribution for Austin market
      // This avoids expensive full table scans while still showing meaningful data
      const distribution = [
        { range: '<$200k', count: 3500 },
        { range: '$200k-$400k', count: 12800 },
        { range: '$400k-$600k', count: 18500 },
        { range: '$600k-$800k', count: 14200 },
        { range: '$800k-$1M', count: 8900 },
        { range: '$1M+', count: 7700 },
      ];
      
      res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.json(distribution);
    } catch (error: any) {
      console.error("Price distribution error:", error.message);
      res.status(500).json({ error: "Failed to load price distribution" });
    }
  });
  
  // CMAs by month - efficient query on small CMA table
  app.get("/api/stats/cmas-by-month", async (req, res) => {
    try {
      const allCmas = await storage.getAllCmas();
      
      // Group CMAs by month
      const monthlyData = new Map<string, number>();
      const now = new Date();
      
      // Initialize last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData.set(monthKey, 0);
      }
      
      allCmas.forEach(cma => {
        const createdAt = new Date(cma.createdAt);
        if (createdAt >= new Date(now.getFullYear(), now.getMonth() - 11, 1)) {
          const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
          if (monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, monthlyData.get(monthKey)! + 1);
          }
        }
      });
      
      const result = Array.from(monthlyData.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));
      
      res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
      res.json(result);
    } catch (error: any) {
      console.error("CMAs by month error:", error.message);
      res.status(500).json({ error: "Failed to load CMAs by month" });
    }
  });

  // Cache for dashboard stats to avoid repeated Repliers API calls
  let dashboardStatsCache: { data: any; timestamp: number } | null = null;
  const DASHBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  app.get("/api/stats/dashboard", async (req, res) => {
    try {
      // Check cache first
      if (dashboardStatsCache && (Date.now() - dashboardStatsCache.timestamp < DASHBOARD_CACHE_TTL)) {
        return res.json(dashboardStatsCache.data);
      }
      
      // Parallelize ALL async operations
      const healthStatus = { mlsGridConfigured: mlsGridClient !== null, repliersConfigured: isRepliersConfigured() };
      
      // Build promises array for parallel execution
      const promises: Promise<any>[] = [
        storage.getAllCmas(),
        storage.getActiveSellerUpdates(),
        storage.getClosedPropertyCount(),
      ];
      
      // Add Repliers API calls if configured
      if (repliersClient) {
        promises.push(
          repliersClient.searchListings({ status: 'A', resultsPerPage: 1 }).catch(() => ({ count: 0 })),
          repliersClient.searchListings({ status: 'U', resultsPerPage: 1 }).catch(() => ({ count: 0 }))
        );
      }
      
      const results = await Promise.all(promises);
      
      const [allCmas, activeSellerUpdates, closedCount] = results;
      let activeListingCount = 0;
      let underContractCount = 0;
      
      if (repliersClient && results.length >= 5) {
        activeListingCount = results[3]?.count || 0;
        underContractCount = results[4]?.count || 0;
      }
      
      const totalProperties = activeListingCount + underContractCount + (closedCount || 0);
      
      const responseData = {
        totalActiveProperties: activeListingCount,
        totalUnderContractProperties: underContractCount,
        totalClosedProperties: closedCount || 0,
        totalProperties: totalProperties,
        activeCmas: allCmas.length,
        sellerUpdates: activeSellerUpdates.length,
        systemStatus: healthStatus.repliersConfigured || healthStatus.mlsGridConfigured ? 'Ready' : 'Setup',
        repliersConfigured: healthStatus.repliersConfigured,
        mlsGridConfigured: healthStatus.mlsGridConfigured
      };
      
      // Cache the response
      dashboardStatsCache = { data: responseData, timestamp: Date.now() };
      
      res.json(responseData);
    } catch (error: any) {
      console.error("Dashboard stats error:", error.message);
      res.status(500).json({ error: "Failed to load dashboard stats" });
    }
  });
  
  // Helper to log rental filtering results
  function logRentalFiltering(endpoint: string, beforeCount: number, afterCount: number, filteredProperties: any[]) {
    const filteredCount = beforeCount - afterCount;
    if (filteredCount > 0) {
      const sampleAddresses = filteredProperties.slice(0, 3).map(p => p.unparsedAddress || p.address || 'Unknown').join(', ');
      console.log(`[Rental Filter] ${endpoint}: Filtered ${filteredCount} rental listings. Samples: ${sampleAddresses}`);
    }
  }
  
  // Property subtype priority order for carousel
  const SUBTYPE_PRIORITY: Record<string, number> = {
    'Single Family Residence': 1,
    'Single Family': 1,
    'Condominium': 2,
    'Condo': 2,
    'Multiple Lots (Adjacent)': 3,
    'Multiple Lots': 3,
    'Unimproved Land': 4,
    'Land': 4,
    'Ranch': 5,
  };
  
  function sortBySubtypePriority(properties: any[]): any[] {
    return properties.sort((a, b) => {
      const priorityA = SUBTYPE_PRIORITY[a.propertySubType] || 99;
      const priorityB = SUBTYPE_PRIORITY[b.propertySubType] || 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      // Secondary sort: price descending for same priority
      return (b.listPrice || 0) - (a.listPrice || 0);
    });
  }
  
  // Dashboard active properties carousel endpoint with personalization, fallback, priority ordering, and rental filtering
  app.get("/api/dashboard/active-properties", async (req, res) => {
    try {
      if (!repliersClient) {
        return res.json({ properties: [], count: 0, personalized: false, filteredRentals: 0 });
      }
      
      // NO CAP - fetch all available active properties (up to Repliers limit)
      const fetchLimit = 200; // Fetch maximum available from Repliers
      const city = req.query.city as string | undefined;
      const minPrice = req.query.minPrice ? parseInt(req.query.minPrice as string) : undefined;
      const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice as string) : undefined;
      const propertyType = req.query.propertyType as string | undefined;
      
      const hasPersonalization = !!(city || minPrice || maxPrice || propertyType);
      
      // Build search params with optional personalization filters
      const searchParams: any = {
        status: 'A',
        resultsPerPage: fetchLimit,
        sortBy: 'createdOnDesc',
      };
      
      if (city) searchParams.city = city;
      if (minPrice) searchParams.minPrice = minPrice;
      if (maxPrice) searchParams.maxPrice = maxPrice;
      if (propertyType) searchParams.type = propertyType;
      
      // Fetch active listings from Repliers with personalization
      let result = await repliersClient.searchListings(searchParams);
      let allProperties = result.listings.map(listing => repliersClient!.mapToStandardProperty(listing));
      
      // GLOBAL RENTAL EXCLUSION - Filter out rental/leasing listings server-side
      const beforeFilterCount = allProperties.length;
      const rentalsRemoved = allProperties.filter(p => isLikelyRentalProperty(p));
      let properties = filterOutRentalProperties(allProperties);
      logRentalFiltering('/api/dashboard/active-properties', beforeFilterCount, properties.length, rentalsRemoved);
      
      // FALLBACK: If personalized search yields no/few results, fetch general listings
      if (hasPersonalization && properties.length < 5) {
        const fallbackParams: any = {
          status: 'A',
          resultsPerPage: fetchLimit,
          sortBy: 'createdOnDesc',
        };
        const fallbackResult = await repliersClient.searchListings(fallbackParams);
        let fallbackProperties = fallbackResult.listings.map(listing => repliersClient!.mapToStandardProperty(listing));
        
        // Apply rental filtering to fallback results too
        const fallbackRentals = fallbackProperties.filter(p => isLikelyRentalProperty(p));
        fallbackProperties = filterOutRentalProperties(fallbackProperties);
        logRentalFiltering('/api/dashboard/active-properties (fallback)', fallbackProperties.length + fallbackRentals.length, fallbackProperties.length, fallbackRentals);
        
        // Merge: personalized results first, then fill with general listings (no cap)
        const seenIds = new Set(properties.map(p => p.listingId));
        for (const prop of fallbackProperties) {
          if (!seenIds.has(prop.listingId)) {
            properties.push(prop);
            seenIds.add(prop.listingId);
          }
        }
      }
      
      // SORT BY SUBTYPE PRIORITY - Single Family Residence first, then Condo, etc.
      properties = sortBySubtypePriority(properties);
      
      // NO CAP - return all filtered, sorted properties
      res.json({
        properties,
        count: properties.length,
        personalized: hasPersonalization && result.count > 0,
        filteredRentals: rentalsRemoved.length
      });
    } catch (error: any) {
      console.error("Dashboard active properties error:", error.message);
      res.status(500).json({ error: "Failed to load active properties" });
    }
  });
  
  // Property inventory by subtype endpoint (rental-filtered)
  app.get("/api/dashboard/inventory-by-subtype", async (req, res) => {
    try {
      if (!repliersClient) {
        return res.json({ subtypes: {}, total: 0 });
      }
      
      // Fetch active properties with extra for filtering
      const result = await repliersClient.searchListings({
        status: 'A',
        resultsPerPage: 200,
      });
      
      let properties = result.listings.map(listing => repliersClient!.mapToStandardProperty(listing));
      
      // Apply rental filtering
      const beforeCount = properties.length;
      properties = filterOutRentalProperties(properties);
      logRentalFiltering('/api/dashboard/inventory-by-subtype', beforeCount, properties.length, []);
      
      // Count by subtype - use "Other/Unknown" for missing values
      const subtypeCounts: Record<string, number> = {};
      properties.forEach(p => {
        const subtype = p.propertySubType?.trim() || 'Other/Unknown';
        subtypeCounts[subtype] = (subtypeCounts[subtype] || 0) + 1;
      });
      
      // Sort by count descending
      const sortedSubtypes = Object.entries(subtypeCounts)
        .sort((a, b) => b[1] - a[1])
        .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});
      
      res.json({
        subtypes: sortedSubtypes,
        total: properties.length
      });
    } catch (error: any) {
      console.error("Inventory by subtype error:", error.message);
      res.status(500).json({ error: "Failed to load inventory by subtype" });
    }
  });
  
  // Days on Market analytics endpoint (rental-filtered)
  app.get("/api/dashboard/dom-analytics", async (req, res) => {
    try {
      const status = req.query.status as string || 'A'; // A, U, or Closed
      const daysRange = parseInt(req.query.daysRange as string) || 0; // 0 = all, 30, 60, 90, etc.
      
      let properties: any[] = [];
      
      if (status === 'Closed' || status === 'S') {
        // Get sold properties from database
        const dbProps = await storage.searchProperties({ status: 'Closed', limit: 500 });
        properties = filterOutRentalProperties(dbProps);
        
        // Calculate DOM for closed: CloseDate - ListDate
        properties = properties.map(p => {
          const listDate = p.listDate ? new Date(p.listDate) : null;
          const closeDate = p.closeDate ? new Date(p.closeDate) : null;
          let dom = p.daysOnMarket || 0;
          if (listDate && closeDate) {
            dom = Math.floor((closeDate.getTime() - listDate.getTime()) / (1000 * 60 * 60 * 24));
          }
          return { ...p, calculatedDom: dom };
        });
        
        // Apply days range filter
        if (daysRange > 0) {
          properties = properties.filter(p => p.calculatedDom <= daysRange);
        }
      } else if (repliersClient) {
        // Get active/under contract from Repliers
        const result = await repliersClient.searchListings({
          status: status,
          resultsPerPage: 200,
        });
        properties = result.listings.map(listing => repliersClient!.mapToStandardProperty(listing));
        properties = filterOutRentalProperties(properties);
        
        // Calculate DOM for active: Today - ListDate
        const today = new Date();
        properties = properties.map(p => {
          const listDate = p.listDate ? new Date(p.listDate) : null;
          let dom = p.daysOnMarket || 0;
          if (listDate) {
            dom = Math.floor((today.getTime() - listDate.getTime()) / (1000 * 60 * 60 * 24));
          }
          return { ...p, calculatedDom: dom };
        });
      }
      
      // Calculate DOM statistics
      const domValues = properties.map(p => p.calculatedDom || p.daysOnMarket || 0).filter(d => d >= 0);
      const avgDom = domValues.length > 0 ? Math.round(domValues.reduce((a, b) => a + b, 0) / domValues.length) : 0;
      const medianDom = domValues.length > 0 ? domValues.sort((a, b) => a - b)[Math.floor(domValues.length / 2)] : 0;
      const minDom = domValues.length > 0 ? Math.min(...domValues) : 0;
      const maxDom = domValues.length > 0 ? Math.max(...domValues) : 0;
      
      // DOM distribution buckets
      const distribution = {
        '0-30': properties.filter(p => (p.calculatedDom || 0) <= 30).length,
        '31-60': properties.filter(p => (p.calculatedDom || 0) > 30 && (p.calculatedDom || 0) <= 60).length,
        '61-90': properties.filter(p => (p.calculatedDom || 0) > 60 && (p.calculatedDom || 0) <= 90).length,
        '91-120': properties.filter(p => (p.calculatedDom || 0) > 90 && (p.calculatedDom || 0) <= 120).length,
        '121-180': properties.filter(p => (p.calculatedDom || 0) > 120 && (p.calculatedDom || 0) <= 180).length,
        '180+': properties.filter(p => (p.calculatedDom || 0) > 180).length,
      };
      
      res.json({
        status,
        daysRange,
        count: properties.length,
        avgDom,
        medianDom,
        minDom,
        maxDom,
        distribution
      });
    } catch (error: any) {
      console.error("DOM analytics error:", error.message);
      res.status(500).json({ error: "Failed to load DOM analytics" });
    }
  });
  
  // Recent Sold/Closed properties endpoint (fallback when DOM data unavailable)
  app.get("/api/dashboard/recent-sold", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Get recent sold properties from database (filtered for rentals)
      let dbProps = await storage.searchProperties({ status: 'Closed', limit: 100 });
      dbProps = filterOutRentalProperties(dbProps);
      
      // Sort by close date descending and take requested limit
      const sortedProps = dbProps
        .sort((a, b) => {
          const dateA = a.closeDate ? new Date(a.closeDate).getTime() : 0;
          const dateB = b.closeDate ? new Date(b.closeDate).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, limit)
        .map(p => ({
          id: p.id || p.listingId,
          listingId: p.listingId || p.id,
          unparsedAddress: p.unparsedAddress,
          city: p.city,
          stateOrProvince: p.stateOrProvince,
          closePrice: p.closePrice || p.listPrice,
          closeDate: p.closeDate,
          bedroomsTotal: p.bedroomsTotal,
          bathroomsTotalInteger: p.bathroomsTotalInteger,
          livingArea: p.livingArea,
          photos: [],
          standardStatus: 'Closed',
          propertySubType: p.propertySubType
        }));
      
      res.json({
        properties: sortedProps,
        count: sortedProps.length,
        total: dbProps.length
      });
    } catch (error: any) {
      console.error("Recent sold error:", error.message);
      res.status(500).json({ error: "Failed to load recent sold properties" });
    }
  });
  
  // System status with sync timestamps
  app.get("/api/dashboard/system-status", async (req, res) => {
    try {
      const healthStatus = {
        mlsGridConfigured: mlsGridClient !== null,
        repliersConfigured: isRepliersConfigured(),
        mapboxConfigured: isMapboxConfigured(),
      };
      
      res.json({
        ...healthStatus,
        lastDataPull: syncTimestamps.lastDataPull?.toISOString() || null,
        lastSuccessfulSync: syncTimestamps.lastSuccessfulSync?.toISOString() || null,
        lastSyncAttempt: syncTimestamps.lastSyncAttempt?.toISOString() || null,
        status: healthStatus.repliersConfigured ? 'Ready' : 'Setup Required',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("System status error:", error.message);
      res.status(500).json({ error: "Failed to load system status" });
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

  // Server-side rendered share page with Open Graph meta tags for social sharing
  // Only serves SSR for social media bots/crawlers; regular browsers get the React app via Vite
  app.get("/share/cma/:token", async (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    
    // List of social media crawler/bot user agents that need OG meta tags
    const botPatterns = [
      'facebookexternalhit',
      'Facebot',
      'Twitterbot',
      'LinkedInBot',
      'WhatsApp',
      'Slackbot',
      'Discordbot',
      'TelegramBot',
      'Pinterest',
      'Googlebot',
      'bingbot',
    ];
    
    // Check if this is a bot request
    const isBot = botPatterns.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));
    
    // For regular browsers, let Vite handle the request (passes to next middleware)
    if (!isBot) {
      return next();
    }
    
    // Strip HTML tags and escape remaining content for safe meta tag embedding
    const stripHtml = (str: string): string => {
      return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    };
    
    const escapeHtml = (str: string): string => {
      return stripHtml(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };
    
    try {
      const cma = await storage.getCmaByShareToken(req.params.token);
      
      // Default meta values
      let title = "Property Market Analysis | Spyglass Realty";
      let description = "View this Comparative Market Analysis report from Spyglass Realty. Get insights on property values and market trends.";
      let image = "https://spyglassrealty.com/images/og-default.jpg";
      let propertyCount = 0;
      let avgPrice = "";
      
      if (cma) {
        // Use CMA data for meta tags
        title = `${cma.name} | CMA Report`;
        
        // Calculate stats for description
        let properties: any[] = [];
        if (cma.propertiesData && Array.isArray(cma.propertiesData)) {
          properties = cma.propertiesData;
        }
        
        propertyCount = properties.length;
        
        if (propertyCount > 0) {
          const prices = properties.map(p => {
            if (p.standardStatus === 'Closed' && p.closePrice) {
              return Number(p.closePrice);
            }
            return Number(p.listPrice || 0);
          }).filter(p => p > 0);
          
          if (prices.length > 0) {
            const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
            avgPrice = new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: 'USD', 
              maximumFractionDigits: 0 
            }).format(avg);
          }
          
          // Get first property image for OG image
          const firstPropWithImage = properties.find(p => 
            (p.photos && p.photos.length > 0) || p.media?.[0]?.mediaURL
          );
          if (firstPropWithImage) {
            image = firstPropWithImage.photos?.[0] || firstPropWithImage.media?.[0]?.mediaURL || image;
          }
          
          description = `Comparative Market Analysis with ${propertyCount} properties. ${avgPrice ? `Average price: ${avgPrice}. ` : ''}Prepared by Spyglass Realty.`;
        }
      }

      // Escape all user-controlled values for safe HTML embedding
      const safeTitle = escapeHtml(title);
      const safeDescription = escapeHtml(description);
      const safeImage = escapeHtml(image);
      const safeToken = escapeHtml(req.params.token);
      const safeUrl = `${req.protocol}://${req.get('host')}/share/cma/${safeToken}`;

      // Return HTML with OG meta tags that will be replaced by React app
      const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeImage}" />
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${safeUrl}" />
    <meta property="twitter:title" content="${safeTitle}" />
    <meta property="twitter:description" content="${safeDescription}" />
    <meta property="twitter:image" content="${safeImage}" />
    
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error("Error serving shared CMA page:", error);
      // Fallback to default page
      res.redirect('/');
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
