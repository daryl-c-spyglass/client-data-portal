import type { Express, Request, Response } from "express";
import { getRepliersClient } from "./repliers-client";

const ALLOWED_ORIGINS = [
  'https://spyglassrealty.com',
  'https://www.spyglassrealty.com',
  'https://spyglassrealty.org',
  'https://www.spyglassrealty.org',
];

function widgetCors(req: Request, res: Response, next: () => void) {
  const origin = req.headers.origin;
  
  if (origin && (ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV === 'development')) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
}

export function registerWidgetRoutes(app: Express): void {
  app.use('/api/widget', widgetCors);

  app.get('/api/widget/search', async (req: Request, res: Response) => {
    try {
      const {
        page = '1',
        limit = '12',
        status = 'Active',
        type = 'sale',
        minPrice,
        maxPrice,
        beds,
        baths,
        propertyType,
      } = req.query;

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 12, 50);

      // Map user-friendly status to Repliers API status codes
      const statusMap: Record<string, string> = {
        'Active': 'A',
        'Active Under Contract': 'U',
        'Pending': 'U',
        '': '', // All statuses
      };

      const searchParams: Record<string, any> = {
        status: statusMap[status as string] || 'A',
        type: type as string,
        resultsPerPage: limitNum,
        pageNum: pageNum,
        sortBy: 'createdOnDesc',
        class: 'residential',
      };

      if (minPrice) {
        searchParams.minPrice = parseInt(minPrice as string);
      }

      if (maxPrice) {
        searchParams.maxPrice = parseInt(maxPrice as string);
      }

      if (beds) {
        const bedsNum = parseInt(beds as string);
        if (beds === '5') {
          searchParams.minBeds = 5;
        } else if (bedsNum >= 1) {
          searchParams.minBeds = bedsNum;
          searchParams.maxBeds = bedsNum;
        }
      }

      if (baths) {
        searchParams.minBaths = parseInt(baths as string);
      }

      if (propertyType) {
        searchParams.propertyType = propertyType as string;
      }

      const client = getRepliersClient();
      if (!client) {
        return res.status(503).json({ error: 'Property search unavailable', properties: [], total: 0 });
      }
      const result = await client.searchListings(searchParams) as any;

      const formatImageUrl = (img: string) => 
        img.startsWith('http') ? img : `https://cdn.repliers.io/${img}`;

      const properties = (result.listings || []).map((listing: any) => ({
        listingId: listing.mlsNumber || listing.listingId,
        listPrice: listing.listPrice,
        streetAddress: listing.address?.streetNumber 
          ? `${listing.address.streetNumber} ${listing.address.streetName || ''} ${listing.address.streetSuffix || ''}`.trim()
          : listing.address?.unparsedAddress || '',
        city: listing.address?.city || '',
        stateOrProvince: listing.address?.state || 'TX',
        postalCode: listing.address?.zip || '',
        standardStatus: listing.standardStatus || 'Active',
        bedroomsTotal: listing.details?.numBedrooms || null,
        bathroomsTotalInteger: listing.details?.numBathrooms || null,
        livingArea: listing.details?.sqft || null,
        yearBuilt: listing.details?.yearBuilt || null,
        lotSizeArea: listing.lot?.acres ? Math.round(listing.lot.acres * 43560) : null,
        latitude: listing.map?.latitude || null,
        longitude: listing.map?.longitude || null,
        primaryPhoto: listing.images?.[0] ? formatImageUrl(listing.images[0]) : null,
        photos: (listing.images || []).slice(0, 20).map((url: string) => ({ mediaUrl: formatImageUrl(url) })),
        publicRemarks: listing.details?.description || null,
      }));

      res.json({
        properties,
        total: result.numResults || properties.length,
        page: pageNum,
        pages: Math.ceil((result.numResults || properties.length) / limitNum),
      });
    } catch (error) {
      console.error('[Widget API] Search error:', error);
      res.status(500).json({ error: 'Failed to search properties', properties: [], total: 0 });
    }
  });

  app.get('/api/widget/property/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const client = getRepliersClient();
      if (!client) {
        return res.status(503).json({ error: 'Property search unavailable' });
      }
      const result = await client.searchListings({
        mlsNumber: id,
        resultsPerPage: 1,
      } as any) as any;

      if (!result.listings || result.listings.length === 0) {
        return res.status(404).json({ error: 'Property not found' });
      }

      const listing = result.listings[0] as any;
      
      const formatImageUrl = (img: string) => 
        img.startsWith('http') ? img : `https://cdn.repliers.io/${img}`;

      const property = {
        listingId: listing.mlsNumber || listing.listingId,
        listPrice: listing.listPrice,
        streetAddress: listing.address?.streetNumber 
          ? `${listing.address.streetNumber} ${listing.address.streetName || ''} ${listing.address.streetSuffix || ''}`.trim()
          : listing.address?.unparsedAddress || '',
        city: listing.address?.city || '',
        stateOrProvince: listing.address?.state || 'TX',
        postalCode: listing.address?.zip || '',
        standardStatus: listing.standardStatus || 'Active',
        bedroomsTotal: listing.details?.numBedrooms || null,
        bathroomsTotalInteger: listing.details?.numBathrooms || null,
        livingArea: listing.details?.sqft || null,
        yearBuilt: listing.details?.yearBuilt || null,
        lotSizeArea: listing.lot?.acres ? Math.round(listing.lot.acres * 43560) : null,
        latitude: listing.map?.latitude || null,
        longitude: listing.map?.longitude || null,
        primaryPhoto: listing.images?.[0] ? formatImageUrl(listing.images[0]) : null,
        photos: (listing.images || []).map((url: string) => ({ mediaUrl: formatImageUrl(url) })),
        publicRemarks: listing.details?.description || null,
      };

      res.json({ property });
    } catch (error) {
      console.error('[Widget API] Property fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch property' });
    }
  });

  console.log('✅ Widget API routes registered at /api/widget/*');
}
