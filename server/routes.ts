import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createMLSGridClient } from "./mlsgrid-client";
import { triggerManualSync } from "./mlsgrid-sync";
import { getHomeReviewClient, mapHomeReviewPropertyToSchema, type PropertySearchParams } from "./homereview-client";
import { initRepliersClient, getRepliersClient, isRepliersConfigured } from "./repliers-client";
import { getUnifiedInventory, getInventoryDebugData, getInventoryAudit } from "./inventory-service";
import { geocodeAddress, geocodeProperties, isMapboxConfigured } from "./mapbox-geocoding";
import { searchCriteriaSchema, insertCmaSchema, insertUserSchema, insertSellerUpdateSchema, updateSellerUpdateSchema, updateLeadGateSettingsSchema, isLikelyRentalProperty, filterOutRentalProperties } from "@shared/schema";
import { filterByPropertySubtype, isLandOrLot, getPropertyTypeInfo } from "@shared/propertyTypeGuard";
import { findMatchingProperties, calculateMarketSummary } from "./seller-update-service";
import { z } from "zod";
import bcrypt from "bcryptjs";
import passport from "passport";
import { requireAuth, requireRole } from "./auth";
import { fetchExternalUsers, fetchFromExternalApi } from "./external-api";
import type { PropertyStatistics, TimelineDataPoint } from "@shared/schema";
import { neighborhoodService } from "./neighborhood-service";
import { registerWordPressRoutes } from "./wordpress-routes";
import { registerWidgetRoutes } from "./widget-routes";

