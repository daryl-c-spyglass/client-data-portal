import axios from "axios";

interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  confidence: number;
}

interface MapboxFeature {
  center: [number, number];
  place_name: string;
  relevance: number;
  properties: {
    accuracy?: string;
  };
}

interface MapboxResponse {
  features: MapboxFeature[];
}

const MAPBOX_API_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  
  if (!token) {
    console.error("[Mapbox] MAPBOX_ACCESS_TOKEN not configured");
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `${MAPBOX_API_URL}/${encodedAddress}.json?access_token=${token}&country=US&types=address&limit=1`;
    
    const response = await axios.get<MapboxResponse>(url, {
      timeout: 5000,
    });

    if (response.data.features && response.data.features.length > 0) {
      const feature = response.data.features[0];
      return {
        longitude: feature.center[0],
        latitude: feature.center[1],
        formattedAddress: feature.place_name,
        confidence: feature.relevance,
      };
    }

    return null;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("[Mapbox] Geocoding error:", error.response?.status, error.message);
    } else {
      console.error("[Mapbox] Geocoding error:", error);
    }
    return null;
  }
}

export async function batchGeocodeAddresses(
  addresses: { id: string; address: string }[]
): Promise<Map<string, GeocodeResult>> {
  const results = new Map<string, GeocodeResult>();
  
  for (const { id, address } of addresses) {
    const result = await geocodeAddress(address);
    if (result) {
      results.set(id, result);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

export async function geocodeProperties(
  properties: Array<{
    id: string;
    listingId: string;
    unparsedAddress?: string | null;
    streetNumber?: string | null;
    streetName?: string | null;
    city?: string | null;
    stateOrProvince?: string | null;
    postalCode?: string | null;
    latitude?: string | number | null;
    longitude?: string | number | null;
  }>
): Promise<Array<{
  id: string;
  listingId: string;
  latitude: number;
  longitude: number;
}>> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  
  if (!token) {
    console.error("[Mapbox] MAPBOX_ACCESS_TOKEN not configured");
    return [];
  }

  const results: Array<{
    id: string;
    listingId: string;
    latitude: number;
    longitude: number;
  }> = [];

  const propertiesNeedingCoords = properties.filter(
    p => p.latitude == null || p.longitude == null
  );

  console.log(`[Mapbox] Geocoding ${propertiesNeedingCoords.length} properties without coordinates`);

  for (const property of propertiesNeedingCoords) {
    let address = property.unparsedAddress;
    
    if (!address) {
      const parts = [
        property.streetNumber,
        property.streetName,
        property.city,
        property.stateOrProvince,
        property.postalCode,
      ].filter(Boolean);
      address = parts.join(" ");
    }

    if (!address || address.trim().length < 5) {
      continue;
    }

    const result = await geocodeAddress(address);
    
    if (result && result.confidence >= 0.7) {
      results.push({
        id: property.id,
        listingId: property.listingId,
        latitude: result.latitude,
        longitude: result.longitude,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[Mapbox] Successfully geocoded ${results.length} of ${propertiesNeedingCoords.length} properties`);
  
  return results;
}

export function isMapboxConfigured(): boolean {
  return !!process.env.MAPBOX_ACCESS_TOKEN;
}
