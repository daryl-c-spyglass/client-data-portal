import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { getRepliersClient, isRepliersConfigured } from "./repliers-client";
import { insertWpFavoriteSchema, isLikelyRentalProperty } from "@shared/schema";
import { z } from "zod";

const ALLOWED_ORIGINS = [
  'https://spyglassrealty.org',
  'https://www.spyglassrealty.org',
  'http://spyglassrealty.org',
  'http://www.spyglassrealty.org',
];

const MAX_RESULTS = 500;

function wpCors(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

interface WpPropertyResponse {
  id: string;
  listingId: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  price: number;
  closePrice: number | null;
  status: string;
  beds: number | null;
  baths: number | null;
  livingArea: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: string[];
  subdivision: string | null;
  daysOnMarket: number | null;
  publicRemarks: string | null;
}

function normalizeProperty(property: any): WpPropertyResponse {
  return {
    id: property.id || property.listingId || '',
    listingId: property.listingId || property.mlsNumber || property.id || '',
    address: property.unparsedAddress || `${property.streetNumber || ''} ${property.streetName || ''}`.trim() || '',
    city: property.city || '',
    state: property.stateOrProvince || 'TX',
    postalCode: property.postalCode || '',
    price: Number(property.listPrice) || 0,
    closePrice: property.closePrice ? Number(property.closePrice) : null,
    status: property.standardStatus || property.status || '',
    beds: property.bedroomsTotal ?? property.beds ?? null,
    baths: property.bathroomsTotalInteger ?? property.bathroomsFull ?? property.baths ?? null,
    livingArea: property.livingArea ? Number(property.livingArea) : null,
    lotSize: property.lotSizeSquareFeet ? Number(property.lotSizeSquareFeet) : null,
    yearBuilt: property.yearBuilt ?? null,
    propertyType: property.propertySubType || property.propertyType || null,
    latitude: property.latitude ? Number(property.latitude) : null,
    longitude: property.longitude ? Number(property.longitude) : null,
    photos: property.photos || property.mediaUrls || [],
    subdivision: property.subdivision || null,
    daysOnMarket: property.daysOnMarket ?? null,
    publicRemarks: property.publicRemarks || null,
  };
}

export function registerWordPressRoutes(app: Express) {
  app.use('/api/wordpress', wpCors);

  app.get("/api/wordpress/properties", async (req: Request, res: Response) => {
    try {
      const {
        status,
        minPrice,
        maxPrice,
        beds,
        baths,
        propertyType,
        type,
        limit = '50',
        offset = '0',
      } = req.query as Record<string, string | undefined>;

      const parsedLimit = Math.min(parseInt(limit || '50', 10), MAX_RESULTS);
      const parsedOffset = parseInt(offset || '0', 10);

      if (!isRepliersConfigured()) {
        const properties = await storage.getAllProperties();
        let filtered = properties.filter(p => p.mlgCanView);

        if (status) {
          const statusLower = status.toLowerCase();
          filtered = filtered.filter(p => 
            (p.standardStatus || '').toLowerCase() === statusLower
          );
        }
        if (minPrice) {
          filtered = filtered.filter(p => Number(p.listPrice) >= Number(minPrice));
        }
        if (maxPrice) {
          filtered = filtered.filter(p => Number(p.listPrice) <= Number(maxPrice));
        }
        if (beds) {
          filtered = filtered.filter(p => (p.bedroomsTotal ?? 0) >= Number(beds));
        }
        if (baths) {
          filtered = filtered.filter(p => (p.bathroomsTotalInteger ?? 0) >= Number(baths));
        }

        if (type !== 'lease') {
          filtered = filtered.filter(p => !isLikelyRentalProperty(p));
        }

        const paginated = filtered.slice(parsedOffset, parsedOffset + parsedLimit);

        res.json({
          success: true,
          properties: paginated.map(normalizeProperty),
          total: filtered.length,
          limit: parsedLimit,
          offset: parsedOffset,
        });
        return;
      }

      const repliersClient = getRepliersClient()!;
      const searchParams: Record<string, any> = {
        resultsPerPage: parsedLimit,
        pageNum: Math.floor(parsedOffset / parsedLimit) + 1,
      };

      if (status) {
        const statusMap: Record<string, string> = {
          'active': 'Active',
          'pending': 'Pending',
          'closed': 'Closed',
          'active under contract': 'Active Under Contract',
          'auc': 'Active Under Contract',
        };
        searchParams.standardStatus = statusMap[status.toLowerCase()] || status;
      } else {
        searchParams.standardStatus = 'Active';
      }

      if (type === 'lease') {
        searchParams.type = 'lease';
      } else {
        searchParams.type = 'sale';
      }

      if (minPrice) searchParams.minPrice = Number(minPrice);
      if (maxPrice) searchParams.maxPrice = Number(maxPrice);
      if (beds) searchParams.minBeds = Number(beds);
      if (baths) searchParams.minBaths = Number(baths);
      if (propertyType) searchParams.class = propertyType;

      const response = await repliersClient.searchListings(searchParams);
      const listings = response.listings || [];

      res.json({
        success: true,
        properties: listings.map(normalizeProperty),
        total: response.count || listings.length,
        limit: parsedLimit,
        offset: parsedOffset,
      });
    } catch (error: any) {
      console.error('[WordPress API] Error fetching properties:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch properties',
        message: error.message,
      });
    }
  });

  app.get("/api/wordpress/properties/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Property ID is required',
        });
        return;
      }

      if (isRepliersConfigured()) {
        const repliersClient = getRepliersClient()!;
        try {
          const listing = await repliersClient.getListing(id);
          if (listing) {
            const mediaResult = await storage.getMediaByResourceKey(id);
            const photos = mediaResult.map(m => m.mediaURL).filter(Boolean) as string[];
            
            res.json({
              success: true,
              property: {
                ...normalizeProperty(listing),
                photos: listing.photos || photos,
              },
            });
            return;
          }
        } catch {
        }
      }

      let property = await storage.getPropertyByListingId(id);
      if (!property) {
        property = await storage.getProperty(id);
      }

      if (!property) {
        res.status(404).json({
          success: false,
          error: 'Property not found',
        });
        return;
      }

      const mediaResult = await storage.getMediaByResourceKey(property.listingId);
      const photos = mediaResult.map(m => m.mediaURL).filter(Boolean) as string[];

      res.json({
        success: true,
        property: {
          ...normalizeProperty(property),
          photos,
        },
      });
    } catch (error: any) {
      console.error('[WordPress API] Error fetching property:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch property',
        message: error.message,
      });
    }
  });

  app.get("/api/wordpress/search", async (req: Request, res: Response) => {
    try {
      const {
        q,
        city,
        postalCode,
        subdivision,
        status,
        minPrice,
        maxPrice,
        beds,
        baths,
        minSqft,
        maxSqft,
        propertyType,
        type,
        limit = '50',
        offset = '0',
      } = req.query as Record<string, string | undefined>;

      const parsedLimit = Math.min(parseInt(limit || '50', 10), MAX_RESULTS);
      const parsedOffset = parseInt(offset || '0', 10);

      if (!isRepliersConfigured()) {
        let properties = await storage.getAllProperties();
        properties = properties.filter(p => p.mlgCanView);

        if (q) {
          const searchTerm = q.toLowerCase();
          properties = properties.filter(p => 
            (p.unparsedAddress || '').toLowerCase().includes(searchTerm) ||
            (p.city || '').toLowerCase().includes(searchTerm) ||
            (p.postalCode || '').includes(searchTerm) ||
            (p.subdivision || '').toLowerCase().includes(searchTerm)
          );
        }
        if (city) {
          properties = properties.filter(p => (p.city || '').toLowerCase() === city.toLowerCase());
        }
        if (postalCode) {
          properties = properties.filter(p => p.postalCode === postalCode);
        }
        if (subdivision) {
          properties = properties.filter(p => 
            (p.subdivision || '').toLowerCase().includes(subdivision.toLowerCase())
          );
        }
        if (status) {
          properties = properties.filter(p => 
            (p.standardStatus || '').toLowerCase() === status.toLowerCase()
          );
        }
        if (minPrice) {
          properties = properties.filter(p => Number(p.listPrice) >= Number(minPrice));
        }
        if (maxPrice) {
          properties = properties.filter(p => Number(p.listPrice) <= Number(maxPrice));
        }
        if (beds) {
          properties = properties.filter(p => (p.bedroomsTotal ?? 0) >= Number(beds));
        }
        if (baths) {
          properties = properties.filter(p => (p.bathroomsTotalInteger ?? 0) >= Number(baths));
        }
        if (minSqft) {
          properties = properties.filter(p => Number(p.livingArea) >= Number(minSqft));
        }
        if (maxSqft) {
          properties = properties.filter(p => Number(p.livingArea) <= Number(maxSqft));
        }

        if (type !== 'lease') {
          properties = properties.filter(p => !isLikelyRentalProperty(p));
        }

        const paginated = properties.slice(parsedOffset, parsedOffset + parsedLimit);

        res.json({
          success: true,
          properties: paginated.map(normalizeProperty),
          total: properties.length,
          limit: parsedLimit,
          offset: parsedOffset,
        });
        return;
      }

      const repliersClient = getRepliersClient()!;
      const searchParams: Record<string, any> = {
        resultsPerPage: parsedLimit,
        pageNum: Math.floor(parsedOffset / parsedLimit) + 1,
      };

      if (status) {
        const statusMap: Record<string, string> = {
          'active': 'Active',
          'pending': 'Pending',
          'closed': 'Closed',
          'active under contract': 'Active Under Contract',
          'auc': 'Active Under Contract',
        };
        searchParams.standardStatus = statusMap[status.toLowerCase()] || status;
      } else {
        searchParams.standardStatus = 'Active';
      }

      if (type === 'lease') {
        searchParams.type = 'lease';
      } else {
        searchParams.type = 'sale';
      }

      if (q) searchParams.address = q;
      if (city) searchParams.city = city;
      if (postalCode) searchParams.postalCode = postalCode;
      if (subdivision) searchParams.subdivision = subdivision;
      if (minPrice) searchParams.minPrice = Number(minPrice);
      if (maxPrice) searchParams.maxPrice = Number(maxPrice);
      if (beds) searchParams.minBeds = Number(beds);
      if (baths) searchParams.minBaths = Number(baths);
      if (minSqft) searchParams.minSqft = Number(minSqft);
      if (maxSqft) searchParams.maxSqft = Number(maxSqft);
      if (propertyType) searchParams.class = propertyType;

      const response = await repliersClient.searchListings(searchParams);
      const listings = response.listings || [];

      res.json({
        success: true,
        properties: listings.map(normalizeProperty),
        total: response.count || listings.length,
        limit: parsedLimit,
        offset: parsedOffset,
      });
    } catch (error: any) {
      console.error('[WordPress API] Error searching properties:', error.message);
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: error.message,
      });
    }
  });

  const favoriteSchema = z.object({
    wpUserId: z.string().min(1, 'User ID is required'),
    propertyId: z.string().min(1, 'Property ID is required'),
  });

  app.post("/api/wordpress/favorites", async (req: Request, res: Response) => {
    try {
      const parseResult = favoriteSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: parseResult.error.errors,
        });
        return;
      }

      const { wpUserId, propertyId } = parseResult.data;

      const existing = await storage.getWpFavorite(wpUserId, propertyId);
      if (existing) {
        res.json({
          success: true,
          favorite: existing,
          message: 'Property already favorited',
        });
        return;
      }

      const favorite = await storage.createWpFavorite({ wpUserId, propertyId });

      res.status(201).json({
        success: true,
        favorite,
      });
    } catch (error: any) {
      console.error('[WordPress API] Error creating favorite:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to save favorite',
        message: error.message,
      });
    }
  });

  app.delete("/api/wordpress/favorites", async (req: Request, res: Response) => {
    try {
      const parseResult = favoriteSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: parseResult.error.errors,
        });
        return;
      }

      const { wpUserId, propertyId } = parseResult.data;
      const deleted = await storage.deleteWpFavorite(wpUserId, propertyId);

      res.json({
        success: true,
        deleted,
      });
    } catch (error: any) {
      console.error('[WordPress API] Error deleting favorite:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to delete favorite',
        message: error.message,
      });
    }
  });

  app.get("/api/wordpress/favorites/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
        return;
      }

      const favorites = await storage.getWpFavoritesByUser(userId);

      const propertyIds = favorites.map(f => f.propertyId);
      const properties: WpPropertyResponse[] = [];

      for (const propertyId of propertyIds) {
        if (isRepliersConfigured()) {
          const repliersClient = getRepliersClient()!;
          try {
            const listing = await repliersClient.getListing(propertyId);
            if (listing) {
              properties.push(normalizeProperty(listing));
              continue;
            }
          } catch {
          }
        }

        let property = await storage.getPropertyByListingId(propertyId);
        if (!property) {
          property = await storage.getProperty(propertyId);
        }
        if (property) {
          properties.push(normalizeProperty(property));
        }
      }

      res.json({
        success: true,
        favorites: favorites.map(f => ({
          ...f,
          property: properties.find(p => p.listingId === f.propertyId || p.id === f.propertyId),
        })),
        total: favorites.length,
      });
    } catch (error: any) {
      console.error('[WordPress API] Error fetching favorites:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch favorites',
        message: error.message,
      });
    }
  });

  console.log('✅ WordPress API routes registered at /api/wordpress/*');
}