// Calculate match tier for AI Image Search results
// Score is relative to number of imageSearchItems (1.0 per item = perfect match)
function calculateMatchTier(score: number | undefined, itemCount: number): 'High' | 'Medium' | 'Low' | null {
  if (score === undefined || score === null) return null;
  const maxScore = itemCount; // 1.0 per item
  const ratio = score / maxScore;
  if (ratio >= 0.7) return 'High';
  if (ratio >= 0.4) return 'Medium';
  return 'Low';
}

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
      // Normalize Pending/Under Contract to Active Under Contract (RESO-aligned)
      const status = (rawStatusValue === 'Pending' || rawStatusValue === 'Under Contract' ? 'Active Under Contract' : rawStatusValue) as 'Active' | 'Active Under Contract' | 'Closed';
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
      } else if (status === 'Active Under Contract') {
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
  
  // Start the seller update email scheduler
  import('./seller-update-scheduler').then(({ startScheduler }) => {
    startScheduler();
  }).catch(err => {
    console.warn('⚠️ Failed to start seller update scheduler:', err.message);
  });
  
  // Register WordPress API routes with CORS
  registerWordPressRoutes(app);
  registerWidgetRoutes(app);

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
      // Debug: Log incoming query parameters
      console.log(`🔎 [Search API] Raw query params: ${JSON.stringify(req.query)}`);
      
      const {
        status,
        statuses, // Comma-separated list of statuses (active,under_contract,closed)
        postalCode,
        subdivision,
        city,
        minPrice,
        maxPrice,
        bedsMin,
        bedsMax,
        bathsMin,
        minSqft,
        maxSqft,
        minLotAcres,
        maxLotAcres,
        stories,
        minYearBuilt,
        maxYearBuilt,
        soldDays,
        dateFrom,
        dateTo,
        type,  // 'sale' or 'lease' to filter transaction type
        elementarySchools,  // Comma-separated list of elementary school names
        middleSchools,      // Comma-separated list of middle school names
        highSchools,        // Comma-separated list of high school names
        schoolDistrict,     // School district name
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
      // isSaleOnly: set to true for Closed status to exclude leased rentals
      const fetchFromRepliers = async (repliersStatus: string, isSaleOnly: boolean = false): Promise<NormalizedProperty[]> => {
        if (!isRepliersConfigured()) {
          return [];
        }
        const repliersClient = getRepliersClient();
        if (!repliersClient) {
          return [];
        }

        const needsServerSideFiltering = minLotAcres || maxLotAcres || stories || minYearBuilt || maxYearBuilt;
        // CRITICAL: When subdivision filter is needed, DON'T pass it to API (API does exact match)
        // Instead, fetch more results and filter locally for partial matches like "Barton Hills Sec 03A"
        const needsLocalSubdivisionFilter = !!subdivision;
        // School filters also require larger fetch since they're applied server-side
        const needsSchoolFilter = !!elementarySchools || !!middleSchools || !!highSchools || !!schoolDistrict;
        const effectiveLimit = (needsLocalSubdivisionFilter || needsServerSideFiltering || needsSchoolFilter) ? 200 : parsedLimit;
        
        // Build search params - add type=Sale for Closed to exclude leased rentals
        // DO NOT pass subdivision to API - it does exact match which misses "Barton Hills Sec 03A" etc.
        // We'll filter locally with partial/contains matching
        const searchParams: any = {
          standardStatus: repliersStatus,  // RESO-compliant: Active, Pending, Closed
          postalCode: postalCode,
          city: city,
          // REMOVED: subdivision - API does exact match, we need partial match locally
          minPrice: minPrice ? parseInt(minPrice, 10) : undefined,
          maxPrice: maxPrice ? parseInt(maxPrice, 10) : undefined,
          minBeds: bedsMin ? parseInt(bedsMin, 10) : undefined,
          maxBeds: bedsMax ? parseInt(bedsMax, 10) : undefined,
          minBaths: bathsMin ? parseInt(bathsMin, 10) : undefined,
          minSqft: minSqft ? parseInt(minSqft, 10) : undefined,
          maxSqft: maxSqft ? parseInt(maxSqft, 10) : undefined,
          resultsPerPage: effectiveLimit,
          // Raw school filters - use contains: prefix for partial matching via Repliers API
          // Reference: https://api.repliers.io/listings?raw.ElementarySchool=contains:{input}
          // Note: Repliers API handles one value per raw.* parameter, so we take the first school name
          // if multiple are provided (comma-separated). The UI is designed for single school input.
          rawElementarySchool: elementarySchools?.split(',')[0]?.trim() || undefined,
          rawMiddleSchool: middleSchools?.split(',')[0]?.trim() || undefined,
          rawHighSchool: highSchools?.split(',')[0]?.trim() || undefined,
        };
        
        // CRITICAL: For Closed status, add type=sale to exclude leased rentals
        // standardStatus=Closed returns BOTH sold sales AND leased rentals
        if (isSaleOnly) {
          searchParams.type = 'sale';  // lowercase required by Repliers API
        }
        
        // Allow explicit type override from query parameter
        if (type && type !== 'all') {
          searchParams.type = type;
        }
        
        // COMPREHENSIVE DIAGNOSTIC LOGGING
        // Remove undefined values for cleaner logging
        const cleanParams = Object.fromEntries(
          Object.entries(searchParams).filter(([_, v]) => v !== undefined)
        );
        console.log(`\n📊 [CMA Search Diagnostic] ===================================`);
        console.log(`   Status requested: ${repliersStatus}`);
        console.log(`   Repliers API params: ${JSON.stringify(cleanParams, null, 2)}`);
        if (subdivision) {
          console.log(`   NOTE: Subdivision filter applied LOCALLY (API does exact match only)`);
          console.log(`   Local subdivision filter: "${subdivision}"`);
        }
        if (elementarySchools) {
          console.log(`   🏫 Elementary School filter: raw.ElementarySchool=contains:${elementarySchools.trim()}`);
        }
        if (middleSchools) {
          console.log(`   🏫 Middle School filter: raw.MiddleOrJuniorSchool=contains:${middleSchools.trim()}`);
        }
        if (highSchools) {
          console.log(`   🏫 High School filter: raw.HighSchool=contains:${highSchools.trim()}`);
        }
        console.log(`   =============================================================\n`);
        
        // PAGINATION: When subdivision/school filtering is active, fetch multiple pages to find enough matches
        // Repliers API caps at 100 results per page, so filtered listings may be on page 2+
        let allListings: any[] = [];
        const MAX_PAGES = (needsLocalSubdivisionFilter || needsSchoolFilter) ? 5 : 1; // Fetch up to 5 pages when filtering
        const TARGET_MATCHES = 20; // Stop early if we find enough matches
        let currentPage = 1;
        let totalCount = 0;
        
        while (currentPage <= MAX_PAGES) {
          const paginatedParams = { ...searchParams, pageNum: currentPage };
          const response = await repliersClient.searchListings(paginatedParams);
          const pageListings = response.listings || [];
          totalCount = response.count || totalCount;
          
          if (pageListings.length === 0) {
            // No more results
            break;
          }
          
          allListings = [...allListings, ...pageListings];
          
          // Early exit if we have enough potential matches or exhausted results
          if (!needsLocalSubdivisionFilter) {
            break; // Only one page needed if no subdivision filter
          }
          
          // Check if we might have enough subdivision matches
          // (Quick check before applying full filter)
          const subdivisionLowerCheck = subdivision?.toLowerCase().trim() || '';
          const potentialMatches = allListings.filter((l: any) => {
            const addr = l.address || {};
            const propNeighborhood = (addr.neighborhood || '').toLowerCase();
            const propSubdiv = (l.subdivision || l.raw?.subdivision || l.raw?.SubdivisionName || '').toLowerCase();
            // Also check if street address contains subdivision name
            const fullAddress = (addr.unparsedAddress || addr.streetAddress || l.unparsedAddress || '').toLowerCase();
            return propNeighborhood.includes(subdivisionLowerCheck) || propSubdiv.includes(subdivisionLowerCheck) || fullAddress.includes(subdivisionLowerCheck);
          });
          
          if (potentialMatches.length >= TARGET_MATCHES) {
            console.log(`📄 [Pagination] Found ${potentialMatches.length} potential matches after ${currentPage} page(s), stopping early`);
            break;
          }
          
          // Check if we've fetched all available results
          if (allListings.length >= totalCount || pageListings.length < 100) {
            break;
          }
          
          currentPage++;
        }
        
        if (currentPage > 1) {
          console.log(`📄 [Pagination] Fetched ${currentPage} page(s), ${allListings.length} total listings for status ${repliersStatus}`);
        }
        
        // SUPPLEMENTARY FETCH: Catch properties with missing sqft data
        // When sqft filters are used, do a second larger fetch WITHOUT sqft filters
        // to find properties that might have null/missing sqft values (like 2400 Rockingham Cir)
        let supplementaryListings: any[] = [];
        if ((minSqft || maxSqft) && subdivision) {
          try {
            const noSqftParams = { ...searchParams };
            delete noSqftParams.minSqft;
            delete noSqftParams.maxSqft;
            noSqftParams.resultsPerPage = 200; // Larger batch to catch more missing sqft properties
            const supplementaryResponse = await repliersClient.searchListings(noSqftParams);
            supplementaryListings = (supplementaryResponse.listings || []).filter((l: any) => {
              // Only keep listings that have NO sqft data (would be missed by main query)
              const sqft = l.details?.sqft || l.livingArea;
              return sqft === null || sqft === undefined || sqft === 0 || sqft === '';
            });
            if (supplementaryListings.length > 0) {
              console.log(`📦 [Supplementary Fetch] Found ${supplementaryListings.length} properties with missing sqft data`);
              // Log sample for debugging
              supplementaryListings.slice(0, 5).forEach((l: any) => {
                const addr = l.address || {};
                console.log(`   - ${addr.streetNumber} ${addr.streetName} (neighborhood: ${addr.neighborhood || 'N/A'})`);
              });
            }
          } catch (e) {
            // Ignore supplementary fetch errors
          }
        }
        
        // Combine main and supplementary results
        allListings = [...allListings, ...supplementaryListings];
        
        // Log detailed results
        const listings = allListings;
        console.log(`📊 [CMA Search Results] Status: ${repliersStatus}`);
        console.log(`   Total returned: ${listings.length}`);
        
        // Enhanced debug logging for school filters
        if (elementarySchools || middleSchools || highSchools) {
          console.log(`🏫 [School Filter Debug] ===================================`);
          if (elementarySchools) console.log(`   Requested Elementary: "${elementarySchools}" → raw.ElementarySchool=contains:${elementarySchools.trim()}`);
          if (middleSchools) console.log(`   Requested Middle: "${middleSchools}" → raw.MiddleOrJuniorSchool=contains:${middleSchools.trim()}`);
          if (highSchools) console.log(`   Requested High: "${highSchools}" → raw.HighSchool=contains:${highSchools.trim()}`);
          console.log(`   Results found: ${listings.length}`);
          
          if (listings.length === 0) {
            console.log(`   ⚠️ ZERO RESULTS - Possible issues:`);
            console.log(`      1. School name might be misspelled or not in MLS`);
            console.log(`      2. Check if raw.ElementarySchool field name is correct`);
            console.log(`      3. Try partial match (first word only)`);
          }
          console.log(`   =============================================================`);
        }
        
        // DEBUG: Log school-related fields from first few listings
        if (listings.length > 0 && (elementarySchools || middleSchools || highSchools)) {
          console.log(`🏫 [School Data Samples] First ${Math.min(3, listings.length)} listings:`);
          listings.slice(0, 3).forEach((listing: any, i: number) => {
            const addr = listing.address || {};
            const schoolKeys = listing.raw ? Object.keys(listing.raw).filter(k => k.toLowerCase().includes('school')) : [];
            console.log(`   ${i+1}. ${addr.streetNumber || ''} ${addr.streetName || ''} (${addr.city || ''})`);
            if (schoolKeys.length > 0) {
              schoolKeys.forEach(k => console.log(`      - raw.${k}: ${listing.raw[k]}`));
            } else {
              console.log(`      - No school fields in raw object`);
            }
          });
        } else if (listings.length > 0) {
          // Original debug logging when no school filter
          const firstListing = listings[0];
          const schoolKeys = firstListing.raw ? Object.keys(firstListing.raw).filter(k => k.toLowerCase().includes('school')) : [];
          if (schoolKeys.length > 0) {
            console.log(`🏫 [DEBUG] First listing school data: ${schoolKeys.map(k => `${k}="${firstListing.raw[k]}"`).join(', ')}`);
          }
        }
        
        if (listings.length > 0 && listings.length <= 20) {
          console.log(`   Listings returned:`);
          listings.forEach((l: any, i: number) => {
            const addr = l.address || {};
            const neighborhood = addr.neighborhood || 'N/A';
            const subdivision = l.subdivision || l.raw?.subdivision || l.raw?.SubdivisionName || 'N/A';
            console.log(`     ${i+1}. ${addr.streetNumber} ${addr.streetName} - neighborhood="${neighborhood}", subdivision="${subdivision}", sqft=${l.details?.sqft || l.livingArea || 'N/A'}`);
          });
        } else if (listings.length > 20) {
          console.log(`   (Too many listings to show details)`);
        }

        return allListings.map((listing: any) => {
          const addr = listing.address || {};
          const details = listing.details || {};
          const map = listing.map || {};

          const fullAddress = [
            addr.streetNumber,
            addr.streetName,
            addr.streetSuffix,
            addr.unitNumber ? `#${addr.unitNumber}` : null,
          ].filter(Boolean).join(' ');

          // MLS-aligned 4-status mapping: Active, Active Under Contract, Pending, Closed
          // CRITICAL: Use standardStatus first (for API-filtered results), then lastStatus for fine-tuning
          const lastStatus = listing.lastStatus || '';
          const rawStatus = listing.status || '';
          const standardStatus = listing.standardStatus || '';
          
          // Determine mapped status - prioritize standardStatus when it's a full RESO string
          let mappedStatus: string;
          
          // PRIORITY 0: If standardStatus is explicitly set to a full RESO value, use it directly
          if (standardStatus === 'Active Under Contract' || standardStatus.includes('Active Under Contract')) {
            mappedStatus = 'Active Under Contract';
          } else if (standardStatus === 'Pending') {
            mappedStatus = 'Pending';
          } else if (standardStatus === 'Active') {
            mappedStatus = 'Active';
          } else if (standardStatus === 'Closed' || standardStatus === 'Sold') {
            mappedStatus = 'Closed';
          }
          // PRIORITY 1: Check lastStatus for definitive status detection
          else if (lastStatus === 'Sld' || lastStatus === 'Lsd') {
            mappedStatus = 'Closed';
          } else if (lastStatus === 'AU' || (rawStatus === 'U' && lastStatus === 'Act')) {
            // Active Under Contract: lastStatus=AU, or status=U with lastStatus=Act
            mappedStatus = 'Active Under Contract';
          } else if (lastStatus === 'Pnd' || lastStatus === 'P') {
            mappedStatus = 'Pending';
          } else {
            // PRIORITY 2: Fall back to status field mapping
            const statusMap: Record<string, string> = {
              // Single-letter codes from Repliers API
              'A': 'Active',
              'U': 'Pending',  // Default U to Pending if no lastStatus override
              'S': 'Closed',
              'P': 'Pending',
            };
            mappedStatus = statusMap[rawStatus] || 'Active';
          }
          
          // Log status mapping for debugging
          if (standardStatus.includes('Under Contract') || standardStatus.includes('Active Under Contract') || lastStatus === 'AU' || lastStatus === 'Act') {
            console.log(`📋 AU Status mapping: standardStatus="${standardStatus}", status="${rawStatus}", lastStatus="${lastStatus}" → "${mappedStatus}" for ${listing.mlsNumber || 'unknown MLS#'}`);
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
            // RESO-COMPLIANT: Prioritize raw SubdivisionName field first, neighborhood only as last resort
            // Raw data contains original RESO field names from the MLS
            subdivision: (() => {
              // Priority 1: Raw RESO fields
              const rawSub = listing.raw?.SubdivisionName || listing.raw?.Subdivision;
              if (rawSub && rawSub !== 'N/A' && rawSub.trim()) return rawSub;
              // Priority 2: Structured subdivision fields
              const structured = listing.subdivisionName || listing.subdivision || details.subdivision || (details as any).SubdivisionName;
              if (structured && structured !== 'N/A' && structured.trim()) return structured;
              // Priority 3: Neighborhood as fallback only (some MLS incorrectly maps here)
              const nbhd = addr.neighborhood || listing.neighborhood;
              if (nbhd && nbhd !== 'N/A' && nbhd.trim()) return nbhd;
              return null;
            })(),
            subdivisionName: (() => {
              const rawSub = listing.raw?.SubdivisionName || listing.raw?.Subdivision;
              if (rawSub && rawSub !== 'N/A' && rawSub.trim()) return rawSub;
              const structured = listing.subdivisionName || listing.subdivision || details.subdivision || (details as any).SubdivisionName;
              if (structured && structured !== 'N/A' && structured.trim()) return structured;
              const nbhd = addr.neighborhood || listing.neighborhood;
              if (nbhd && nbhd !== 'N/A' && nbhd.trim()) return nbhd;
              return null;
            })(),
            neighborhood: null,  // MUST be resolved from boundary polygons, never from listing data
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
            // School fields from Repliers - check multiple possible locations
            elementarySchool: listing.raw?.ElementarySchool || listing.raw?.elementarySchool || 
              listing.elementarySchool || listing.schools?.elementary || 
              (listing.schools && Array.isArray(listing.schools) ? listing.schools.find((s: any) => s.level === 'elementary')?.name : null) || null,
            middleSchool: listing.raw?.MiddleOrJuniorSchool || listing.raw?.middleSchool || 
              listing.middleOrJuniorSchool || listing.schools?.middle ||
              (listing.schools && Array.isArray(listing.schools) ? listing.schools.find((s: any) => s.level === 'middle')?.name : null) || null,
            highSchool: listing.raw?.HighSchool || listing.raw?.highSchool || 
              listing.highSchool || listing.schools?.high ||
              (listing.schools && Array.isArray(listing.schools) ? listing.schools.find((s: any) => s.level === 'high')?.name : null) || null,
            schoolDistrict: listing.raw?.SchoolDistrict || listing.raw?.schoolDistrict || 
              listing.schoolDistrict || listing.schools?.district || null,
            // Debug: store raw schools data to inspect structure
            _rawSchools: listing.schools || listing.raw?.schools || null,
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
        if (bedsMax) filters.maxBeds = parseInt(bedsMax, 10);
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
            // CRITICAL: subdivision = tract/community label, neighborhood = boundary resolution only
            // Legacy records may have subdivision stored in neighborhood field - migrate it
            subdivision: p.subdivision || p.subdivisionName || p.neighborhood || null,
            subdivisionName: p.subdivision || p.subdivisionName || p.neighborhood || null,
            neighborhood: null,  // MUST be resolved from boundary polygons, never from listing data
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
      
      // Helper function to fetch from database with school filters
      const fetchFromDatabaseWithSchools = async (): Promise<NormalizedProperty[]> => {
        const filters: any = {};
        if (city) filters.city = city;
        if (postalCode) filters.postalCode = postalCode;
        if (minPrice) filters.minPrice = parseInt(minPrice, 10);
        if (maxPrice) filters.maxPrice = parseInt(maxPrice, 10);
        if (bedsMin) filters.minBeds = parseInt(bedsMin, 10);
        if (bedsMax) filters.maxBeds = parseInt(bedsMax, 10);
        if (bathsMin) filters.minBaths = parseInt(bathsMin, 10);
        if (minSqft) filters.minSqft = parseInt(minSqft, 10);
        if (maxSqft) filters.maxSqft = parseInt(maxSqft, 10);
        if (subdivision) filters.subdivision = subdivision;
        // School filters - parsed as arrays for storage.searchProperties
        if (elementarySchools) filters.elementarySchools = elementarySchools.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        if (middleSchools) filters.middleSchools = middleSchools.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        if (highSchools) filters.highSchools = highSchools.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        if (schoolDistrict) filters.schoolDistrict = [schoolDistrict.trim()];
        filters.status = 'Closed';
        filters.limit = 200; // Fetch more for comprehensive school matching
        
        // Apply soldDays filter at database level for Closed properties
        if (soldDays) {
          const daysAgo = parseInt(soldDays, 10);
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
          filters.closeDateAfter = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        }

        console.log(`🏫 [DB School Search] Filters:`, JSON.stringify(filters, null, 2));

        const dbResults = await storage.searchProperties(filters);
        console.log(`🏫 [DB School Search] Found ${dbResults.length} properties`);
        
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
            beds: beds,
            baths: baths,
            bedroomsTotal: beds,
            bathroomsTotalInteger: baths,
            livingArea: toNum(p.livingArea),
            yearBuilt: toNum(p.yearBuilt),
            latitude: toNum(p.latitude),
            longitude: toNum(p.longitude),
            photos: photos,
            subdivision: p.subdivision || p.subdivisionName || p.neighborhood || null,
            subdivisionName: p.subdivision || p.subdivisionName || p.neighborhood || null,
            neighborhood: null,
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
            // Include school fields for display
            elementarySchool: p.elementarySchool || null,
            middleSchool: p.middleOrJuniorSchool || null,
            highSchool: p.highSchool || null,
            schoolDistrict: p.schoolDistrict || null,
          };
        }) as any[];

        return results;
      };

      // Apply server-side filters
      // skipSchoolFilters: true when data comes from Repliers API (school filtering already done at API level)
      const applyFilters = (results: any[], skipSchoolFilters: boolean = false): any[] => {
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
        // Filter by sold date (only applies to closed properties - Active/Under Contract pass through)
        if (soldDays) {
          const daysAgo = parseInt(soldDays, 10);
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
          filtered = filtered.filter((p: any) => {
            // Active and Under Contract properties always pass through (no closeDate filter)
            const status = (p.standardStatus || p.status || '').toLowerCase();
            if (status !== 'closed' && status !== 'sold') {
              return true; // Let Active/Under Contract through without date check
            }
            // For Closed properties, apply the soldDays filter
            if (!p.closeDate) return false;
            const closeDate = new Date(p.closeDate);
            return closeDate >= cutoffDate;
          });
        }
        // Full date range filtering (dateFrom/dateTo)
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          filtered = filtered.filter((p: any) => {
            const dateToCheck = p.closeDate || p.listDate || p.listingContractDate;
            if (!dateToCheck) return false;
            return new Date(dateToCheck) >= fromDate;
          });
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          filtered = filtered.filter((p: any) => {
            const dateToCheck = p.closeDate || p.listDate || p.listingContractDate;
            if (!dateToCheck) return false;
            return new Date(dateToCheck) <= toDate;
          });
        }
        if (subdivision) {
          const subdivisionLower = subdivision.toLowerCase().trim();
          const searchTerms = subdivisionLower.split(/\s+/); // Split "Barton Hills" into ["barton", "hills"]
          const beforeCount = filtered.length;
          
          // Log the search query for debugging
          console.log(`🔍 [Subdivision Filter] Searching for: "${subdivision}"`);
          
          // Log sample of subdivision values for debugging
          const sampleProps = filtered.slice(0, 10);
          console.log(`   Sample subdivision values in results:`);
          sampleProps.forEach((p: any) => {
            console.log(`     - "${p.address}": subdiv="${p.subdivision || 'NULL'}", subdivName="${p.subdivisionName || 'NULL'}", neighborhood="${p.neighborhood || 'NULL'}"`);
          });
          
          filtered = filtered.filter((p: any) => {
            const propSubdiv = (p.subdivision || '').toLowerCase().trim();
            const propSubdivName = (p.subdivisionName || '').toLowerCase().trim();
            // CRITICAL: Also check neighborhood field - Repliers stores subdivision info there for Active listings
            const propNeighborhood = (p.neighborhood || '').toLowerCase().trim();
            // CRITICAL: Also check street address - MLS data sometimes has subdivision name in street (e.g., "904 OAKLANDS Dr")
            const propAddress = (p.address || p.unparsedAddress || '').toLowerCase().trim();
            
            // Stricter matching logic:
            // 1. Exact match (case-insensitive)
            // 2. Property subdivision STARTS WITH search term (e.g., "Barton Hills" matches "Barton Hills West")
            // 3. All search term words appear in the subdivision (e.g., "Barton Hills" matches "Barton Hills Section 2")
            // 4. Street address contains the search term (e.g., "904 Oaklands Dr" matches "oaklands")
            
            const exactMatch = propSubdiv === subdivisionLower || propSubdivName === subdivisionLower || propNeighborhood === subdivisionLower;
            const startsWithMatch = propSubdiv.startsWith(subdivisionLower) || propSubdivName.startsWith(subdivisionLower) || propNeighborhood.startsWith(subdivisionLower);
            const allWordsMatch = searchTerms.every(term => 
              propSubdiv.includes(term) || propSubdivName.includes(term) || propNeighborhood.includes(term)
            );
            
            // Reject partial matches that don't contain ALL search terms
            // This prevents "Barton Creek" from matching "Barton Hills"
            const hasAllTerms = searchTerms.length > 1 
              ? searchTerms.every(term => propSubdiv.includes(term) || propSubdivName.includes(term) || propNeighborhood.includes(term))
              : propSubdiv.includes(subdivisionLower) || propSubdivName.includes(subdivisionLower) || propNeighborhood.includes(subdivisionLower);
            
            // Address matching: Check if street name contains the subdivision search term
            // This catches cases like "904 Oaklands Dr" when searching for "oaklands"
            const addressContainsSubdiv = propAddress.includes(subdivisionLower);
            
            return exactMatch || startsWithMatch || (allWordsMatch && hasAllTerms) || addressContainsSubdiv;
          });
          
          // Log subdivision filtering results
          console.log(`   - Subdivision filter: "${subdivision}" kept ${filtered.length} of ${beforeCount} properties`);
          
          // Log sample of filtered and rejected results for debugging
          if (beforeCount > 0) {
            console.log(`   - Sample kept properties:`);
            filtered.slice(0, 3).forEach((p: any) => {
              console.log(`     ✓ ${p.address} - Subdivision: "${p.subdivision || 'N/A'}", Neighborhood: "${p.neighborhood || 'N/A'}"`);
            });
          }
        }
        // CRITICAL: Include properties WITHOUT sqft data (null/undefined livingArea)
        // This ensures properties like 2400 Rockingham Cir (no sqft in Repliers) are not excluded
        if (minSqft) {
          const min = parseInt(minSqft, 10);
          filtered = filtered.filter(p => p.livingArea === null || p.livingArea === undefined || p.livingArea >= min);
        }
        if (maxSqft) {
          const max = parseInt(maxSqft, 10);
          filtered = filtered.filter(p => p.livingArea === null || p.livingArea === undefined || p.livingArea <= max);
        }
        
        // School filtering with normalization
        // SKIP when Repliers API already filtered by school (Active/Under Contract/Pending statuses)
        // APPLY only for database results (Closed status) where local filtering is needed
        const normalizeSchoolName = (name: string | null | undefined): string => {
          if (!name) return '';
          return name
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/elem\.?$/i, 'elementary')
            .replace(/el\.?$/i, 'elementary')
            .replace(/middle or jr\.?$/i, 'middle')
            .replace(/jr\.?\s*high/i, 'junior high')
            .replace(/h\.?s\.?$/i, 'high school')
            .replace(/[^a-z0-9\s]/g, '');
        };
        
        // Elementary school filter - skip if Repliers API already handled this
        if (elementarySchools && !skipSchoolFilters) {
          const schoolList = elementarySchools.split(',').map(s => s.trim()).filter(s => s.length > 0);
          const normalizedSchools = schoolList.map(s => normalizeSchoolName(s)).filter(s => s.length > 0);
          if (normalizedSchools.length > 0) {
            const beforeCount = filtered.length;
            // Debug: Log sample of school values in data
            const sampleSchools = filtered.slice(0, 10).map((p: any) => p.elementarySchool).filter(Boolean);
            console.log(`🏫 [DEBUG] Sample elementary school values in data: ${sampleSchools.length > 0 ? sampleSchools.join(', ') : 'NONE FOUND'}`);
            console.log(`🏫 [DEBUG] Normalized search terms: ${normalizedSchools.join(', ')}`);
            // Debug: Log raw schools data structure from first few listings
            const sampleRawSchools = filtered.slice(0, 3).map((p: any) => JSON.stringify(p._rawSchools));
            console.log(`🏫 [DEBUG] Raw schools structure samples: ${sampleRawSchools.join(' | ')}`);
            
            filtered = filtered.filter((p: any) => {
              const propSchool = normalizeSchoolName(p.elementarySchool);
              if (!propSchool) return false;
              return normalizedSchools.some(searchSchool => 
                propSchool === searchSchool || propSchool.includes(searchSchool) || searchSchool.includes(propSchool)
              );
            });
            console.log(`🏫 Elementary school filter: ${beforeCount} -> ${filtered.length} (looking for: ${schoolList.join(', ')})`);
          }
        }
        
        // Middle school filter - skip if Repliers API already handled this
        if (middleSchools && !skipSchoolFilters) {
          const schoolList = middleSchools.split(',').map(s => s.trim()).filter(s => s.length > 0);
          const normalizedSchools = schoolList.map(s => normalizeSchoolName(s)).filter(s => s.length > 0);
          if (normalizedSchools.length > 0) {
            const beforeCount = filtered.length;
            filtered = filtered.filter((p: any) => {
              const propSchool = normalizeSchoolName(p.middleSchool);
              if (!propSchool) return false;
              return normalizedSchools.some(searchSchool => 
                propSchool === searchSchool || propSchool.includes(searchSchool) || searchSchool.includes(propSchool)
              );
            });
            console.log(`🏫 Middle school filter: ${beforeCount} -> ${filtered.length} (looking for: ${schoolList.join(', ')})`);
          }
        }
        
        // High school filter - skip if Repliers API already handled this
        if (highSchools && !skipSchoolFilters) {
          const schoolList = highSchools.split(',').map(s => s.trim()).filter(s => s.length > 0);
          const normalizedSchools = schoolList.map(s => normalizeSchoolName(s)).filter(s => s.length > 0);
          if (normalizedSchools.length > 0) {
            const beforeCount = filtered.length;
            filtered = filtered.filter((p: any) => {
              const propSchool = normalizeSchoolName(p.highSchool);
              if (!propSchool) return false;
              return normalizedSchools.some(searchSchool => 
                propSchool === searchSchool || propSchool.includes(searchSchool) || searchSchool.includes(propSchool)
              );
            });
            console.log(`🏫 High school filter: ${beforeCount} -> ${filtered.length} (looking for: ${schoolList.join(', ')})`);
          }
        }
        
        // School district filter - skip if Repliers API already handled this
        if (schoolDistrict && !skipSchoolFilters) {
          const normalizedDistrict = normalizeSchoolName(schoolDistrict);
          if (normalizedDistrict.length > 0) {
            const beforeCount = filtered.length;
            filtered = filtered.filter((p: any) => {
              const propDistrict = normalizeSchoolName(p.schoolDistrict);
              if (!propDistrict) return false;
              return propDistrict === normalizedDistrict || propDistrict.includes(normalizedDistrict) || normalizedDistrict.includes(propDistrict);
            });
            console.log(`🏫 School district filter: ${beforeCount} -> ${filtered.length} (looking for: ${schoolDistrict})`);
          }
        }
        
        return filtered;
      };

      // Check if school filters are provided - Repliers API doesn't return school data
      // so school filtering only works with database (Closed/Sold properties)
      const hasSchoolFilters = !!(elementarySchools || middleSchools || highSchools || schoolDistrict);
      let schoolFilterWarning: string | null = null;
      
      // Fetch from each selected status source
      // Per client requirement: Use Repliers as primary data source for ALL statuses
      // Track source to determine if local school filtering should be skipped (Repliers handles it at API level)
      const fetchPromises: Promise<{ results: NormalizedProperty[]; expectedStatus: string; fromRepliers: boolean }>[] = [];
      
      // School filters now work via Repliers API using raw.ElementarySchool=contains: format
      // No longer need to skip Active/Under Contract searches
      if (hasSchoolFilters) {
        console.log(`🏫 School filters will be applied via Repliers API: raw.ElementarySchool/MiddleOrJuniorSchool/HighSchool=contains:`);
      }
      
      for (const statusType of statusList) {
        
        if (statusType === 'active') {
          // RESO-compliant: standardStatus=Active
          fetchPromises.push(fetchFromRepliers('Active').then(results => ({ results, expectedStatus: 'Active', fromRepliers: true })));
        } else if (statusType === 'under_contract') {
          // RESO-compliant: Query BOTH Active Under Contract AND Pending statuses
          // This ensures we capture all under-contract properties (AU and Pending)
          fetchPromises.push(fetchFromRepliers('Active Under Contract').then(results => ({ results, expectedStatus: 'Active Under Contract', fromRepliers: true })));
          fetchPromises.push(fetchFromRepliers('Pending').then(results => ({ results, expectedStatus: 'Pending', fromRepliers: true })));
        } else if (statusType === 'pending') {
          // Pending only - use standardStatus=Pending
          fetchPromises.push(fetchFromRepliers('Pending').then(results => ({ results, expectedStatus: 'Pending', fromRepliers: true })));
        } else if (statusType === 'closed' || statusType === 'sold') {
          // RESO-compliant: standardStatus=Closed for sold/closed listings
          // Per Repliers: ClosedDate → soldDate, ClosePrice → soldPrice
          // CRITICAL: Pass isSaleOnly=true to exclude leased rentals from Closed results
          // School filters are now handled by Repliers API using raw.ElementarySchool=contains: format
          console.log(`🏠 Using Repliers API for Closed search${hasSchoolFilters ? ' with school filters' : ''}`);
          fetchPromises.push(
            fetchFromRepliers('Closed', true)  // true = filter to Sale type only
              .then(results => ({ results, expectedStatus: 'Closed', fromRepliers: true }))
              .catch(async (err) => {
                // Repliers doesn't support sold status for this feed - fall back to database
                console.log(`⚠️ Repliers sold data not available, using database fallback`);
                const dbResults = hasSchoolFilters 
                  ? await fetchFromDatabaseWithSchools() 
                  : await fetchFromDatabase();
                return { results: dbResults, expectedStatus: 'Closed', fromRepliers: false };
              })
          );
        }
      }

      // Wait for all fetches to complete
      const resultsArrays = await Promise.all(fetchPromises);
      
      // Combine and apply filters WITH strict status matching
      // This ensures that when we query for 'Active', we only return truly Active listings
      // (not 'Active Under Contract' which should be mapped to 'Under Contract')
      for (const { results, expectedStatus, fromRepliers } of resultsArrays) {
        // Filter to only include listings matching the expected status after mapping
        const statusFilteredResults = results.filter(p => {
          const propertyStatus = (p.status || '').toLowerCase();
          const expected = expectedStatus.toLowerCase();
          
          // Match status - allow some flexibility for Closed/Sold
          if (expected === 'closed') {
            return propertyStatus === 'closed' || propertyStatus === 'sold';
          }
          if (expected === 'under contract' || expected === 'active under contract' || expected === 'pending') {
            // Accept all under-contract variants as valid matches
            return propertyStatus === 'under contract' || 
                   propertyStatus === 'active under contract' || 
                   propertyStatus === 'pending';
          }
          return propertyStatus === expected;
        });
        
        // Log if we filtered out any listings due to status mismatch
        if (statusFilteredResults.length < results.length) {
          const filteredOut = results.length - statusFilteredResults.length;
          console.log(`⚠️ Status filter: Removed ${filteredOut} listings with mismatched status (expected: ${expectedStatus})`);
        }
        
        // Skip local school filtering for Repliers results - Repliers already filters at API level
        // Only apply local school filters for database results (Closed status with school filters)
        const skipSchoolFilters = fromRepliers && hasSchoolFilters;
        if (skipSchoolFilters) {
          console.log(`🏫 [Skip Local Filter] Repliers already filtered by school, skipping local school filter`);
        }
        allResults = allResults.concat(applyFilters(statusFilteredResults, skipSchoolFilters));
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
      
      // Apply property subtype filtering to exclude Land/Lots when Single Family selected
      // This is needed because Repliers 'class=residential' includes Land/Lots
      // Support both propertyType and propertySubType query params (frontend sends propertySubType)
      const { propertyType: reqPropertyType, propertySubType: reqPropertySubType } = req.query as Record<string, string | undefined>;
      const propertyTypeFiltered = filterByPropertySubtype(nonRentalResults, reqPropertySubType || reqPropertyType);
      if (nonRentalResults.length !== propertyTypeFiltered.length) {
        console.log(`📦 Search: Filtered out ${nonRentalResults.length - propertyTypeFiltered.length} listings due to property type mismatch`);
      }
      
      // Apply limit after all filtering
      const finalResults = propertyTypeFiltered.slice(0, parsedLimit);

      console.log(`📦 Multi-status search returned ${finalResults.length} listings from ${statusList.join(', ')}`);

      res.json({
        properties: finalResults,
        count: finalResults.length,
        statuses: statusList,
        schoolFilterWarning: schoolFilterWarning,
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

  // Polygon search - search properties within a drawn polygon boundary
  app.post("/api/properties/search/polygon", async (req, res) => {
    try {
      const { 
        boundary, 
        statuses, 
        limit = 50,
        type,  // 'sale' or 'lease' - default to 'sale' for CMA
        minBeds,
        maxBeds,
        minBaths,
        minPrice,
        maxPrice,
        minSqft,
        maxSqft,
        propertyType,
        minYearBuilt,
        maxYearBuilt,
        soldDays
      } = req.body;
      
      if (!boundary || !Array.isArray(boundary) || boundary.length === 0) {
        res.status(400).json({ error: "Valid boundary polygon is required" });
        return;
      }
      
      console.log(`[Polygon Search] Searching within boundary with ${statuses?.length || 1} status(es)`);
      console.log(`[Polygon Search] Boundary has ${boundary[0]?.length || 0} points:`, JSON.stringify(boundary[0]?.slice(0, 3)));
      console.log(`[Polygon Search] Filters: minBeds=${minBeds}, minBaths=${minBaths}, minPrice=${minPrice}, maxPrice=${maxPrice}, minSqft=${minSqft}, maxSqft=${maxSqft}`);
      
      const repliersClient = getRepliersClient();
      if (!repliersClient) {
        res.status(503).json({ error: "Repliers API not configured" });
        return;
      }
      
      const statusList: string[] = statuses || ['active'];
      const allResults: any[] = [];
      
      for (const status of statusList) {
        try {
          let searchParams: any = {
            class: 'residential',
            resultsPerPage: Math.min(limit, 100),
          };
          
          // Add filter parameters if provided
          if (minBeds) searchParams.minBeds = minBeds;
          if (maxBeds) searchParams.maxBeds = maxBeds;
          if (minBaths) searchParams.minBaths = minBaths;
          if (minPrice) searchParams.minPrice = minPrice;
          if (maxPrice) searchParams.maxPrice = maxPrice;
          if (minSqft) searchParams.minSqft = minSqft;
          if (maxSqft) searchParams.maxSqft = maxSqft;
          if (propertyType) searchParams.propertyType = propertyType;
          if (minYearBuilt) searchParams.minYearBuilt = minYearBuilt;
          if (maxYearBuilt) searchParams.maxYearBuilt = maxYearBuilt;
          if (soldDays && (status === 'closed' || status === 'sold')) {
            const soldDate = new Date();
            soldDate.setDate(soldDate.getDate() - soldDays);
            searchParams.soldAfter = soldDate.toISOString().split('T')[0];
          }
          
          // Map frontend status to Repliers API params
          if (status === 'active') {
            searchParams.status = 'A';
          } else if (status === 'under_contract') {
            searchParams.status = 'U';
          } else if (status === 'closed' || status === 'sold') {
            searchParams.standardStatus = 'Closed';
            // Use 'sale' type by default to exclude leased/rentals, but allow override
            searchParams.type = type || 'sale';
          }
          
          // Apply explicit type filter for all statuses if provided
          if (type && !searchParams.type) {
            searchParams.type = type;
          }
          
          const response = await repliersClient.searchListingsInBoundary(boundary, searchParams);
          const listings = response.listings || [];
          
          // Transform listings to standard format
          for (const listing of listings) {
            // Skip rentals - use type assertion for additional fields
            const listingAny = listing as any;
            const combined = [
              listing.details?.propertyType,
              listingAny.class,
              listingAny.type
            ].filter(Boolean).join(' ').toLowerCase();
            
            if (combined.includes('lease') || combined.includes('rental')) continue;
            
            // Skip listings with invalid/placeholder addresses (e.g., "0000", "00000")
            const streetNumber = String(listing.address?.streetNumber || '').trim();
            if (/^0+$/.test(streetNumber)) continue;
            
            const rawPhotos = Array.isArray(listing.images)
              ? listing.images.slice(0, 10)
              : [];
            const photos = rawPhotos.map((img: string) => 
              img.startsWith('http') ? img : `https://cdn.repliers.io/${img}`
            );
            
            const closePrice = listing.soldPrice || listing.closePrice;
            const standardStatus = status === 'active' ? 'Active'
              : status === 'under_contract' ? 'Active Under Contract'
              : 'Closed';
            
            const mlsNum = listing.mlsNumber || listingAny.listingId;
            const fullAddress = listing.address?.streetName 
              ? `${listing.address.streetNumber || ''} ${listing.address.streetName}${listing.address.streetSuffix ? ' ' + listing.address.streetSuffix : ''}`
              : listingAny.address?.full || 'Unknown';
            
            // Skip addresses that look like placeholders
            if (fullAddress.match(/^0{2,}/)) continue;
            
            allResults.push({
              id: `R-${mlsNum}`,
              listingId: mlsNum,
              unparsedAddress: fullAddress,
              city: listing.address?.city || null,
              stateOrProvince: listing.address?.state || 'TX',
              postalCode: listing.address?.zip || null,
              listPrice: listing.listPrice,
              closePrice: closePrice,
              standardStatus,
              bedroomsTotal: listing.details?.numBedrooms || null,
              bathroomsTotalInteger: listing.details?.numBathrooms || null,
              livingArea: listing.details?.sqft || null,
              yearBuilt: listing.details?.yearBuilt || null,
              propertySubType: listing.details?.propertyType || null,
              latitude: listing.map?.latitude || null,
              longitude: listing.map?.longitude || null,
              photos,
              daysOnMarket: listing.daysOnMarket || null,
              subdivisionName: listing.address?.neighborhood || listingAny.subdivisionName || null,
            });
          }
          
          console.log(`[Polygon Search] Found ${listings.length} ${status} listings in boundary`);
        } catch (err: any) {
          console.error(`[Polygon Search] Error fetching ${status}:`, err.message);
        }
      }
      
      // Apply rental filtering
      const rentalFilteredResults = filterOutRentals(allResults);
      
      // Apply property subtype filtering to exclude Land/Lots when Single Family selected
      const propertyTypeFiltered = filterByPropertySubtype(rentalFilteredResults, propertyType);
      if (rentalFilteredResults.length !== propertyTypeFiltered.length) {
        console.log(`[Polygon Search] Filtered out ${rentalFilteredResults.length - propertyTypeFiltered.length} listings due to property type mismatch`);
      }
      
      // Apply client-side point-in-polygon filtering as a fallback
      // in case the Repliers API didn't properly filter by boundary
      // Boundary coordinates are in [longitude, latitude] format (GeoJSON standard)
      const polygonFilteredResults = propertyTypeFiltered.filter((property: any) => {
        if (!property.latitude || !property.longitude) return false;
        const lat = parseFloat(String(property.latitude));
        const lng = parseFloat(String(property.longitude));
        if (isNaN(lat) || isNaN(lng)) return false;
        
        // Check if point is inside polygon using ray casting algorithm
        // Ring coordinates are [lng, lat] so xi=lng, yi=lat
        const ring = boundary[0];
        if (!ring || ring.length < 3) return true; // No valid polygon, keep all
        
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          // ring[i] = [longitude, latitude]
          const lngI = ring[i][0], latI = ring[i][1];
          const lngJ = ring[j][0], latJ = ring[j][1];
          
          // Ray casting: check if horizontal ray from point crosses edge
          const intersect = ((latI > lat) !== (latJ > lat)) &&
            (lng < (lngJ - lngI) * (lat - latI) / (latJ - latI) + lngI);
          if (intersect) inside = !inside;
        }
        
        return inside;
      });
      
      const finalResults = polygonFilteredResults.slice(0, limit);
      
      console.log(`[Polygon Search] Pre-filter: ${allResults.length}, Post-rental-filter: ${rentalFilteredResults.length}, Post-type-filter: ${propertyTypeFiltered.length}, Post-polygon-filter: ${polygonFilteredResults.length}, Returning: ${finalResults.length}`);
      
      res.json({
        properties: finalResults,
        count: finalResults.length,
        statuses: statusList,
      });
    } catch (error: any) {
      console.error("Polygon search error:", error.message);
      res.status(500).json({ error: "Failed to search within boundary" });
    }
  });

  // Inventory summary endpoint - returns total counts from ACTIVE data source (Repliers)
  // Uses unified inventory service for consistency with Dashboard
  app.get("/api/properties/inventory", async (req, res) => {
    try {
      // Use unified inventory service (same source as Dashboard)
      const inventoryData = await getUnifiedInventory();
      
      res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
      res.json(inventoryData);
    } catch (error) {
      console.error("Failed to fetch inventory summary:", error);
      res.status(500).json({ error: "Failed to fetch inventory summary" });
    }
  });

  // Debug endpoint for inventory data validation (development only)
  app.get("/api/properties/inventory/debug", async (req, res) => {
    try {
      const debugData = await getInventoryDebugData();
      res.json(debugData);
    } catch (error) {
      console.error("Failed to fetch inventory debug data:", error);
      res.status(500).json({ error: "Failed to fetch inventory debug data" });
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

            // CRITICAL: Repliers "neighborhood" field is actually subdivision (tract/community label)
            // True neighborhood must come from boundary polygon resolution, NOT listing data
            // Capture ALL candidate subdivision fields for debug display
            // Use type assertions for properties not in TypeScript defs but present in API response
            const rawSubdivisionFields = {
              'address.neighborhood': addr.neighborhood || null,
              'address.subdivisionName': (addr as any).subdivisionName || null,
              'details.subdivision': (details as any).subdivision || null,
              'listing.neighborhood': (listing as any).neighborhood || null,
              'listing.subdivisionName': (listing as any).subdivisionName || null,
              'details.community': (details as any).community || null,
              'details.development': (details as any).development || null,
            };
            
            // Fallback chain: addr.neighborhood > addr.subdivisionName > details.subdivision
            const subdivisionFromRepliers = addr.neighborhood || (addr as any).subdivisionName || (details as any).subdivision || null;
            const subdivisionSource = addr.neighborhood ? 'address.neighborhood' :
                                       (addr as any).subdivisionName ? 'address.subdivisionName' :
                                       (details as any).subdivision ? 'details.subdivision' : 'none';

            const normalizedProperty = {
              id: listing.mlsNumber,
              listingId: listing.mlsNumber,
              listingKey: listing.mlsNumber,
              standardStatus: (() => {
                // RESO-aligned status mapping for property detail lookup
                const statusMap: Record<string, string> = {
                  'A': 'Active',
                  'U': 'Active Under Contract',
                  'S': 'Closed',
                  'P': 'Pending',
                  'Active': 'Active',
                  'Active Under Contract': 'Active Under Contract',
                  'Under Contract': 'Active Under Contract',
                  'Pending': 'Pending',
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
              // Repliers "neighborhood" field = subdivision (tract label), NOT geographic neighborhood
              subdivision: subdivisionFromRepliers,
              subdivisionName: subdivisionFromRepliers,
              neighborhood: null,  // MUST be resolved from boundary polygons, never from listing data
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
              // DEV debug data: raw Repliers fields and fallback chain
              _debug: {
                dataSource: 'Repliers API',
                fetchTimestamp: new Date().toISOString(),
                rawFields: rawSubdivisionFields,
                subdivisionSource: subdivisionSource,
                subdivisionValue: subdivisionFromRepliers,
                rawAddress: {
                  streetNumber: addr.streetNumber || null,
                  streetName: addr.streetName || null,
                  streetSuffix: addr.streetSuffix || null,
                  unitNumber: addr.unitNumber || null,
                  city: addr.city || null,
                  state: addr.state || null,
                  zip: addr.zip || null,
                },
              },
            };
            
            res.json(normalizedProperty);
            return;
          }
        }
      }
      
      // Default: try local database
      const property = await storage.getProperty(id);
      if (property) {
        // CRITICAL: Legacy records may have subdivision stored in neighborhood field
        // Use type assertions for legacy field access
        const propAny = property as any;
        const subdivisionValue = property.subdivision || propAny.subdivisionName || property.neighborhood || null;
        const subdivisionSource = property.subdivision ? 'db.subdivision' :
                                   propAny.subdivisionName ? 'db.subdivisionName' :
                                   property.neighborhood ? 'db.neighborhood (legacy)' : 'none';
        res.json({
          ...property,
          subdivision: subdivisionValue,
          subdivisionName: subdivisionValue,
          neighborhood: null,  // MUST be resolved from boundary polygons, never from listing data
          _debug: {
            dataSource: 'PostgreSQL Database',
            fetchTimestamp: new Date().toISOString(),
            rawFields: {
              'db.subdivision': property.subdivision || null,
              'db.subdivisionName': propAny.subdivisionName || null,
              'db.neighborhood (legacy)': property.neighborhood || null,
            },
            subdivisionSource: subdivisionSource,
            subdivisionValue: subdivisionValue,
          },
        });
        return;
      }
      
      // Also try by listing ID if direct ID lookup fails
      const propertyByListingId = await storage.getPropertyByListingId(id);
      if (propertyByListingId) {
        // CRITICAL: Legacy records may have subdivision stored in neighborhood field
        // Use type assertions for legacy field access
        const propAny = propertyByListingId as any;
        const subdivisionValue = propertyByListingId.subdivision || propAny.subdivisionName || propertyByListingId.neighborhood || null;
        const subdivisionSource = propertyByListingId.subdivision ? 'db.subdivision' :
                                   propAny.subdivisionName ? 'db.subdivisionName' :
                                   propertyByListingId.neighborhood ? 'db.neighborhood (legacy)' : 'none';
        res.json({
          ...propertyByListingId,
          subdivision: subdivisionValue,
          subdivisionName: subdivisionValue,
          neighborhood: null,  // MUST be resolved from boundary polygons, never from listing data
          _debug: {
            dataSource: 'PostgreSQL Database',
            fetchTimestamp: new Date().toISOString(),
            rawFields: {
              'db.subdivision': propertyByListingId.subdivision || null,
              'db.subdivisionName': propAny.subdivisionName || null,
              'db.neighborhood (legacy)': propertyByListingId.neighborhood || null,
            },
            subdivisionSource: subdivisionSource,
            subdivisionValue: subdivisionValue,
          },
        });
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
      
      // CRITICAL: Legacy records may have subdivision stored in neighborhood field
      // Use type assertions for legacy field access
      const normalizedProperties = paginatedProperties.map(p => {
        const pAny = p as any;
        const subdivisionValue = p.subdivision || pAny.subdivisionName || p.neighborhood || null;
        return {
          ...p,
          subdivision: subdivisionValue,
          subdivisionName: subdivisionValue,
          neighborhood: null,  // MUST be resolved from boundary polygons, never from listing data
        };
      });
      
      res.json(normalizedProperties);
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
      const { name, criteria } = req.body;
      
      if (!name || !criteria) {
        res.status(400).json({ error: "Name and criteria are required" });
        return;
      }
      
      // Use authenticated user's ID if available, otherwise null for anonymous saves
      const user = req.user as any;
      const userId = user?.id || null;
      
      const search = await storage.createSavedSearch({
        name,
        criteria,
        userId,
      });
      res.status(201).json(search);
    } catch (error) {
      console.error('Failed to create saved search:', error);
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
          subjectPropertyId: cma.subjectPropertyId || null,
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
      
      // Validate email is present and valid
      const email = updateData.email;
      if (!email || !email.trim() || !email.includes('@')) {
        res.status(400).json({ error: "A valid email address is required" });
        return;
      }
      
      // Validate name is present
      if (!updateData.name || !updateData.name.trim()) {
        res.status(400).json({ error: "Name is required" });
        return;
      }
      
      // Handle user ID resolution:
      // - If userId is "guest" or any non-existent user ID, find/create user by email
      let userId = updateData.userId;
      
      if (userId === "guest" || userId === "demo-user-id") {
        // Guest or demo user - find or create by email
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
      } else {
        // For other userIds, verify the user exists
        const existingUser = await storage.getUser(userId);
        if (!existingUser) {
          // User doesn't exist - find or create by email instead
          let user = await storage.getUserByEmail(email);
          
          if (!user) {
            user = await storage.createUser({
              email,
              passwordHash: "",
              role: "client",
              firstName: updateData.name.split(' ')[0],
              lastName: updateData.name.split(' ').slice(1).join(' ') || "",
            });
          }
          
          userId = user.id;
        }
      }
      
      // Calculate initial next send date based on frequency
      const { calculateNextSendDate } = await import('./sendgrid-service');
      const nextSendAt = calculateNextSendDate(updateData.emailFrequency);
      
      const update = await storage.createSellerUpdate({
        ...updateData,
        userId,
      });
      
      // Update with next send date (storage doesn't accept it in insert)
      const updatedWithNextSend = await storage.updateSellerUpdate(update.id, { nextSendAt });
      
      res.status(201).json(updatedWithNextSend || update);
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

  // Send test email for a seller update
  app.post("/api/seller-updates/:id/send-test", async (req, res) => {
    try {
      const { sendSellerUpdateEmail, isSendGridConfigured, initSendGrid } = await import('./sendgrid-service');
      const { findMatchingPropertiesForUpdate, getAgentInfoForUpdate } = await import('./seller-update-scheduler');
      
      if (!isSendGridConfigured()) {
        res.status(400).json({ error: "SendGrid is not configured. Please add SENDGRID_API_KEY and SENDGRID_TEMPLATE_ID environment variables." });
        return;
      }
      
      initSendGrid();
      
      const sellerUpdate = await storage.getSellerUpdate(req.params.id);
      if (!sellerUpdate) {
        res.status(404).json({ error: "Seller update not found" });
        return;
      }
      
      const agent = await getAgentInfoForUpdate(sellerUpdate.userId);
      if (!agent) {
        res.status(400).json({ error: "Could not find agent information for this update" });
        return;
      }
      
      const properties = await findMatchingPropertiesForUpdate(sellerUpdate);
      
      const result = await sendSellerUpdateEmail(
        sellerUpdate,
        properties,
        agent,
        sellerUpdate.name,
        true // isTest = true, sends to agent's email
      );
      
      // Log the test send
      await storage.createSendHistory({
        sellerUpdateId: sellerUpdate.id,
        recipientEmail: agent.email,
        status: result.success ? 'success' : 'failed',
        propertyCount: properties.length,
        errorMessage: result.error,
        sendgridMessageId: result.messageId,
      });
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: `Test email sent to ${agent.email}`,
          propertyCount: properties.length 
        });
      } else {
        res.status(500).json({ error: result.error || "Failed to send test email" });
      }
    } catch (error: any) {
      console.error("Error sending test email:", error);
      res.status(500).json({ error: error.message || "Failed to send test email" });
    }
  });

  // Toggle active status for a seller update
  app.post("/api/seller-updates/:id/toggle-active", async (req, res) => {
    try {
      const { calculateNextSendDate } = await import('./sendgrid-service');
      
      const sellerUpdate = await storage.getSellerUpdate(req.params.id);
      if (!sellerUpdate) {
        res.status(404).json({ error: "Seller update not found" });
        return;
      }
      
      const newIsActive = !sellerUpdate.isActive;
      
      // If activating, calculate next send date
      const updates: any = { isActive: newIsActive };
      if (newIsActive && !sellerUpdate.nextSendAt) {
        updates.nextSendAt = calculateNextSendDate(sellerUpdate.emailFrequency);
      }
      
      const updated = await storage.updateSellerUpdate(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle seller update status" });
    }
  });

  // Get send history for a seller update
  app.get("/api/seller-updates/:id/history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      
      const sellerUpdate = await storage.getSellerUpdate(req.params.id);
      if (!sellerUpdate) {
        res.status(404).json({ error: "Seller update not found" });
        return;
      }
      
      const history = await storage.getSendHistory(req.params.id, limit);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch send history" });
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
                      // RESO-aligned status mapping
                      const statusMap: Record<string, string> = {
                        'A': 'Active', 'U': 'Active Under Contract', 'S': 'Closed', 'P': 'Pending',
                        'Active': 'Active', 'Active Under Contract': 'Active Under Contract',
                        'Under Contract': 'Active Under Contract', 'Pending': 'Pending',
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

      // Dev-only debug logging for PDF cross-check capability
      // This logs property data for verifying Repliers data matches external sources (e.g., Quick CMA PDFs)
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 CMA Statistics - Processing', properties.length, 'properties');
        properties.forEach((p: any, idx: number) => {
          const price = Number(p.closePrice || p.listPrice);
          const area = Number(p.livingArea);
          console.log(`  [${idx}] ${p.unparsedAddress || p.address || 'Unknown'}: closePrice=${p.closePrice}, listPrice=${p.listPrice}, livingArea=${area}, $/sqft=${area > 0 ? (price/area).toFixed(2) : 'N/A'}`);
        });
      }

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

  // Display Preferences endpoints
  app.get("/api/display-preferences", async (req, res) => {
    try {
      let preferences = await storage.getDisplayPreferences();
      
      // If no preferences exist, create a row with defaults
      if (!preferences) {
        preferences = await storage.updateDisplayPreferences({
          priceFormat: 'commas',
          areaUnit: 'sqft',
          dateFormat: 'MM/DD/YYYY',
          includeAgentBranding: true,
          includeMarketStats: true,
        });
      }
      
      res.json(preferences);
    } catch (error) {
      console.error('Error fetching display preferences:', error);
      res.status(500).json({ error: 'Failed to fetch display preferences' });
    }
  });

  app.put("/api/display-preferences", async (req, res) => {
    try {
      const { priceFormat, areaUnit, dateFormat, includeAgentBranding, includeMarketStats } = req.body;
      
      // Validate inputs
      const validPriceFormats = ['commas', 'abbreviated', 'suffix'];
      const validAreaUnits = ['sqft', 'sqm', 'acres'];
      const validDateFormats = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];
      
      if (priceFormat && !validPriceFormats.includes(priceFormat)) {
        res.status(400).json({ error: 'Invalid price format' });
        return;
      }
      if (areaUnit && !validAreaUnits.includes(areaUnit)) {
        res.status(400).json({ error: 'Invalid area unit' });
        return;
      }
      if (dateFormat && !validDateFormats.includes(dateFormat)) {
        res.status(400).json({ error: 'Invalid date format' });
        return;
      }
      
      // Build update object with only defined values
      const updates: Record<string, any> = {};
      if (priceFormat !== undefined) updates.priceFormat = priceFormat;
      if (areaUnit !== undefined) updates.areaUnit = areaUnit;
      if (dateFormat !== undefined) updates.dateFormat = dateFormat;
      if (includeAgentBranding !== undefined) updates.includeAgentBranding = includeAgentBranding;
      if (includeMarketStats !== undefined) updates.includeMarketStats = includeMarketStats;
      
      const preferences = await storage.updateDisplayPreferences(updates);
      
      res.json(preferences);
    } catch (error) {
      console.error('Error updating display preferences:', error);
      res.status(500).json({ error: 'Failed to update display preferences' });
    }
  });

  // Repliers/MLS Grid sync endpoint - triggers manual sync for active and sold data
  // Note: No auth required for single-agent tool
  app.post("/api/sync", async (req, res) => {
    try {
      console.log('🔄 Manual data sync triggered by user');
      
      const syncResults = {
        repliers: { success: false, message: '', count: 0 },
        mlsGrid: { success: false, message: '', initiated: false }
      };
      
      // Sync from Repliers (Active/Under Contract listings - real-time)
      if (repliersClient) {
        console.log('📡 Syncing active listings from Repliers API...');
        try {
          const testResult = await repliersClient.searchListings({
            standardStatus: 'Active',
            resultsPerPage: 5,
          });
          
          console.log(`✅ Repliers sync verified: ${testResult.count} total active listings available`);
          syncResults.repliers = { 
            success: true, 
            message: 'Active listings verified', 
            count: testResult.count 
          };
          syncTimestamps.lastDataPull = new Date();
        } catch (repliersError: any) {
          console.error('❌ Repliers sync failed:', repliersError.message);
          syncResults.repliers.message = repliersError.message;
        }
      }
      
      // Always sync from MLS Grid for sold/closed data (stored in database)
      if (mlsGridClient) {
        console.log('📊 Syncing sold/closed data from MLS Grid...');
        syncResults.mlsGrid.initiated = true;
        
        // Trigger async sync - don't wait for it
        triggerManualSync()
          .then(() => {
            console.log('✅ Manual MLS Grid sync completed - sold data updated');
            syncTimestamps.lastSuccessfulSync = new Date();
          })
          .catch(err => {
            console.error('❌ Manual MLS Grid sync failed:', err.message || err);
          });
        
        syncResults.mlsGrid.success = true;
        syncResults.mlsGrid.message = 'Sync initiated (runs in background)';
      }
      
      syncTimestamps.lastSyncAttempt = new Date();
      
      // Build response based on what was synced
      if (syncResults.repliers.success || syncResults.mlsGrid.initiated) {
        syncTimestamps.lastSuccessfulSync = new Date();
        
        res.json({ 
          message: "Data sync initiated successfully", 
          timestamp: new Date().toISOString(),
          sources: {
            repliers: syncResults.repliers.success 
              ? `Active listings verified (${syncResults.repliers.count} available)` 
              : 'Not available',
            mlsGrid: syncResults.mlsGrid.initiated 
              ? 'Sold data sync running in background' 
              : 'Not configured'
          },
          note: syncResults.mlsGrid.initiated 
            ? 'MLS Grid sync for sold data may take several minutes. Check server logs for progress.'
            : undefined,
          status: "success"
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

  // MLS Grid diagnostic endpoint - test API connection (no auth required for diagnostics)
  app.get("/api/mlsgrid/test", async (req, res) => {
    try {
      if (!mlsGridClient) {
        res.status(503).json({ 
          success: false,
          error: "MLS Grid API not configured - missing MLSGRID_API_URL or MLSGRID_API_TOKEN",
          configured: false
        });
        return;
      }

      console.log('🔍 Testing MLS Grid API connection...');
      
      // Try to fetch a small batch of properties to verify connection
      const testResult = await mlsGridClient.getProperties({ limit: 1 });
      
      const propertyCount = testResult?.value?.length || 0;
      const sampleProperty = testResult?.value?.[0];
      
      console.log(`✅ MLS Grid API test successful - got ${propertyCount} properties`);
      
      res.json({
        success: true,
        configured: true,
        message: "MLS Grid API connection successful",
        testResults: {
          propertiesReturned: propertyCount,
          sampleListingId: sampleProperty?.ListingId || sampleProperty?.ListingKey || null,
          sampleStatus: sampleProperty?.StandardStatus || null,
          sampleCity: sampleProperty?.City || null,
        }
      });
    } catch (error: any) {
      console.error('❌ MLS Grid API test failed:', error.message);
      console.error('Full error:', error.response?.data || error);
      
      res.status(500).json({
        success: false,
        configured: true,
        error: error.message,
        details: error.response?.data || null,
        statusCode: error.response?.status || null
      });
    }
  });

  // Repliers API diagnostic endpoint - test connection and capabilities
  app.get("/api/repliers/test", async (req, res) => {
    try {
      if (!repliersClient) {
        res.status(503).json({ 
          success: false,
          error: "Repliers API not configured - missing REPLIERS_API_KEY",
          configured: false,
          capabilities: { active: false, underContract: false, sold: false }
        });
        return;
      }

      console.log('🔍 Testing Repliers API connection and capabilities...');
      
      const capabilities = { active: false, underContract: false, sold: false };
      const testResults: any = {};
      
      // Test Active listings using RESO-compliant standardStatus
      try {
        const activeResult = await repliersClient.searchListings({
          standardStatus: 'Active',
          class: 'residential',
          resultsPerPage: 1,
          pageNum: 1
        });
        capabilities.active = true;
        testResults.activeCount = (activeResult as any).numResults || activeResult.listings?.length || 0;
        console.log(`✅ Repliers Active (standardStatus=Active) test successful`);
      } catch (err: any) {
        console.log(`❌ Repliers Active test failed:`, err.message);
        testResults.activeError = err.message;
      }
      
      // Test Under Contract / Pending listings
      try {
        const ucResult = await repliersClient.searchListings({
          standardStatus: 'Pending',
          class: 'residential',
          resultsPerPage: 1,
          pageNum: 1
        });
        capabilities.underContract = true;
        testResults.underContractCount = (ucResult as any).numResults || ucResult.listings?.length || 0;
        console.log(`✅ Repliers Pending (standardStatus=Pending) test successful`);
      } catch (err: any) {
        console.log(`❌ Repliers Pending test failed:`, err.message);
        testResults.underContractError = err.message;
      }
      
      // Test Closed/Sold listings using RESO-compliant standardStatus
      try {
        const soldResult = await repliersClient.searchListings({
          standardStatus: 'Closed',
          class: 'residential',
          resultsPerPage: 1,
          pageNum: 1
        });
        capabilities.sold = true;
        testResults.soldCount = (soldResult as any).numResults || soldResult.listings?.length || 0;
        console.log(`✅ Repliers Closed (standardStatus=Closed) test successful`);
      } catch (err: any) {
        console.log(`⚠️ Repliers Closed not available:`, err.message);
        testResults.soldError = err.message;
        testResults.soldNote = "Check Repliers documentation for standardStatus filtering.";
      }
      
      const success = capabilities.active || capabilities.underContract;
      
      res.json({
        success,
        configured: true,
        message: success 
          ? `Repliers API connected. Active: ${capabilities.active ? 'Yes' : 'No'}, Under Contract: ${capabilities.underContract ? 'Yes' : 'No'}, Sold: ${capabilities.sold ? 'Yes' : 'No (contact Repliers to enable)'}`
          : "Repliers API configured but no data access",
        capabilities,
        testResults
      });
    } catch (error: any) {
      console.error('❌ Repliers API test failed:', error.message);
      
      res.status(500).json({
        success: false,
        configured: true,
        error: error.message,
        capabilities: { active: false, underContract: false, sold: false }
      });
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
        // Combine subdivisions and neighborhoods params - both map to subdivision field
        subdivisions: [...(parseArray(req.query.subdivisions) || []), ...(parseArray(req.query.neighborhoods) || [])].length > 0
          ? [...(parseArray(req.query.subdivisions) || []), ...(parseArray(req.query.neighborhoods) || [])]
          : undefined,
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
        schoolDistrict: req.query.schoolDistrict as string,
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
      // Keyword/address search params
      if (req.query.search) params.search = req.query.search as string;
      if (req.query.searchFields) params.searchFields = req.query.searchFields as string;
      if (req.query.fuzzySearch === 'true') params.fuzzySearch = true;
      
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
      
      // Apply server-side propertySubType filter using centralized guard
      // This excludes Land/Lots when Single Family is selected
      if (propertySubTypeFilter) {
        const beforeCount = standardizedProperties.length;
        standardizedProperties = filterByPropertySubtype(standardizedProperties, propertySubTypeFilter);
        if (beforeCount !== standardizedProperties.length) {
          console.log(`[Properties Search] Property type filter: ${beforeCount} -> ${standardizedProperties.length} (excluded ${beforeCount - standardizedProperties.length} non-matching)`);
        }
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

  // Repliers NLP proxy - converts natural language to search URL
  // Returns structured response for sanitizer pipeline
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
      
      // Handle 406 errors gracefully
      if (result.status === 'error' && result.errorCode === 406) {
        res.status(406).json({ 
          error: result.errorMessage,
          repliersRequestUrl: '',
          repliersRequestBody: null,
          repliersSummary: '',
          nlpId: result.nlpId || nlpId || '',
        });
        return;
      }
      
      // Handle other errors
      if (result.status === 'error') {
        res.status(result.errorCode || 500).json({ 
          error: result.errorMessage || 'NLP search failed',
        });
        return;
      }
      
      // Return structured response for sanitizer pipeline
      res.json({
        repliersRequestUrl: result.url || '',
        repliersRequestBody: result.requestBody || null,
        repliersSummary: result.summary || '',
        nlpId: result.nlpId || '',
      });
    } catch (error: any) {
      console.error("Repliers NLP error:", error.message);
      res.status(500).json({ error: "Failed to perform NLP search" });
    }
  });
  
  // OpenAI Sanitizer/Normalizer for Repliers NLP output
  // Converts NLP URL to our filter schema + safe summary
  app.post("/api/ai/sanitize-repliers-nlp", async (req, res) => {
    try {
      const { userPrompt, repliersRequestUrl, repliersRequestBody, repliersSummary } = req.body;
      
      if (!userPrompt) {
        res.status(400).json({ error: "userPrompt is required" });
        return;
      }
      
      // Parse the Repliers URL to extract params
      let parsedParams: Record<string, string> = {};
      try {
        if (repliersRequestUrl) {
          const url = new URL(repliersRequestUrl, 'https://api.repliers.io');
          parsedParams = Object.fromEntries(url.searchParams.entries());
        }
      } catch (e) {
        console.warn('Failed to parse Repliers URL:', e);
      }
      
      // Fetch valid subdivisions for matching (use city if available)
      let validSubdivisions: string[] = [];
      try {
        const cityFromParams = parsedParams.city || '';
        const results = await storage.getAutocompleteSubdivisions('', 500); // Get all subdivisions
        validSubdivisions = results.map(r => r.value);
      } catch (e) {
        console.warn('Failed to fetch subdivisions:', e);
      }
      
      // Build sanitization prompt for OpenAI
      const sanitizePrompt = `You are a RESO-compliant real estate search filter sanitizer.

INPUT:
- User prompt: "${userPrompt}"
- Repliers NLP URL params: ${JSON.stringify(parsedParams)}
- Repliers summary: "${repliersSummary || ''}"
- Available subdivisions for matching: ${validSubdivisions.slice(0, 100).join(', ')}${validSubdivisions.length > 100 ? '...' : ''}

TASK:
Convert the NLP output to our internal filter schema. Apply these MANDATORY RULES:

1. STRIP NEIGHBORHOOD: If there's a "neighborhood" param, REMOVE it and add a warning. We use Subdivision instead.

2. MATCH SUBDIVISION SAFELY: 
   - Only set "subdivision" if it EXACTLY matches (case-insensitive) one from the valid list.
   - If no exact match, leave it blank and add warning: "Subdivision not matched - please select manually."

3. ENFORCE standardStatus ONLY:
   - Convert status terms to RESO standardStatus: Active, Active Under Contract, Pending, Closed
   - "active" → "Active"
   - "under contract" or "pending" → "Pending" 
   - "sold" or "closed" → "Closed"
   - Drop any "status" or "lastStatus" params and use only standardStatus.

4. DROP UNSUPPORTED PARAMS:
   - We support: city, subdivision, postalCode, propertyType, minBeds, minBaths, minPrice, maxPrice, standardStatus, keywords
   - Drop any other params and add a warning.

5. CREATE SANITIZED SUMMARY:
   - Write a friendly summary of what the search will find.
   - Keep it concise (1-2 sentences).

OUTPUT JSON:
{
  "filters": {
    "city": "string or empty",
    "subdivision": "string or empty", 
    "postalCode": "string or empty",
    "propertyType": "Single Family|Condo|Townhouse|Land|Multi-Family or empty",
    "minBeds": number or 0,
    "minBaths": number or 0,
    "minPrice": number or 0,
    "maxPrice": number or 0,
    "standardStatus": "Active|Active Under Contract|Pending|Closed or empty",
    "keywords": "string or empty"
  },
  "sanitizedSummary": "Friendly summary of the search",
  "warnings": ["array of warning strings"]
}`;

      // Call OpenAI
      const openai = await import("openai");
      const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY });
      
      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a RESO-compliant filter sanitizer. Always respond with valid JSON only." },
          { role: "user", content: sanitizePrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });
      
      const responseText = completion.choices[0]?.message?.content || '{}';
      let sanitizedResult;
      
      try {
        sanitizedResult = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse OpenAI response:', responseText);
        res.status(500).json({ error: "Failed to parse sanitizer response" });
        return;
      }
      
      // SERVER-SIDE VALIDATION - enforce rules even if OpenAI doesn't
      const warnings: string[] = [...(sanitizedResult.warnings || [])];
      const filters = sanitizedResult.filters || {};
      
      // Rule 1: FORCEFULLY strip neighborhood from both original params AND sanitized response
      if (parsedParams.neighborhood || filters.neighborhood) {
        delete filters.neighborhood; // Forcefully remove from response
        if (!warnings.includes("Neighborhood removed (we use Subdivision instead).")) {
          warnings.push("Neighborhood removed (we use Subdivision instead).");
        }
      }
      
      // Rule 2: Validate subdivision against known list (case-insensitive exact match)
      let validatedSubdivision = '';
      if (filters.subdivision) {
        const subdivisionLower = filters.subdivision.toLowerCase();
        const matchedSubdiv = validSubdivisions.find(s => s.toLowerCase() === subdivisionLower);
        if (matchedSubdiv) {
          validatedSubdivision = matchedSubdiv;
        } else {
          warnings.push(`Subdivision "${filters.subdivision}" not matched - please select manually.`);
        }
      }
      
      // Rule 3: Normalize status to RESO standardStatus only
      let normalizedStatus = '';
      const statusRaw = (filters.standardStatus || '').toLowerCase().trim();
      if (statusRaw === 'active') {
        normalizedStatus = 'Active';
      } else if (statusRaw === 'active under contract' || statusRaw === 'activeundercontract' || statusRaw === 'under contract') {
        normalizedStatus = 'Active Under Contract';
      } else if (statusRaw === 'pending') {
        normalizedStatus = 'Pending';
      } else if (statusRaw === 'closed' || statusRaw === 'sold') {
        normalizedStatus = 'Closed';
      }
      
      // Rule 4: Validate property type against expanded RESO-compliant list
      const validPropertyTypes = [
        'Single Family', 'Condo', 'Townhouse', 'Land', 'Multi-Family', 'Residential',
        'Duplex', 'Triplex', 'Quadruplex', 'Farm', 'Ranch', 'Manufactured Home', 
        'Mobile Home', 'Apartment', 'Commercial', 'Industrial', 'Vacant Land',
        'Acreage', 'Lots/Land'
      ];
      let validatedPropertyType = '';
      if (filters.propertyType) {
        const ptLower = filters.propertyType.toLowerCase();
        const matchedPt = validPropertyTypes.find(pt => pt.toLowerCase() === ptLower);
        if (matchedPt) {
          validatedPropertyType = matchedPt;
        } else {
          warnings.push(`Property type "${filters.propertyType}" not recognized - please select manually.`);
        }
      }
      
      // Build final validated result
      const result = {
        filters: {
          city: filters.city || '',
          subdivision: validatedSubdivision,
          postalCode: filters.postalCode || '',
          propertyType: validatedPropertyType,
          minBeds: Number(filters.minBeds) || 0,
          minBaths: Number(filters.minBaths) || 0,
          minPrice: Number(filters.minPrice) || 0,
          maxPrice: Number(filters.maxPrice) || 0,
          standardStatus: normalizedStatus,
          keywords: filters.keywords || '',
        },
        sanitizedSummary: sanitizedResult.sanitizedSummary || 'Searching for properties...',
        warnings,
        imageSearchItems: repliersRequestBody?.imageSearchItems || null,
      };
      
      console.log('✅ [AI Sanitizer] Validated result:', JSON.stringify(result.filters));
      res.json(result);
      
    } catch (error: any) {
      console.error("AI Sanitizer error:", error.message);
      res.status(500).json({ error: "Failed to sanitize search filters" });
    }
  });

  // OpenAI-only natural language parser (fallback when Repliers NLP unavailable)
  // This endpoint parses user prompts directly via OpenAI without calling Repliers NLP
  app.post("/api/ai/parse-natural-language", async (req, res) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: "prompt is required" });
        return;
      }
      
      if (!process.env.OPENAI_API_KEY) {
        res.status(503).json({ error: "OpenAI not configured" });
        return;
      }
      
      console.log(`🤖 [OpenAI NLP] Parsing: "${prompt.slice(0, 50)}..."`);
      
      // Fetch valid subdivisions for matching
      let validSubdivisions: string[] = [];
      try {
        const results = await storage.getAutocompleteSubdivisions('', 500);
        validSubdivisions = results.map(r => r.value);
      } catch (e) {
        console.warn('Failed to fetch subdivisions:', e);
      }
      
      // Build prompt for OpenAI to parse natural language directly
      const parsePrompt = `You are a real estate search assistant. Parse the user's natural language query into structured search filters.

USER QUERY: "${prompt}"

AVAILABLE SUBDIVISIONS (match exactly if mentioned): ${validSubdivisions.slice(0, 100).join(', ')}${validSubdivisions.length > 100 ? '...' : ''}

Parse the query and extract these fields:
- city: City name (Austin, Round Rock, Pflugerville, etc.)
- subdivision: Only if it EXACTLY matches one from the list above (case-insensitive)
- postalCode: ZIP code if mentioned
- propertyType: Single Family, Condo, Townhouse, Land, Multi-Family, Duplex, Farm, Manufactured Home
- minBeds: Minimum bedrooms (number)
- minBaths: Minimum bathrooms (number)
- minPrice: Minimum price (number, no commas)
- maxPrice: Maximum price (number, no commas). Note: "under 800k" = maxPrice 800000
- standardStatus: Active, Active Under Contract, Pending, or Closed
  - "active" → Active
  - "under contract" → Active Under Contract  
  - "pending" → Pending
  - "sold" or "closed" → Closed
  - Default to Active if not specified
- keywords: Any other descriptive terms (pool, updated kitchen, etc.)

OUTPUT JSON:
{
  "filters": {
    "city": "string or empty",
    "subdivision": "string or empty (only if exact match)",
    "postalCode": "string or empty",
    "propertyType": "string or empty",
    "minBeds": number or 0,
    "minBaths": number or 0,
    "minPrice": number or 0,
    "maxPrice": number or 0,
    "standardStatus": "Active|Active Under Contract|Pending|Closed",
    "keywords": "string or empty"
  },
  "summary": "Friendly 1-2 sentence description of what was understood",
  "warnings": ["array of any issues or clarifications needed"]
}`;
      
      const openai = await import("openai");
      const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY });
      
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini", // Use mini for cost efficiency
        messages: [
          { role: "system", content: "You are a real estate search parser. Always respond with valid JSON only." },
          { role: "user", content: parsePrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 500,
      });
      
      const responseText = completion.choices[0]?.message?.content || '{}';
      let parsed;
      
      try {
        parsed = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse OpenAI response:', responseText);
        res.status(500).json({ error: "Failed to parse AI response" });
        return;
      }
      
      const filters = parsed.filters || {};
      const warnings: string[] = [...(parsed.warnings || [])];
      
      // Apply same server-side validation as the sanitizer
      // Rule 1: Strip neighborhood
      if (filters.neighborhood) {
        delete filters.neighborhood;
        warnings.push("Neighborhood removed (we use Subdivision instead).");
      }
      
      // Rule 2: Normalize status
      let normalizedStatus = 'Active';
      const statusRaw = (filters.standardStatus || '').toLowerCase().trim();
      if (statusRaw === 'active') {
        normalizedStatus = 'Active';
      } else if (statusRaw === 'active under contract' || statusRaw === 'under contract') {
        normalizedStatus = 'Active Under Contract';
      } else if (statusRaw === 'pending') {
        normalizedStatus = 'Pending';
      } else if (statusRaw === 'closed' || statusRaw === 'sold') {
        normalizedStatus = 'Closed';
      }
      
      // Rule 3: Validate subdivision
      let validatedSubdivision = '';
      if (filters.subdivision) {
        const subdivLower = filters.subdivision.toLowerCase();
        const matched = validSubdivisions.find(s => s.toLowerCase() === subdivLower);
        if (matched) {
          validatedSubdivision = matched;
        } else {
          warnings.push(`Subdivision "${filters.subdivision}" not matched - please select manually.`);
        }
      }
      
      // Rule 4: Validate property type
      const validPropertyTypes = [
        'Single Family', 'Condo', 'Townhouse', 'Land', 'Multi-Family',
        'Duplex', 'Triplex', 'Quadruplex', 'Farm', 'Ranch', 'Manufactured Home'
      ];
      let validatedPropertyType = '';
      if (filters.propertyType) {
        const ptLower = filters.propertyType.toLowerCase();
        const matched = validPropertyTypes.find(pt => pt.toLowerCase() === ptLower);
        if (matched) {
          validatedPropertyType = matched;
        }
      }
      
      const result = {
        filters: {
          city: filters.city || '',
          subdivision: validatedSubdivision,
          postalCode: filters.postalCode || '',
          propertyType: validatedPropertyType,
          minBeds: Number(filters.minBeds) || 0,
          minBaths: Number(filters.minBaths) || 0,
          minPrice: Number(filters.minPrice) || 0,
          maxPrice: Number(filters.maxPrice) || 0,
          standardStatus: normalizedStatus,
          keywords: filters.keywords || '',
        },
        sanitizedSummary: parsed.summary || 'Searching for properties...',
        warnings,
      };
      
      console.log('✅ [OpenAI NLP] Parsed result:', JSON.stringify(result.filters));
      res.json(result);
      
    } catch (error: any) {
      console.error("OpenAI NLP error:", error.message);
      res.status(500).json({ error: "Failed to parse search query" });
    }
  });

  // AI Image Search - ranks listings by visual similarity
  // Reference: https://help.repliers.com/en/article/ai-image-search-implementation-guide-mx30ji/
  app.post("/api/repliers/image-search", async (req, res) => {
    try {
      const client = getRepliersClient();
      if (!client) {
        res.status(503).json({ error: "Repliers API not configured" });
        return;
      }

      const { imageSearchItems, criteria } = req.body;
      
      // Validate imageSearchItems
      if (!imageSearchItems || !Array.isArray(imageSearchItems) || imageSearchItems.length === 0) {
        res.status(400).json({ error: "imageSearchItems array is required with at least one item" });
        return;
      }
      
      if (imageSearchItems.length > 10) {
        res.status(400).json({ error: "Maximum 10 imageSearchItems allowed" });
        return;
      }
      
      // Validate each item
      for (const item of imageSearchItems) {
        if (!item.type || !['text', 'image'].includes(item.type)) {
          res.status(400).json({ error: "Each item must have type 'text' or 'image'" });
          return;
        }
        if (item.type === 'text' && !item.value) {
          res.status(400).json({ error: "Text items must have a value" });
          return;
        }
        if (item.type === 'image') {
          if (!item.url) {
            res.status(400).json({ error: "Image items must have a url" });
            return;
          }
          if (!item.url.startsWith('http://') && !item.url.startsWith('https://')) {
            res.status(400).json({ error: "Image URLs must be http or https" });
            return;
          }
        }
        // Ensure boost is numeric
        if (item.boost !== undefined && typeof item.boost !== 'number') {
          res.status(400).json({ error: "Boost must be a number" });
          return;
        }
      }
      
      // Build search params from criteria
      const searchParams: any = {
        imageSearchItems,
        resultsPerPage: criteria?.resultsPerPage || 100,
        pageNum: criteria?.pageNum || 1,
      };
      
      // Add optional criteria filters
      if (criteria) {
        if (criteria.standardStatus) searchParams.standardStatus = criteria.standardStatus;
        if (criteria.status) searchParams.status = criteria.status;
        if (criteria.type) searchParams.type = criteria.type;
        if (criteria.city) searchParams.city = criteria.city;
        if (criteria.subdivision) searchParams.subdivision = criteria.subdivision;
        if (criteria.postalCode) searchParams.postalCode = criteria.postalCode;
        if (criteria.minPrice) searchParams.minPrice = criteria.minPrice;
        if (criteria.maxPrice) searchParams.maxPrice = criteria.maxPrice;
        if (criteria.minBeds) searchParams.minBeds = criteria.minBeds;
        if (criteria.maxBeds) searchParams.maxBeds = criteria.maxBeds;
        if (criteria.minBaths) searchParams.minBaths = criteria.minBaths;
        if (criteria.maxBaths) searchParams.maxBaths = criteria.maxBaths;
        if (criteria.minSqft) searchParams.minSqft = criteria.minSqft;
        if (criteria.maxSqft) searchParams.maxSqft = criteria.maxSqft;
        if (criteria.class) searchParams.class = criteria.class;
        if (criteria.propertyType) searchParams.propertyType = criteria.propertyType;
      }
      
      const result = await client.imageSearch(searchParams);
      
      // Map listings to standard format with score
      const mappedListings = (result.listings || []).map((listing: any) => ({
        ...client.mapToStandardProperty(listing),
        score: listing.score,
        // Calculate match tier based on score (per imageSearchItem, max score = 1.0 each)
        matchTier: calculateMatchTier(listing.score, imageSearchItems.length),
      }));
      
      res.json({
        listings: mappedListings,
        count: result.count,
        numPages: result.numPages,
        currentPage: result.currentPage,
        resultsPerPage: result.resultsPerPage,
      });
    } catch (error: any) {
      console.error("Repliers Image Search error:", error.message);
      // Propagate 403 status when Repliers rejects due to subscription
      if (error.message?.includes('403') || error.message?.includes('not authorized')) {
        res.status(403).json({ 
          error: "Visual Match requires an upgraded Repliers subscription",
          upgradeRequired: true 
        });
        return;
      }
      res.status(500).json({ error: "Failed to perform image search" });
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
      res.json({ suggestions });
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
      res.json({ suggestions });
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
      res.json({ suggestions });
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
  
  app.get("/api/autocomplete/neighborhoods", async (req, res) => {
    try {
      const query = (req.query.q as string || '').trim();
      const city = req.query.city as string | undefined;
      
      if (query.length < 2) {
        res.json({ suggestions: [] });
        return;
      }
      
      const repliersClient = getRepliersClient();
      if (!repliersClient) {
        res.json({ suggestions: [] });
        return;
      }
      
      const locations = await repliersClient.autocompleteLocations(query);
      const neighborhoods = locations
        .filter(loc => loc.neighborhood)
        .filter(loc => !city || loc.city?.toLowerCase() === city.toLowerCase())
        .map(loc => ({
          name: loc.neighborhood!,
          city: loc.city || null,
          area: loc.area || null,
        }));
      
      const uniqueNeighborhoods = Array.from(
        new Map(neighborhoods.map(n => [`${n.name}-${n.city}`, n])).values()
      ).slice(0, 20);
      
      res.json({ suggestions: uniqueNeighborhoods.map(n => n.name) });
    } catch (error: any) {
      console.error("Neighborhood autocomplete error:", error.message);
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

  // Dashboard stats endpoint - uses unified inventory service for consistency with Properties page
  app.get("/api/stats/dashboard", async (req, res) => {
    try {
      // Use unified inventory service (same source as Properties page)
      const inventory = await getUnifiedInventory();
      const healthStatus = { mlsGridConfigured: mlsGridClient !== null, repliersConfigured: isRepliersConfigured() };
      
      // Get CMA and seller update counts in parallel
      const [allCmas, activeSellerUpdates] = await Promise.all([
        storage.getAllCmas(),
        storage.getActiveSellerUpdates(),
      ]);
      
      // Log for debugging data consistency
      console.log(`[Dashboard Stats] Using unified inventory: Total=${inventory.totalCount}, Active=${inventory.countsByStatus.Active}, AUC=${inventory.countsByStatus['Active Under Contract']}, Closed=${inventory.countsByStatus.Closed}`);
      console.log(`[Dashboard Stats] Subtypes:`, inventory.countsBySubtype);
      
      const responseData = {
        mlsScope: inventory.mlsScope,
        totalActiveProperties: inventory.countsByStatus.Active,
        totalUnderContractProperties: inventory.countsByStatus['Active Under Contract'],
        totalClosedProperties: inventory.countsByStatus.Closed,
        totalProperties: inventory.totalCount,
        countsBySubtype: inventory.countsBySubtype,
        rentalFilteredCount: inventory.rentalFilteredCount,
        activeCmas: allCmas.length,
        sellerUpdates: activeSellerUpdates.length,
        systemStatus: healthStatus.repliersConfigured || healthStatus.mlsGridConfigured ? 'Ready' : 'Setup',
        repliersConfigured: healthStatus.repliersConfigured,
        mlsGridConfigured: healthStatus.mlsGridConfigured,
        dataSource: inventory.dataSource,
        lastUpdatedAt: inventory.lastUpdatedAt,
        errors: inventory.errors,
        isPartialData: inventory.isPartialData,
      };
      
      res.json(responseData);
    } catch (error: any) {
      console.error("Dashboard stats error:", error.message);
      res.status(500).json({ error: "Failed to load dashboard stats" });
    }
  });
  
  // Canonical inventory summary endpoint - single source of truth for all inventory counts
  // Both Dashboard and Properties pages should use this endpoint for consistency
  app.get("/api/inventory/summary", async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const inventory = await getUnifiedInventory(forceRefresh);
      
      // Return data in format expected by both Dashboard and Properties pages
      res.json({
        dataSource: inventory.dataSource,
        totalCount: inventory.totalCount,
        countsByStatus: inventory.countsByStatus,
        countsBySubtype: inventory.countsBySubtype,
        lastUpdatedAt: inventory.lastUpdatedAt,
        validation: inventory.validation,
        errors: inventory.errors,
        isPartialData: inventory.isPartialData,
        sourceBreakdown: inventory.sourceBreakdown,
      });
    } catch (error: any) {
      console.error("Inventory summary error:", error.message);
      res.status(500).json({ error: "Failed to load inventory summary" });
    }
  });
  
  // Inventory debug endpoint - detailed consistency checking (dev only)
  app.get("/api/inventory/debug", async (req, res) => {
    try {
      const debugData = await getInventoryDebugData();
      res.json(debugData);
    } catch (error: any) {
      console.error("Inventory debug error:", error.message);
      res.status(500).json({ error: "Failed to load inventory debug data" });
    }
  });
  
  // Comprehensive inventory audit endpoint
  app.get("/api/inventory/audit", async (req, res) => {
    try {
      const auditData = await getInventoryAudit();
      res.json(auditData);
    } catch (error: any) {
      console.error("Inventory audit error:", error.message);
      res.status(500).json({ error: "Failed to load inventory audit data" });
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
      
      // Build search params with optional personalization filters (RESO-compliant)
      const searchParams: any = {
        standardStatus: 'Active',
        resultsPerPage: fetchLimit,
        sortBy: 'createdOnDesc',
      };
      
      if (city) searchParams.city = city;
      if (minPrice) searchParams.minPrice = minPrice;
      if (maxPrice) searchParams.maxPrice = maxPrice;
      // NOTE: propertyType filtering done client-side since Repliers 'type' param is for sale/lease only
      // if (propertyType) searchParams.propertyType = propertyType;
      
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
          standardStatus: 'Active',
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
  
  // Property inventory by subtype endpoint - uses unified inventory service for consistency
  app.get("/api/dashboard/inventory-by-subtype", async (req, res) => {
    try {
      // Use unified inventory service (same source as Dashboard stats and Properties page)
      const inventory = await getUnifiedInventory();
      
      // Sort subtypes by count descending
      const sortedSubtypes = Object.entries(inventory.countsBySubtype)
        .sort((a, b) => b[1] - a[1])
        .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {} as Record<string, number>);
      
      // Calculate sum of subtypes to ensure consistency (totalCount should already equal this)
      const subtypeSum = Object.values(inventory.countsBySubtype).reduce((sum, count) => sum + count, 0);
      
      res.json({
        subtypes: sortedSubtypes,
        total: subtypeSum  // Use subtypeSum for consistency with subtypes breakdown
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
  
  // Recent Sold/Closed properties endpoint with pagination and personalization
  app.get("/api/dashboard/recent-sold", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = (page - 1) * limit;
      
      // Personalization parameters (optional - from recent activity like CMAs, saved searches)
      const city = req.query.city as string | undefined;
      const subdivision = req.query.subdivision as string | undefined;
      const minPrice = req.query.minPrice ? parseInt(req.query.minPrice as string) : undefined;
      const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice as string) : undefined;
      
      const isPersonalized = !!(city || subdivision || minPrice || maxPrice);
      
      // Get sold properties from Repliers API using RESO-compliant standardStatus='Closed'
      // Photos available for 3 months of historical listings by default
      let allSoldProps: any[] = [];
      
      if (repliersClient) {
        try {
          const repliersResult = await repliersClient.searchListings({
            standardStatus: 'Closed',
            class: 'residential',
            resultsPerPage: 200,
            pageNum: 1
          });
          
          if (repliersResult?.listings) {
            allSoldProps = repliersResult.listings.map((listing: any) => 
              repliersClient!.mapToStandardProperty(listing)
            );
            console.log(`[Recent Sold] Fetched ${allSoldProps.length} sold properties from Repliers`);
          }
        } catch (repliersError: any) {
          console.error('[Recent Sold] Repliers API error, falling back to database:', repliersError.message);
          // Fallback to database if Repliers fails
          allSoldProps = await storage.searchProperties({ status: 'Closed', limit: 1000 });
        }
      } else {
        // Fallback to database if Repliers not configured
        allSoldProps = await storage.searchProperties({ status: 'Closed', limit: 1000 });
      }
      
      allSoldProps = filterOutRentalProperties(allSoldProps);
      
      // Apply personalization filters if provided
      if (city) {
        allSoldProps = allSoldProps.filter(p => p.city?.toLowerCase() === city.toLowerCase());
      }
      if (subdivision) {
        allSoldProps = allSoldProps.filter(p => p.subdivision?.toLowerCase().includes(subdivision.toLowerCase()));
      }
      if (minPrice) {
        allSoldProps = allSoldProps.filter(p => {
          const price = Number(p.closePrice || p.listPrice || 0);
          return price >= minPrice;
        });
      }
      if (maxPrice) {
        allSoldProps = allSoldProps.filter(p => {
          const price = Number(p.closePrice || p.listPrice || 0);
          return price <= maxPrice;
        });
      }
      
      // Sort by close date descending (most recent first)
      const sortedAll = allSoldProps.sort((a, b) => {
        const dateA = a.closeDate ? new Date(a.closeDate).getTime() : 0;
        const dateB = b.closeDate ? new Date(b.closeDate).getTime() : 0;
        return dateB - dateA;
      });
      
      const totalCount = sortedAll.length;
      const totalPages = Math.ceil(totalCount / limit);
      
      // Get paginated slice
      const paginatedSlice = sortedAll.slice(offset, offset + limit);
      
      // Map properties - Repliers returns photos directly in the response
      const paginatedProps = paginatedSlice.map(p => {
        const propId = p.id || p.listingId;
        // Repliers returns photos directly as an array (3 months historical available)
        const photoUrls = p.photos || [];
        
        return {
          id: propId,
          listingId: p.listingId || p.id,
          unparsedAddress: p.unparsedAddress || p.address,
          city: p.city,
          stateOrProvince: p.stateOrProvince,
          closePrice: p.closePrice || p.soldPrice || p.listPrice,
          closeDate: p.closeDate || p.soldDate,
          bedroomsTotal: p.bedroomsTotal || p.bedrooms,
          bathroomsTotalInteger: p.bathroomsTotalInteger || p.bathrooms,
          livingArea: p.livingArea || p.sqft,
          yearBuilt: p.yearBuilt,
          photos: photoUrls,
          standardStatus: 'Closed',
          propertySubType: p.propertySubType
        };
      });
      
      // Log for debugging
      console.log(`[Recent Sold] Page ${page}: ${paginatedProps.length} properties, ${paginatedProps.filter(p => p.photos.length > 0).length} with photos, personalized: ${isPersonalized}${city ? `, city: ${city}` : ''}`);
      
      res.json({
        properties: paginatedProps,
        count: paginatedProps.length,
        total: totalCount,
        page: page,
        limit: limit,
        totalPages: totalPages,
        hasMore: page < totalPages,
        personalized: isPersonalized,
        filters: isPersonalized ? { city, subdivision, minPrice, maxPrice } : null
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

  // Neighborhood Review API - market stats within neighborhood boundaries
  app.get("/api/neighborhoods/review", async (req, res) => {
    try {
      const { name, city, months = '6', useRepliers = 'true' } = req.query as Record<string, string | undefined>;
      
      if (!name) {
        res.status(400).json({ error: "Neighborhood name is required" });
        return;
      }
      
      const monthsNum = parseInt(months || '6', 10);
      const shouldUseRepliers = useRepliers !== 'false';
      
      console.log(`[Neighborhood Review] Looking up: "${name}" in ${city || 'any city'}`);
      
      // First, get the boundary information
      const boundaryInfo = await neighborhoodService.getNeighborhoodBoundary(name, city);
      
      if (!boundaryInfo.boundary && shouldUseRepliers) {
        console.log(`[Neighborhood Review] No boundary found for "${name}"`);
        // Return empty result if no boundary
        res.json({
          neighborhoodName: name,
          boundary: null,
          centerLat: null,
          centerLng: null,
          stats: {
            activeCount: 0,
            underContractCount: 0,
            soldCount: 0,
            avgListPrice: null,
            avgSoldPrice: null,
            avgPricePerSqFt: null,
            avgDaysOnMarket: null,
            medianListPrice: null,
            medianSoldPrice: null,
          },
          listings: { active: [], underContract: [], sold: [] },
          message: "No boundary data found for this neighborhood",
        });
        return;
      }
      
      let stats;
      if (boundaryInfo.boundary && shouldUseRepliers) {
        // Use Repliers API for active/UC listings (most current data)
        stats = await neighborhoodService.getNeighborhoodMarketStatsFromRepliers(
          name,
          boundaryInfo.boundary,
          city,
          monthsNum
        );
      } else {
        // Fall back to local database
        stats = await neighborhoodService.getNeighborhoodMarketStats(name, city, monthsNum);
      }
      
      console.log(`[Neighborhood Review] Stats for "${name}": ${stats.stats.activeCount} active, ${stats.stats.underContractCount} UC, ${stats.stats.soldCount} sold`);
      
      res.json(stats);
    } catch (error: any) {
      console.error("Neighborhood review error:", error.message);
      res.status(500).json({ error: "Failed to fetch neighborhood review data" });
    }
  });
  
  // Get neighborhood for a specific coordinate (reverse geocode to neighborhood)
  app.get("/api/neighborhoods/by-coordinates", async (req, res) => {
    try {
      const { lat, lng, city } = req.query as Record<string, string | undefined>;
      
      if (!lat || !lng) {
        res.status(400).json({ error: "Latitude and longitude are required" });
        return;
      }
      
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      
      if (isNaN(latitude) || isNaN(longitude)) {
        res.status(400).json({ error: "Invalid coordinates" });
        return;
      }
      
      const neighborhood = await neighborhoodService.findNeighborhoodByCoordinates(latitude, longitude, city);
      
      if (!neighborhood) {
        res.json({ found: false, neighborhood: null });
        return;
      }
      
      res.json({
        found: true,
        neighborhood: neighborhood.neighborhood,
        city: neighborhood.city,
        area: neighborhood.area,
        boundary: neighborhood.map?.boundary || null,
        centerLat: neighborhood.map?.latitude || null,
        centerLng: neighborhood.map?.longitude || null,
      });
    } catch (error: any) {
      console.error("Neighborhood lookup error:", error.message);
      res.status(500).json({ error: "Failed to lookup neighborhood" });
    }
  });

  // ============================================================
  // ReZen (Mission Control) API Routes - Agent Production/Volume
  // ============================================================
  
  // Simple in-memory cache for ReZen data
  const rezenCache = new Map<string, { data: any; timestamp: number }>();
  const REZEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // ReZen API client helper
  async function rezenApiRequest(endpoint: string, options: RequestInit = {}) {
    const apiKey = process.env.REZEN_API_KEY;
    if (!apiKey) {
      throw new Error('REZEN_API_KEY not configured');
    }
    
    const baseUrl = 'https://arrakis.therealbrokerage.com/api/v1';
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`ReZen API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // Map transaction status to unified categories
  function mapRezenStatus(status: string): 'active' | 'under_contract' | 'closed' | 'other' {
    const normalized = (status || '').toLowerCase().replace(/[_\s]/g, '');
    if (['activelisting', 'active', 'new', 'listed'].some(s => normalized.includes(s))) return 'active';
    if (['undercontract', 'pending', 'contract', 'approved'].some(s => normalized.includes(s))) return 'under_contract';
    if (['closed', 'settled', 'paid', 'complete'].some(s => normalized.includes(s))) return 'closed';
    return 'other';
  }
  
  // Map transaction side (buyer/seller)
  function mapRezenSide(transaction: any): 'buyer' | 'seller' | 'unknown' {
    // Check common fields for side indication
    const side = (transaction.side || transaction.representationType || transaction.transactionType || '').toLowerCase();
    if (side.includes('buyer') || side.includes('buy') || side.includes('purchase')) return 'buyer';
    if (side.includes('seller') || side.includes('sell') || side.includes('list')) return 'seller';
    return 'unknown';
  }
  
  // Get volume from transaction based on status
  function getRezenVolume(transaction: any, status: string): number {
    // For closed: use closePrice or soldPrice
    // For under contract: use contractPrice or listPrice
    // For active: use listPrice
    const mappedStatus = mapRezenStatus(status);
    
    if (mappedStatus === 'closed') {
      return Number(transaction.closePrice || transaction.soldPrice || transaction.salePrice || transaction.dealPrice || 0);
    }
    if (mappedStatus === 'under_contract') {
      return Number(transaction.contractPrice || transaction.dealPrice || transaction.listPrice || 0);
    }
    return Number(transaction.listPrice || transaction.price || 0);
  }
  
  // Get agent production/transactions using Repliers API
  // Searches for listings where the agent is the listing agent
  app.get("/api/rezen/production", async (req, res) => {
    try {
      const { agentId, agentName, startDate, endDate } = req.query as Record<string, string>;
      
      // agentId is now optional - can search by agent name instead
      const searchName = agentName || agentId || '';
      
      if (!searchName) {
        res.status(400).json({ error: "agentId or agentName is required" });
        return;
      }
      
      const cacheKey = `production_${searchName}_${startDate || 'default'}_${endDate || 'default'}`;
      const cached = rezenCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < REZEN_CACHE_TTL) {
        console.log(`[Production] Cache hit for ${cacheKey}`);
        res.json(cached.data);
        return;
      }
      
      console.log(`[Production] Fetching production for agent: ${searchName} using Repliers API`);
      
      if (!repliersClient) {
        res.status(503).json({ error: "Repliers API client not initialized" });
        return;
      }
      
      // Fetch listings from Repliers API by status
      const baseParams = {
        type: 'Sale',
        city: 'Austin',
        resultsPerPage: 100,
      };
      
      // Parallel fetch for all statuses
      const [activeResult, ucResult, closedResult] = await Promise.all([
        repliersClient.searchListings({ ...baseParams, standardStatus: 'Active' }).catch(err => {
          console.warn(`[Production] Active listings fetch failed: ${err.message}`);
          return { listings: [], count: 0 };
        }),
        repliersClient.searchListings({ ...baseParams, standardStatus: 'Active Under Contract' }).catch(err => {
          console.warn(`[Production] Under Contract listings fetch failed: ${err.message}`);
          return { listings: [], count: 0 };
        }),
        repliersClient.searchListings({ ...baseParams, standardStatus: 'Closed' }).catch(err => {
          console.warn(`[Production] Closed listings fetch failed: ${err.message}`);
          return { listings: [], count: 0 };
        }),
      ]);
      
      // Filter listings by agent name (case-insensitive partial match)
      const filterByAgent = (listings: any[]) => {
        if (!searchName) return listings;
        const searchLower = searchName.toLowerCase();
        return listings.filter((listing: any) => {
          const agentNameField = listing.agent?.name || listing.listAgentFullName || '';
          return agentNameField.toLowerCase().includes(searchLower);
        });
      };
      
      const activeListings = filterByAgent(activeResult.listings || []);
      const ucListings = filterByAgent(ucResult.listings || []);
      const closedListings = filterByAgent(closedResult.listings || []);
      
      // Calculate volumes
      const sumVolume = (listings: any[], useField: string) => {
        return listings.reduce((sum, l) => sum + (Number(l[useField]) || Number(l.listPrice) || 0), 0);
      };
      
      // Process and aggregate listings
      const production = {
        buyer: {
          active: { count: 0, volume: 0 },
          underContract: { count: 0, volume: 0 },
          closed: { count: 0, volume: 0 },
        },
        seller: {
          active: { count: activeListings.length, volume: sumVolume(activeListings, 'listPrice') },
          underContract: { count: ucListings.length, volume: sumVolume(ucListings, 'listPrice') },
          closed: { count: closedListings.length, volume: sumVolume(closedListings, 'soldPrice') },
        },
        totals: {
          active: { count: activeListings.length, volume: sumVolume(activeListings, 'listPrice') },
          underContract: { count: ucListings.length, volume: sumVolume(ucListings, 'listPrice') },
          closed: { count: closedListings.length, volume: sumVolume(closedListings, 'soldPrice') },
        },
        transactions: [] as any[],
        dataSource: 'Repliers API',
        fetchedAt: new Date().toISOString(),
        meta: {
          source: 'repliers',
          dataQuality: 'complete',
          agentSearched: searchName,
          activeCount: activeListings.length,
          ucCount: ucListings.length,
          closedCount: closedListings.length,
        },
      };
      
      // Build transaction list from listings
      const allListings = [
        ...activeListings.map((l: any) => ({ ...l, _status: 'active' })),
        ...ucListings.map((l: any) => ({ ...l, _status: 'under_contract' })),
        ...closedListings.map((l: any) => ({ ...l, _status: 'closed' })),
      ];
      
      for (const listing of allListings) {
        const address = listing.address || {};
        const fullAddress = `${address.streetNumber || ''} ${address.streetName || ''} ${address.streetSuffix || ''}, ${address.city || ''}, ${address.state || ''} ${address.zip || ''}`.trim();
        const volume = listing._status === 'closed' 
          ? (Number(listing.soldPrice) || Number(listing.closePrice) || Number(listing.listPrice) || 0)
          : (Number(listing.listPrice) || 0);
        
        // Store transaction summary
        production.transactions.push({
          id: listing.mlsNumber || listing.id,
          address: fullAddress,
          status: listing._status,
          side: 'seller', // Listing agent is always seller side
          volume: volume,
          closingDate: listing.soldDate || listing.closeDate || null,
          listDate: listing.listDate,
        });
      }
      
      // Cache the result
      rezenCache.set(cacheKey, { data: production, timestamp: Date.now() });
      
      console.log(`[Production] Agent ${searchName}: ${production.totals.closed.count} closed, ${production.totals.underContract.count} under contract, ${production.totals.active.count} active`);
      
      res.json(production);
    } catch (error: any) {
      console.error('[Production] Fetch error:', error.message);
      res.status(500).json({ 
        error: 'Failed to fetch production data', 
        details: error.message,
        dataSource: 'Repliers'
      });
    }
  });
  
  // Agent production status check - now uses Repliers API
  app.get("/api/rezen/status", async (req, res) => {
    try {
      // Repliers API is always available (configured via FUB_API_KEY or REPLIERS_API_KEY)
      const configured = true;
      res.json({ 
        configured, 
        status: 'ready',
        message: 'Agent production reporting is available via Repliers API',
        dataSource: 'Repliers'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================================================
  // ReZen Reports YTD Endpoint - Agent Production by Status
  // ============================================================
  // GET /api/rezen/reports/agent-production?start=YYYY-MM-DD&end=YYYY-MM-DD&agentId=<optional>
  // Returns YTD production counts and volume by status (Active/Pending/Closed) per agent
  app.get("/api/rezen/reports/agent-production", async (req, res) => {
    try {
      const { start, end, agentId } = req.query as Record<string, string>;
      
      // Default to YTD if no dates provided
      const currentYear = new Date().getFullYear();
      const ytdStart = start || `${currentYear}-01-01`;
      const ytdEnd = end || new Date().toISOString().split('T')[0];
      
      console.log(`[ReZen Reports] Fetching YTD agent production - agent: ${agentId || 'all'}, range: ${ytdStart} to ${ytdEnd}`);
      
      const cacheKey = `rezen_reports_${agentId || 'all'}_${ytdStart}_${ytdEnd}`;
      const cached = rezenCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < REZEN_CACHE_TTL) {
        console.log(`[ReZen Reports] Cache hit for ${cacheKey}`);
        res.json(cached.data);
        return;
      }
      
      // If no agentId provided, we need to fetch all agents first
      // For now, if agentId is provided, fetch their production directly
      if (agentId) {
        // Single agent report
        const transactions = await rezenApiRequest(`/transactions/participant/${agentId}/current`);
        const txList = Array.isArray(transactions) ? transactions : transactions?.transactions || [];
        
        const agentProduction = {
          agentId,
          agentName: txList[0]?.agentName || txList[0]?.participant?.name || agentId,
          ytdStart,
          ytdEnd,
          activeCount: 0,
          activeVolume: 0,
          pendingCount: 0,
          pendingVolume: 0,
          closedCount: 0,
          closedVolume: 0,
          unmappedStatuses: [] as string[],
        };
        
        for (const tx of txList) {
          const txDate = new Date(tx.closingDate || tx.createdAt || tx.contractDate);
          if (txDate < new Date(ytdStart) || txDate > new Date(ytdEnd)) continue;
          
          const status = mapRezenStatus(tx.lifecycleState || tx.status || tx.transactionStatus || '');
          const volume = getRezenVolume(tx, tx.lifecycleState || tx.status || '');
          
          if (status === 'active') {
            agentProduction.activeCount++;
            agentProduction.activeVolume += volume;
          } else if (status === 'under_contract') {
            agentProduction.pendingCount++;
            agentProduction.pendingVolume += volume;
          } else if (status === 'closed') {
            agentProduction.closedCount++;
            agentProduction.closedVolume += volume;
          } else {
            const rawStatus = tx.lifecycleState || tx.status || tx.transactionStatus || 'unknown';
            if (!agentProduction.unmappedStatuses.includes(rawStatus)) {
              agentProduction.unmappedStatuses.push(rawStatus);
              console.log(`[ReZen Reports] Unmapped status: ${rawStatus}`);
            }
          }
        }
        
        const result = {
          agents: [agentProduction],
          ytdStart,
          ytdEnd,
          dataSource: 'ReZen API',
          fetchedAt: new Date().toISOString(),
          warning: agentProduction.unmappedStatuses.length > 0 
            ? `Some statuses could not be categorized: ${agentProduction.unmappedStatuses.join(', ')}` 
            : null,
        };
        
        rezenCache.set(cacheKey, { data: result, timestamp: Date.now() });
        res.json(result);
        return;
      }
      
      // All agents report - fetch transactions and group by agent
      // Note: ReZen might not have a "list all agents" endpoint, so we return empty for now
      // This would need agent IDs from another source (e.g., FUB users or manual config)
      res.json({
        agents: [],
        ytdStart,
        ytdEnd,
        dataSource: 'ReZen API',
        fetchedAt: new Date().toISOString(),
        note: 'Provide agentId parameter to fetch specific agent production. All-agents view requires agent IDs from external source.',
      });
      
    } catch (error: any) {
      console.error('[ReZen Reports] Fetch error:', error.message);
      res.status(500).json({ 
        error: 'Failed to fetch agent production report', 
        details: error.message,
        note: process.env.REZEN_API_KEY ? 'API key configured' : 'API key not configured'
      });
    }
  });
  
  // ============================================================
  // ReZen Mock Data Endpoint - For Testing Mission Control UI
  // ============================================================
  // GET /api/rezen/mock/production?agentId=agent_ryan_001&startDate=2025-11-18&endDate=2025-12-18
  // Returns sample ReZen data for testing the Reports/Mission Control UI
  app.get("/api/rezen/mock/production", async (req, res) => {
    try {
      const { agentId, startDate, endDate } = req.query as Record<string, string>;
      
      console.log(`[ReZen Mock] Serving mock production data - agentId: ${agentId || 'any'}, startDate: ${startDate}, endDate: ${endDate}`);
      
      // Sample mock data with exact structure for testing bucketing + volume math
      const mockData = {
        agentId: agentId || "agent_ryan_001",
        agentName: "Ryan Rodenbeck",
        startDate: startDate || "2025-11-18",
        endDate: endDate || "2025-12-18",
        currency: "USD",
        records: [
          {
            id: "rz_1001",
            side: "buyer",
            status: "under_contract",
            address: "1201 E 7th St, Austin, TX 78702",
            contractDate: "2025-12-01",
            closeDate: null,
            contractPrice: 685000,
            closePrice: null,
            listPrice: null
          },
          {
            id: "rz_1002",
            side: "buyer",
            status: "closed",
            address: "4402 Speedway, Austin, TX 78751",
            contractDate: "2025-10-20",
            closeDate: "2025-11-15",
            contractPrice: 515000,
            closePrice: 510000,
            listPrice: null
          },
          {
            id: "rz_2001",
            side: "seller",
            status: "active_listing",
            address: "3107 Cherrywood Rd, Austin, TX 78722",
            listDate: "2025-12-05",
            contractDate: null,
            closeDate: null,
            listPrice: 799000,
            contractPrice: null,
            closePrice: null
          },
          {
            id: "rz_2002",
            side: "seller",
            status: "under_contract",
            address: "901 S 1st St #210, Austin, TX 78704",
            listDate: "2025-11-10",
            contractDate: "2025-11-28",
            closeDate: null,
            listPrice: 465000,
            contractPrice: 455000,
            closePrice: null
          },
          {
            id: "rz_2003",
            side: "seller",
            status: "closed",
            address: "6500 Burnet Rd, Austin, TX 78757",
            listDate: "2025-09-01",
            contractDate: "2025-10-01",
            closeDate: "2025-11-02",
            listPrice: 925000,
            contractPrice: 910000,
            closePrice: 905000
          }
        ],
        notes: {
          volumeRules: {
            active_listing: "sum(listPrice)",
            under_contract: "sum(contractPrice)",
            closed: "sum(closePrice)"
          }
        }
      };
      
      // Transform mock data into the production response format for Mission Control
      const production = {
        buyer: {
          active: { count: 0, volume: 0 },
          underContract: { count: 0, volume: 0 },
          closed: { count: 0, volume: 0 },
        },
        seller: {
          active: { count: 0, volume: 0 },
          underContract: { count: 0, volume: 0 },
          closed: { count: 0, volume: 0 },
        },
        totals: {
          active: { count: 0, volume: 0 },
          underContract: { count: 0, volume: 0 },
          closed: { count: 0, volume: 0 },
        },
        transactions: [] as any[],
        dataSource: 'ReZen Mock API',
        fetchedAt: new Date().toISOString(),
        rawMockData: mockData,
      };
      
      // Process mock records
      for (const record of mockData.records) {
        const side = record.side as 'buyer' | 'seller';
        let status: 'active' | 'under_contract' | 'closed';
        let volume: number;
        
        // Map status and calculate volume according to rules
        if (record.status === 'active_listing') {
          status = 'active';
          volume = record.listPrice || 0;
        } else if (record.status === 'under_contract') {
          status = 'under_contract';
          volume = record.contractPrice || 0;
        } else if (record.status === 'closed') {
          status = 'closed';
          volume = record.closePrice || 0;
        } else {
          continue;
        }
        
        // Update side-specific counts
        if (side === 'buyer') {
          if (status === 'active') {
            production.buyer.active.count++;
            production.buyer.active.volume += volume;
          } else if (status === 'under_contract') {
            production.buyer.underContract.count++;
            production.buyer.underContract.volume += volume;
          } else if (status === 'closed') {
            production.buyer.closed.count++;
            production.buyer.closed.volume += volume;
          }
        } else {
          if (status === 'active') {
            production.seller.active.count++;
            production.seller.active.volume += volume;
          } else if (status === 'under_contract') {
            production.seller.underContract.count++;
            production.seller.underContract.volume += volume;
          } else if (status === 'closed') {
            production.seller.closed.count++;
            production.seller.closed.volume += volume;
          }
        }
        
        // Store transaction summary
        production.transactions.push({
          id: record.id,
          address: record.address,
          status: status,
          side: side,
          volume: volume,
          closingDate: record.closeDate || record.contractDate,
        });
      }
      
      // Calculate totals
      production.totals.active.count = production.buyer.active.count + production.seller.active.count;
      production.totals.active.volume = production.buyer.active.volume + production.seller.active.volume;
      production.totals.underContract.count = production.buyer.underContract.count + production.seller.underContract.count;
      production.totals.underContract.volume = production.buyer.underContract.volume + production.seller.underContract.volume;
      production.totals.closed.count = production.buyer.closed.count + production.seller.closed.count;
      production.totals.closed.volume = production.buyer.closed.volume + production.seller.closed.volume;
      
      console.log(`[ReZen Mock] Production: ${production.totals.closed.count} closed ($${production.totals.closed.volume}), ${production.totals.underContract.count} under contract ($${production.totals.underContract.volume}), ${production.totals.active.count} active ($${production.totals.active.volume})`);
      
      res.json(production);
    } catch (error: any) {
      console.error('[ReZen Mock] Error:', error.message);
      res.status(500).json({ error: 'Failed to generate mock data', details: error.message });
    }
  });
  
  // ============================================================
  // Follow Up Boss (FUB) API Routes - Calendar & Leads
  // ============================================================
  
  // Simple in-memory cache for FUB data
  const fubCache = new Map<string, { data: any; timestamp: number }>();
  const FUB_CACHE_TTL = 3 * 60 * 1000; // 3 minutes
  
  // FUB API client helper with improved error handling
  // CRITICAL: Always call FUB from server-side (not browser) to avoid CORS/auth issues
  // DOCTYPE error = HTML returned instead of JSON. Common reasons:
  // - Wrong URL (relative path instead of absolute)
  // - Missing Basic Auth header
  // - Calling FUB from client-side (blocked by CORS)
  // - Proxy returning index.html for unknown routes
  async function fubApiRequest(endpoint: string, options: RequestInit = {}): Promise<{ data: any; status: number }> {
    const apiKey = process.env.FUB_API_KEY;
    if (!apiKey) {
      throw new Error('FUB_API_KEY not configured');
    }
    
    const baseUrl = 'https://api.followupboss.com/v1';
    // FUB uses Basic auth with API key as username and empty password
    const authToken = Buffer.from(`${apiKey}:`).toString('base64');
    
    const fullUrl = `${baseUrl}${endpoint}`;
    const isDev = process.env.NODE_ENV !== 'production';
    
    // DEV-only logging
    if (isDev) {
      console.log(`[FUB API] Calling: ${fullUrl.split('?')[0]}`);
    }
    
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    // DEV-only: Log response info for debugging
    const contentType = response.headers.get('content-type') || '';
    if (isDev) {
      console.log(`[FUB API] Response: status=${response.status}, content-type=${contentType}`);
    }
    
    // CRITICAL: Check content-type BEFORE parsing JSON to prevent crashes
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      const preview = text.slice(0, 200);
      console.error(`[FUB API] Non-JSON response from ${endpoint}:`);
      console.error(`  Status: ${response.status}`);
      console.error(`  Content-Type: ${contentType}`);
      console.error(`  Body preview: ${preview}`);
      throw new Error(`FUB API returned non-JSON response (status ${response.status}, content-type: ${contentType}). This may indicate incorrect URL, missing auth, or calling from browser.`);
    }
    
    // Handle HTTP errors
    if (!response.ok) {
      const status = response.status;
      let errorMessage: string;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
      } catch {
        errorMessage = response.statusText;
      }
      
      if (status === 401 || status === 403) {
        throw new Error(`FUB authentication failed (status ${status}): ${errorMessage}. Check Basic Auth + API key permissions.`);
      }
      if (status === 429) {
        throw new Error('Rate limited by FUB. Please retry later.');
      }
      throw new Error(`FUB API error: ${status} ${errorMessage}`);
    }
    
    const data = await response.json();
    
    // DEV-only: Log success info
    if (isDev) {
      const itemCount = data?.appointments?.length || data?.tasks?.length || data?.users?.length || data?.people?.length || 'N/A';
      console.log(`[FUB API] Success: ${itemCount} items returned`);
    }
    
    return { data, status: response.status };
  }
  
  // Get calendar events from FUB for a specific agent
  // Uses /appointments first, falls back to /tasks if appointments returns empty
  // Note: FUB appointments only returns items created in FUB that the API key user owns
  // or has calendar sharing enabled - Google calendar events may not appear
  app.get("/api/fub/calendar", async (req, res) => {
    try {
      const { agentId, start, end, userId } = req.query as Record<string, string>;
      
      // Use agentId or userId - treat empty string as "all"
      const fubUserId = (agentId && agentId !== '') ? agentId : (userId && userId !== '') ? userId : null;
      
      console.log(`[FUB Calendar] Fetching - userId: ${fubUserId || 'all'}, start: ${start}, end: ${end}`);
      
      const cacheKey = `fub_calendar_${fubUserId || 'all'}_${start || 'default'}_${end || 'default'}`;
      const cached = fubCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < FUB_CACHE_TTL) {
        console.log(`[FUB Calendar] Cache hit for ${cacheKey}`);
        res.json(cached.data);
        return;
      }
      
      let appointments: any[] = [];
      let tasks: any[] = [];
      let appointmentsError: string | null = null;
      let tasksError: string | null = null;
      let dataSource = 'appointments';
      
      // Try /appointments endpoint first (FUB's calendar events)
      // Per FUB docs: userId, start (ISO datetime), end (ISO datetime)
      // Use local timezone context by not forcing UTC
      try {
        const apptParams = new URLSearchParams();
        if (fubUserId) apptParams.append('userId', fubUserId);
        // Use date strings directly - FUB accepts YYYY-MM-DD format
        if (start) apptParams.append('start', start);
        if (end) apptParams.append('end', end);
        apptParams.append('limit', '100');
        
        const { data: apptResponse } = await fubApiRequest(`/appointments?${apptParams.toString()}`);
        appointments = apptResponse?.appointments || [];
        console.log(`[FUB Calendar] Appointments returned: ${appointments.length}`);
      } catch (e: any) {
        appointmentsError = e.message;
        console.log(`[FUB Calendar] Appointments endpoint failed: ${e.message}`);
      }
      
      // Always fetch tasks as fallback/supplement
      // FUB tasks use: assignedUserId, dueStart, dueEnd (per user-provided docs)
      try {
        const taskParams = new URLSearchParams();
        if (fubUserId) taskParams.append('assignedUserId', fubUserId);
        if (start) taskParams.append('dueStart', start);
        if (end) taskParams.append('dueEnd', end);
        taskParams.append('limit', '100');
        
        const { data: tasksResponse } = await fubApiRequest(`/tasks?${taskParams.toString()}`);
        tasks = tasksResponse?.tasks || [];
        console.log(`[FUB Calendar] Tasks returned: ${tasks.length}`);
      } catch (e: any) {
        tasksError = e.message;
        console.log(`[FUB Calendar] Tasks endpoint failed: ${e.message}`);
      }
      
      // If both endpoints failed, surface the error
      if (appointmentsError && tasksError) {
        console.error(`[FUB Calendar] Both endpoints failed`);
        res.status(502).json({
          error: 'Both FUB calendar endpoints failed',
          appointmentsError,
          tasksError,
          help: 'Check FUB API key permissions. Appointments may require calendar sharing to be enabled.',
        });
        return;
      }
      
      // Determine data source for debug info
      if (appointments.length > 0 && tasks.length > 0) {
        dataSource = 'appointments + tasks';
      } else if (appointments.length > 0) {
        dataSource = 'appointments';
      } else if (tasks.length > 0) {
        dataSource = 'tasks (fallback)';
      } else {
        dataSource = 'none (empty results)';
      }
      
      // Combine and format calendar items
      const calendarItems = [
        ...appointments.map((a: any) => ({
          id: String(a.id),
          type: 'event' as const,
          title: a.title || a.name || 'Appointment',
          description: a.description || a.notes || null,
          start: a.start || a.startDate || a.created,
          end: a.end || a.endDate || null,
          allDay: a.allDay || false,
          assignedTo: a.userId || a.assignedTo || null,
          contact: a.person?.name || a.personName || null,
          contactId: a.personId || a.person?.id || null,
        })),
        ...tasks.map((t: any) => ({
          id: String(t.id),
          type: 'task' as const,
          title: t.name || t.title || 'Task',
          description: t.note || t.description || null,
          start: t.dueDate || t.due || t.created,
          end: null,
          allDay: true,
          assignedTo: t.assignedUserId || t.userId || null,
          contact: t.person?.name || t.personName || null,
          contactId: t.personId || t.person?.id || null,
          completed: t.isCompleted || t.completed || false,
        })),
      ].sort((a, b) => new Date(a.start || 0).getTime() - new Date(b.start || 0).getTime());
      
      const result = {
        items: calendarItems,
        count: calendarItems.length,
        dataSource,
        agentId: fubUserId || 'all',
        dateRange: { start, end },
        fetchedAt: new Date().toISOString(),
        debug: {
          appointmentsCount: appointments.length,
          tasksCount: tasks.length,
          appointmentsError,
          tasksError,
          note: 'FUB appointments only shows events created in FUB that the API key user owns or has sharing enabled. Google Calendar events may not appear.',
        },
      };
      
      fubCache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      console.log(`[FUB Calendar] Returning ${calendarItems.length} items (${dataSource}) for agent ${fubUserId || 'all'}`);
      
      res.json(result);
    } catch (error: any) {
      console.error('[FUB Calendar] Fetch error:', error.message);
      res.status(500).json({ 
        error: 'Failed to fetch calendar data', 
        details: error.message,
        note: process.env.FUB_API_KEY ? 'API key configured' : 'API key not configured',
        help: 'If you see authentication errors, verify the FUB_API_KEY has correct permissions and uses Basic Auth format.',
      });
    }
  });
  
  // Get leads from FUB for a specific agent with pagination support
  app.get("/api/fub/leads", async (req, res) => {
    try {
      const { agentId, userId, limit = '50', offset = '0' } = req.query as Record<string, string>;
      
      const fubUserId = agentId || userId;
      const limitNum = Math.min(parseInt(limit) || 50, 100);
      const offsetNum = parseInt(offset) || 0;
      
      console.log(`[FUB Leads] Fetching leads - agentId: ${fubUserId}, limit: ${limitNum}, offset: ${offsetNum}`);
      
      const cacheKey = `fub_leads_${fubUserId || 'all'}_${limitNum}_${offsetNum}`;
      const cached = fubCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < FUB_CACHE_TTL) {
        console.log(`[FUB Leads] Cache hit for ${cacheKey}`);
        res.json(cached.data);
        return;
      }
      
      // Build query params - FUB API supports offset and limit
      const params = new URLSearchParams();
      if (fubUserId) params.append('assignedTo', fubUserId);
      params.append('limit', String(limitNum));
      params.append('offset', String(offsetNum));
      // FUB API sorts by 'created' or '-created' (date), we'll sort by name client-side
      params.append('sort', '-created');  // Fetch most recent first, then sort client-side
      
      const { data: response } = await fubApiRequest(`/people?${params.toString()}`);
      const people = response?.people || [];
      // FUB returns metadata in different ways, check multiple locations
      const totalCount = response?._metadata?.total || response?.total || response?._pagination?.total || people.length;
      
      // Format leads
      const leads = people.map((p: any) => ({
        id: p.id,
        name: `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.name || 'Unknown',
        email: p.emails?.[0]?.value || p.email,
        phone: p.phones?.[0]?.value || p.phone,
        source: p.source?.name || p.sourceId || null,
        stage: p.stage?.name || p.stageId || null,
        assignedTo: p.assignedTo || null,
        assignedUserId: p.assignedUserId ? String(p.assignedUserId) : null,
        createdAt: p.created || p.createdAt,
        lastActivity: p.lastActivity || p.updated,
        tags: p.tags || [],
      }));
      
      const result = {
        leads,
        count: leads.length,
        totalCount,
        hasMore: offsetNum + leads.length < totalCount,
        offset: offsetNum,
        limit: limitNum,
        dataSource: 'Follow Up Boss',
        agentId: fubUserId || 'all',
        fetchedAt: new Date().toISOString(),
      };
      
      fubCache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      console.log(`[FUB Leads] Fetched ${leads.length} leads (offset: ${offsetNum}, total: ${totalCount}) for agent ${fubUserId || 'all'}`);
      
      res.json(result);
    } catch (error: any) {
      console.error('[FUB Leads] Fetch error:', error.message);
      res.status(500).json({ 
        error: 'Failed to fetch leads data', 
        details: error.message,
        note: process.env.FUB_API_KEY ? 'API key configured' : 'API key not configured'
      });
    }
  });
  
  // FUB API status check
  app.get("/api/fub/status", async (req, res) => {
    try {
      const configured = !!process.env.FUB_API_KEY;
      res.json({ 
        configured, 
        status: configured ? 'ready' : 'not_configured',
        message: configured ? 'FUB API key is configured' : 'FUB_API_KEY environment variable not set'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get FUB users (agents) list - fetches ALL users with pagination
  // Note: FUB may return paginated results, so we fetch all pages
  app.get("/api/fub/users", async (req, res) => {
    try {
      const cacheKey = 'fub_users_all';
      const cached = fubCache.get(cacheKey);
      // Cache for 30 minutes since user list changes infrequently
      if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
        console.log('[FUB Users] Cache hit');
        res.json(cached.data);
        return;
      }
      
      console.log('[FUB API] Calling: /users');
      
      // Fetch all users with pagination (FUB typically limits to 100 per page)
      const allUsers: any[] = [];
      let offset = 0;
      const limit = 100;
      const maxPages = 10; // Safety cap: 1000 users max
      
      for (let page = 0; page < maxPages; page++) {
        const params = new URLSearchParams();
        params.append('limit', String(limit));
        params.append('offset', String(offset));
        
        const { data: response } = await fubApiRequest(`/users?${params.toString()}`);
        const users = response?.users || [];
        
        allUsers.push(...users);
        console.log(`[FUB Users] Page ${page + 1}: fetched ${users.length} users (total: ${allUsers.length})`);
        
        // If we got fewer than limit, we've reached the end
        if (users.length < limit) {
          break;
        }
        
        offset += limit;
      }
      
      // Format and sort users alphabetically by name (case-insensitive)
      const formattedUsers = allUsers.map((u: any) => ({
        id: String(u.id),
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || u.email || 'Unknown',
        email: u.email,
        role: u.role,
        active: u.isActive !== false,
      })).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      
      const result = {
        users: formattedUsers,
        count: formattedUsers.length,
        dataSource: 'Follow Up Boss',
        fetchedAt: new Date().toISOString(),
      };
      
      fubCache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      console.log(`[FUB Users] Total: ${formattedUsers.length} users fetched and sorted`);
      
      res.json(result);
    } catch (error: any) {
      console.error('[FUB Users] Fetch error:', error.message);
      res.status(500).json({ 
        error: error.message,
        help: 'Check FUB_API_KEY permissions. The API key must have access to read users.'
      });
    }
  });

  // ============================================================
  // FUB Spyglass Agents Cache - People with stage=Spyglass Agent
  // ============================================================
  // Cache key for Spyglass Agent people list (10 min TTL)
  const SPYGLASS_AGENTS_CACHE_KEY = 'fub_spyglass_agents';
  const SPYGLASS_AGENTS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  
  interface SpyglassAgentData {
    id: number;
    name: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    customBirthday: string | null;
    homeAnniversary: string | null;
    stage: string;
  }
  
  interface SpyglassAgentsCache {
    byName: Record<string, SpyglassAgentData>;
    byEmail: Record<string, SpyglassAgentData>;
    all: SpyglassAgentData[];
  }
  
  // Helper to fetch and cache Spyglass Agent people list
  async function getSpyglassAgents(): Promise<SpyglassAgentsCache> {
    const cached = fubCache.get(SPYGLASS_AGENTS_CACHE_KEY);
    if (cached && Date.now() - cached.timestamp < SPYGLASS_AGENTS_CACHE_TTL) {
      console.log('[FUB Spyglass Agents] Cache hit');
      return cached.data as SpyglassAgentsCache;
    }
    
    console.log('[FUB Spyglass Agents] Fetching from People API with stage=Spyglass Agent');
    
    const cache: SpyglassAgentsCache = { byName: {}, byEmail: {}, all: [] };
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    
    while (hasMore) {
      const params = new URLSearchParams();
      params.append('stage', 'Spyglass Agent');
      params.append('limit', String(limit));
      params.append('offset', String(offset));
      
      const { data } = await fubApiRequest(`/people?${params.toString()}`);
      const people = data?.people || [];
      
      for (const person of people) {
        // Log first few people to check for birthday data
        if (cache.all.length < 3) {
          console.log(`[FUB Spyglass Agents] Person: ${person.firstName} ${person.lastName} (ID: ${person.id})`);
        }
        
        // Check multiple possible birthday field locations
        const birthdayValue = person.customBirthday || person.birthday || 
          (person.customFields?.find?.((f: any) => /birthday/i.test(f.name || f.key))?.value) || null;
        
        const anniversaryValue = person.customHomeAnniversary || person.customAnniversary || person.homeAnniversary ||
          (person.customFields?.find?.((f: any) => /anniversary/i.test(f.name || f.key))?.value) || null;
        
        const agentData: SpyglassAgentData = {
          id: person.id,
          name: person.name || `${person.firstName || ''} ${person.lastName || ''}`.trim(),
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.emails?.[0]?.value,
          customBirthday: birthdayValue,
          homeAnniversary: anniversaryValue,
          stage: person.stage,
        };
        
        cache.all.push(agentData);
        
        // Index by normalized name for matching
        const fullName = agentData.name.toLowerCase().replace(/\s+/g, ' ').trim();
        if (fullName) {
          cache.byName[fullName] = agentData;
        }
        
        // Also index by email for matching
        if (agentData.email) {
          cache.byEmail[agentData.email.toLowerCase()] = agentData;
        }
      }
      
      hasMore = people.length === limit;
      offset += limit;
    }
    
    console.log(`[FUB Spyglass Agents] Cached ${cache.all.length} agents (${Object.keys(cache.byName).length} by name, ${Object.keys(cache.byEmail).length} by email)`);
    fubCache.set(SPYGLASS_AGENTS_CACHE_KEY, { data: cache, timestamp: Date.now() });
    
    return cache;
  }
  
  // Helper to find agent in Spyglass cache by name or email
  function findSpyglassAgent(cache: SpyglassAgentsCache, name: string, email?: string | null): SpyglassAgentData | null {
    // Try email match first (most reliable)
    if (email) {
      const byEmail = cache.byEmail[email.toLowerCase()];
      if (byEmail) return byEmail;
    }
    
    // Try exact name match
    const normalizedName = name.toLowerCase().replace(/\s+/g, ' ').trim();
    const byName = cache.byName[normalizedName];
    if (byName) return byName;
    
    // Try fuzzy name match (first + last name components)
    const nameParts = normalizedName.split(' ').filter(Boolean);
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      
      for (const agent of cache.all) {
        const agentFirst = (agent.firstName || '').toLowerCase();
        const agentLast = (agent.lastName || '').toLowerCase();
        if (agentFirst === firstName && agentLast === lastName) {
          return agent;
        }
      }
    }
    
    return null;
  }

  // ============================================================
  // FUB Agent Profile Endpoint - Birthday, Home Anniversary
  // ============================================================
  // GET /api/fub/agent/:agentId/profile
  // Returns agent profile with birthday and home anniversary
  // Birthday sourced from People API (stage=Spyglass Agent) customBirthday field
  app.get("/api/fub/agent/:agentId/profile", async (req, res) => {
    try {
      const { agentId } = req.params;
      
      if (!agentId) {
        res.status(400).json({ error: "agentId is required" });
        return;
      }
      
      console.log(`[FUB Agent Profile] Fetching profile for agent ${agentId}`);
      
      const cacheKey = `fub_agent_profile_${agentId}`;
      const cached = fubCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < FUB_CACHE_TTL) {
        console.log(`[FUB Agent Profile] Cache hit for ${cacheKey}`);
        res.json(cached.data);
        return;
      }
      
      // Fetch user details from FUB Users API
      const { data: userResponse } = await fubApiRequest(`/users/${agentId}`);
      const user = userResponse;
      
      const agentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Unknown';
      
      // Fetch birthday from Spyglass Agent people list
      let birthday: string | null = null;
      let homeAnniversary: string | null = null;
      let birthdaySource = 'not_found';
      
      try {
        const spyglassCache = await getSpyglassAgents();
        
        // Find agent by name or email
        const agentData = findSpyglassAgent(spyglassCache, agentName, user.email);
        
        if (agentData) {
          birthday = agentData.customBirthday || null;
          homeAnniversary = agentData.homeAnniversary || null;
          birthdaySource = birthday ? 'spyglass_agent_people' : 'not_in_record';
          console.log(`[FUB Agent Profile] Agent ${agentName}: birthday=${birthday}, source=${birthdaySource}`);
        } else {
          console.log(`[FUB Agent Profile] Agent ${agentName} (ID: ${agentId}) not found in Spyglass Agent stage`);
          birthdaySource = 'agent_not_in_spyglass_stage';
        }
      } catch (spyglassError: any) {
        console.error(`[FUB Agent Profile] Failed to fetch Spyglass agents: ${spyglassError.message}`);
        birthdaySource = 'spyglass_fetch_error';
      }
      
      // Fallback: check user custom fields if birthday not found
      if (!birthday) {
        const customFields = user.customFields || user.customProperties || [];
        const findCustomField = (names: string[]): string | null => {
          for (const name of names) {
            const field = customFields.find((f: any) => 
              f.name?.toLowerCase() === name.toLowerCase() || 
              f.key?.toLowerCase() === name.toLowerCase()
            );
            if (field?.value) return field.value;
          }
          return null;
        };
        birthday = findCustomField(['birthday', 'birthdate', 'customBirthday']);
        if (birthday) birthdaySource = 'user_custom_fields';
        
        if (!homeAnniversary) {
          homeAnniversary = findCustomField(['homeAnniversary', 'home_anniversary', 'anniversaryDate']);
        }
      }
      
      const profile = {
        agentId: String(user.id),
        agentName,
        email: user.email,
        phone: user.phones?.[0]?.value || user.phone || null,
        birthday,
        homeAnniversary,
        role: user.role,
        createdAt: user.created,
        dataSource: 'Follow Up Boss',
        birthdaySource,
        fetchedAt: new Date().toISOString(),
      };
      
      fubCache.set(cacheKey, { data: profile, timestamp: Date.now() });
      
      console.log(`[FUB Agent Profile] Profile fetched for ${profile.agentName}, birthday: ${birthday || 'Not on file'}`);
      res.json(profile);
      
    } catch (error: any) {
      console.error('[FUB Agent Profile] Fetch error:', error.message);
      res.status(500).json({ 
        error: 'Failed to fetch agent profile', 
        details: error.message,
        note: process.env.FUB_API_KEY ? 'API key configured' : 'API key not configured'
      });
    }
  });

  // ============================================================
  // FUB Agent Activity Endpoint - Recent Activity/Timeline
  // ============================================================
  // GET /api/fub/agent/:agentId/activity?since=YYYY-MM-DD&limit=20
  // Returns recent activity (calls, emails, texts, notes) for an agent
  app.get("/api/fub/agent/:agentId/activity", async (req, res) => {
    try {
      const { agentId } = req.params;
      const { since, limit = '20' } = req.query as Record<string, string>;
      
      if (!agentId) {
        res.status(400).json({ error: "agentId is required" });
        return;
      }
      
      const limitNum = Math.min(parseInt(limit) || 20, 50);
      const sinceDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      console.log(`[FUB Agent Activity] Fetching activity for agent ${agentId}, since: ${sinceDate}, limit: ${limitNum}`);
      
      const cacheKey = `fub_agent_activity_${agentId}_${sinceDate}_${limitNum}`;
      const cached = fubCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < FUB_CACHE_TTL) {
        console.log(`[FUB Agent Activity] Cache hit for ${cacheKey}`);
        res.json(cached.data);
        return;
      }
      
      // FUB has different endpoints for different activity types
      // We'll try /events or /notes as those are common activity endpoints
      const activities: any[] = [];
      let eventsFetched = false;
      let notesFetched = false;
      
      // Try to fetch events (calls, emails, texts)
      try {
        const eventsParams = new URLSearchParams();
        eventsParams.append('userId', agentId);
        eventsParams.append('since', sinceDate);
        eventsParams.append('limit', String(limitNum));
        
        const { data: eventsResponse } = await fubApiRequest(`/events?${eventsParams.toString()}`);
        const events = eventsResponse?.events || [];
        
        events.forEach((e: any) => {
          activities.push({
            id: String(e.id),
            type: e.type || e.category || 'event',
            occurredAt: e.created || e.occurredAt || e.timestamp,
            summary: e.description || e.subject || e.name || 'Activity',
            leadId: e.personId || e.leadId,
            leadName: e.person?.name || e.personName || null,
          });
        });
        eventsFetched = true;
        console.log(`[FUB Agent Activity] Fetched ${events.length} events`);
      } catch (e: any) {
        console.log(`[FUB Agent Activity] Events endpoint not available: ${e.message}`);
      }
      
      // Try to fetch notes
      try {
        const notesParams = new URLSearchParams();
        notesParams.append('userId', agentId);
        notesParams.append('limit', String(limitNum));
        
        const { data: notesResponse } = await fubApiRequest(`/notes?${notesParams.toString()}`);
        const notes = notesResponse?.notes || [];
        
        notes.forEach((n: any) => {
          const noteDate = new Date(n.created || n.createdAt);
          if (noteDate >= new Date(sinceDate)) {
            activities.push({
              id: String(n.id),
              type: 'note',
              occurredAt: n.created || n.createdAt,
              summary: n.body?.substring(0, 200) || n.text?.substring(0, 200) || 'Note added',
              leadId: n.personId || n.leadId,
              leadName: n.person?.name || n.personName || null,
            });
          }
        });
        notesFetched = true;
        console.log(`[FUB Agent Activity] Fetched ${notes.length} notes`);
      } catch (e: any) {
        console.log(`[FUB Agent Activity] Notes endpoint not available: ${e.message}`);
      }
      
      // Sort by date descending and limit
      activities.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      const limitedActivities = activities.slice(0, limitNum);
      
      const result = {
        agentId,
        recentActivity: limitedActivities,
        count: limitedActivities.length,
        sinceDate,
        dataSource: 'Follow Up Boss',
        fetchedAt: new Date().toISOString(),
        debug: {
          eventsFetched,
          notesFetched,
          totalActivitiesFound: activities.length,
        },
      };
      
      fubCache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      console.log(`[FUB Agent Activity] Returning ${limitedActivities.length} activities for agent ${agentId}`);
      res.json(result);
      
    } catch (error: any) {
      console.error('[FUB Agent Activity] Fetch error:', error.message);
      res.status(500).json({ 
        error: 'Failed to fetch agent activity', 
        details: error.message,
        note: process.env.FUB_API_KEY ? 'API key configured' : 'API key not configured'
      });
    }
  });

  // AI Chat Assistant endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { getChatResponse, isOpenAIConfigured } = await import("./openai-client");
      
      if (!isOpenAIConfigured()) {
        res.status(503).json({ 
          error: "AI assistant is not configured. Please add your OpenAI API key.",
          configured: false
        });
        return;
      }

      const { messages, propertyContext } = req.body;
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: "Messages array is required" });
        return;
      }

      const response = await getChatResponse(messages, propertyContext);
      res.json(response);
    } catch (error: any) {
      console.error("[AI Chat] Error:", error.message);
      res.status(500).json({ error: "Failed to get AI response. Please try again." });
    }
  });

  // AI Chat status endpoint
  app.get("/api/chat/status", async (req, res) => {
    try {
      const { isOpenAIConfigured } = await import("./openai-client");
      res.json({ configured: isOpenAIConfigured() });
    } catch (error) {
      res.json({ configured: false });
    }
  });

  // CMA Draft endpoint - creates a draft CMA from AI-collected criteria
  app.post("/api/cma/draft", async (req, res) => {
    try {
      const { area, sqftMin, sqftMax, yearBuiltMin, yearBuiltMax, stories } = req.body;

      // Validate required field
      if (!area || typeof area !== "string" || area.trim().length === 0) {
        res.status(400).json({ error: "Area is required (neighborhood, zip code, or subdivision)" });
        return;
      }

      // Validate numeric ranges
      if (sqftMin !== undefined && sqftMax !== undefined && sqftMin > sqftMax) {
        res.status(400).json({ error: "Minimum square footage cannot be greater than maximum" });
        return;
      }
      if (yearBuiltMin !== undefined && yearBuiltMax !== undefined && yearBuiltMin > yearBuiltMax) {
        res.status(400).json({ error: "Minimum year built cannot be greater than maximum" });
        return;
      }

      // Validate stories
      if (stories !== undefined && stories !== "any" && ![1, 2, 3].includes(stories)) {
        res.status(400).json({ error: "Stories must be 1, 2, 3, or 'any'" });
        return;
      }

      // Build search criteria object
      const searchCriteria = {
        area: area.trim(),
        sqftMin: sqftMin || null,
        sqftMax: sqftMax || null,
        yearBuiltMin: yearBuiltMin || null,
        yearBuiltMax: yearBuiltMax || null,
        stories: stories || null,
        createdVia: "ai_assistant",
      };

      // Get user ID if authenticated
      const user = req.user as any;
      const userId = user?.id || null;

      // Create draft CMA record
      const draftName = `CMA Draft - ${area.trim()}`;
      const cmaData = {
        name: draftName,
        userId,
        comparablePropertyIds: [],
        searchCriteria,
        notes: "Draft created via AI Assistant. Add subject property and comparables to complete.",
      };

      const cma = await storage.createCma(cmaData);
      
      res.status(201).json({
        draftId: cma.id,
        url: `/cma/${cma.id}`,
        message: `CMA draft created for ${area.trim()}`,
      });
    } catch (error: any) {
      console.error("[CMA Draft] Error:", error.message);
      res.status(500).json({ error: "Failed to create CMA draft" });
    }
  });

  // ========================================
  // DEBUG ENDPOINTS - Canonical Data Layer
  // ========================================
  
  // Debug: Get sample listings from Repliers with raw fields
  app.get("/api/debug/listings/sample", async (req, res) => {
    try {
      const { CanonicalListingService } = await import("./data/listings");
      const count = parseInt(req.query.count as string) || 25;
      const includeRaw = req.query.raw !== 'false';
      
      const result = await CanonicalListingService.getSampleListings(count, includeRaw);
      
      res.json({
        success: true,
        ...result,
        usage: {
          description: "Sample listings from Repliers API with optional raw fields",
          params: {
            count: "Number of samples (default: 25)",
            raw: "Include raw fields (default: true)",
          },
        },
      });
    } catch (error: any) {
      console.error("[Debug] Sample listings error:", error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  });
  
  // Debug: Get dedupe report showing potential duplicates
  app.get("/api/debug/listings/dedupe-report", async (req, res) => {
    try {
      const { CanonicalListingService } = await import("./data/listings");
      const sampleSize = parseInt(req.query.size as string) || 100;
      
      const report = await CanonicalListingService.getDedupeReport(sampleSize);
      
      res.json({
        success: true,
        report,
        usage: {
          description: "Dedupe diagnostics showing duplicate detection across sources",
          params: {
            size: "Sample size to analyze (default: 100)",
          },
        },
      });
    } catch (error: any) {
      console.error("[Debug] Dedupe report error:", error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message,
      });
    }
  });
  
  // Debug: Fetch canonical listings with filters
  app.get("/api/debug/listings/canonical", async (req, res) => {
    try {
      const { CanonicalListingService } = await import("./data/listings");
      
      const params = {
        standardStatus: req.query.status as string,
        city: req.query.city as string,
        subdivision: req.query.subdivision as string,
        limit: parseInt(req.query.limit as string) || 50,
        includeRaw: req.query.raw === 'true',
        sources: req.query.sources ? (req.query.sources as string).split(',') as any : undefined,
      };
      
      const result = await CanonicalListingService.fetchListings(params);
      
      res.json({
        success: true,
        listings: result.listings,
        total: result.total,
        dedupeStats: result.dedupeStats,
        errors: result.errors,
        usage: {
          description: "Fetch canonical listings with deduplication",
          params: {
            status: "Filter by standardStatus (Active, Closed, etc.)",
            city: "Filter by city",
            subdivision: "Filter by subdivision",
            limit: "Max results (default: 50)",
            raw: "Include raw fields (default: false)",
            sources: "Comma-separated sources (REPLIERS,DATABASE)",
          },
        },
      });
    } catch (error: any) {
      console.error("[Debug] Canonical listings error:", error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message,
      });
    }
  });

  // ========================================
  // Map Layer Data (Flood Zones, School Districts)
  // ========================================
  
  app.get("/api/map-layers/flood-zones", async (req, res) => {
    try {
      const { bounds } = req.query;
      
      // FEMA National Flood Hazard Layer - Layer 28 = Flood Hazard Zones
      // Note: Use /arcgis/ path, not /gis/nfhl/
      const floodUrl = new URL("https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query");
      floodUrl.searchParams.set("where", "1=1");
      floodUrl.searchParams.set("outFields", "FLD_ZONE,ZONE_SUBTY,SFHA_TF");
      floodUrl.searchParams.set("f", "geojson");
      floodUrl.searchParams.set("returnGeometry", "true");
      
      // Set geometry bounds for Austin area
      let geometryBounds;
      if (bounds) {
        const [west, south, east, north] = (bounds as string).split(",").map(Number);
        geometryBounds = { xmin: west, ymin: south, xmax: east, ymax: north };
      } else {
        // Default to central Austin area (smaller bounds for performance)
        geometryBounds = { xmin: -97.8, ymin: 30.2, xmax: -97.65, ymax: 30.35 };
      }
      
      floodUrl.searchParams.set("geometry", `${geometryBounds.xmin},${geometryBounds.ymin},${geometryBounds.xmax},${geometryBounds.ymax}`);
      floodUrl.searchParams.set("geometryType", "esriGeometryEnvelope");
      floodUrl.searchParams.set("spatialRel", "esriSpatialRelIntersects");
      floodUrl.searchParams.set("inSR", "4326");
      floodUrl.searchParams.set("outSR", "4326");
      floodUrl.searchParams.set("resultRecordCount", "500");
      
      const response = await fetch(floodUrl.toString());
      
      if (!response.ok) {
        throw new Error(`FEMA API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      res.json({
        success: true,
        type: "FeatureCollection",
        features: data.features || [],
        source: "FEMA NFHL",
      });
    } catch (error: any) {
      console.error("[Map Layers] Flood zones error:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to fetch flood zone data",
        message: error.message,
      });
    }
  });
  
  app.get("/api/map-layers/school-districts", async (req, res) => {
    try {
      // City of Austin ArcGIS - School District boundaries (Layer 2)
      // Note: Service uses Texas State Plane projection, we request output in WGS84
      const austinUrl = new URL("https://maps.austintexas.gov/arcgis/rest/services/Shared/BoundariesGrids_2/MapServer/2/query");
      austinUrl.searchParams.set("where", "1=1");
      austinUrl.searchParams.set("outFields", "NAME");
      austinUrl.searchParams.set("f", "geojson");
      austinUrl.searchParams.set("returnGeometry", "true");
      austinUrl.searchParams.set("outSR", "4326");
      austinUrl.searchParams.set("resultRecordCount", "100");
      
      const response = await fetch(austinUrl.toString());
      
      if (!response.ok) {
        throw new Error(`Austin GIS API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      res.json({
        success: true,
        type: "FeatureCollection",
        features: data.features || [],
        source: "City of Austin GIS",
      });
    } catch (error: any) {
      console.error("[Map Layers] School districts error:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to fetch school district data",
        message: error.message,
      });
    }
  });
  
  app.get("/api/map-layers/available", async (req, res) => {
    res.json({
      layers: [
        {
          id: "flood-zones",
          name: "Flood Zones",
          description: "FEMA National Flood Hazard Layer",
          endpoint: "/api/map-layers/flood-zones",
          legend: [
            { zone: "A", color: "#0000FF", label: "High Risk (100-yr)" },
            { zone: "AE", color: "#0000AA", label: "High Risk w/ BFE" },
            { zone: "AO", color: "#3333FF", label: "High Risk - Sheet Flow" },
            { zone: "X", color: "#99CCFF", label: "Moderate to Low Risk" },
          ],
        },
        {
          id: "school-districts",
          name: "School Districts",
          description: "Austin area school district boundaries",
          endpoint: "/api/map-layers/school-districts",
        },
      ],
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}
