import { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';

interface PropertyLocation {
  id: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
  status: string;
  isSubject?: boolean;
}

interface MapboxCMAMapProps {
  properties: PropertyLocation[];
  subjectProperty?: PropertyLocation | null;
  style?: 'streets' | 'satellite' | 'dark';
  showPolygon?: boolean;
  onStyleChange?: (style: 'streets' | 'satellite' | 'dark') => void;
  height?: string;
  interactive?: boolean;
}

const MAPBOX_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v11',
  dark: 'mapbox://styles/mapbox/dark-v10'
} as const;

const STATUS_COLORS: Record<string, string> = {
  'Active': '#22c55e',
  'Active Under Contract': '#f97316',
  'Pending': '#eab308',
  'Closed': '#6b7280',
  'Subject': '#ef4444'
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || STATUS_COLORS['Closed'];
}

export function MapboxCMAMap({ 
  properties, 
  subjectProperty,
  style = 'streets',
  showPolygon = true,
  onStyleChange,
  height = '400px',
  interactive = true
}: MapboxCMAMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const getCenterPoint = useCallback((): [number, number] => {
    if (subjectProperty?.lat && subjectProperty?.lng) {
      return [subjectProperty.lng, subjectProperty.lat];
    }
    if (properties.length > 0 && properties[0].lat && properties[0].lng) {
      return [properties[0].lng, properties[0].lat];
    }
    return [-97.7431, 30.2672];
  }, [properties, subjectProperty]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      setMapError('Mapbox token not configured');
      return;
    }

    mapboxgl.accessToken = token;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: MAPBOX_STYLES[style],
        center: getCenterPoint(),
        zoom: 12,
        interactive
      });

      map.current.on('load', () => {
        setMapLoaded(true);
      });

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError('Failed to load map');
      });

      if (interactive) {
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      }
    } catch (err) {
      console.error('Map initialization error:', err);
      setMapError('Failed to initialize map');
    }

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (map.current && mapLoaded) {
      map.current.setStyle(MAPBOX_STYLES[style]);
    }
  }, [style, mapLoaded]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (map.current.getLayer('property-polygon-outline')) {
      map.current.removeLayer('property-polygon-outline');
    }
    if (map.current.getLayer('property-polygon')) {
      map.current.removeLayer('property-polygon');
    }
    if (map.current.getSource('property-polygon')) {
      map.current.removeSource('property-polygon');
    }

    if (subjectProperty?.lat && subjectProperty?.lng) {
      const el = createMarkerElement(true, 'Subject');
      const popup = createPopup(subjectProperty, true);
      const marker = new mapboxgl.Marker(el)
        .setLngLat([subjectProperty.lng, subjectProperty.lat])
        .setPopup(popup)
        .addTo(map.current);
      markersRef.current.push(marker);
    }

    properties.forEach(property => {
      if (!property.lat || !property.lng) return;
      if (subjectProperty && property.id === subjectProperty.id) return;
      
      const el = createMarkerElement(false, property.status);
      const popup = createPopup(property, false);
      const marker = new mapboxgl.Marker(el)
        .setLngLat([property.lng, property.lat])
        .setPopup(popup)
        .addTo(map.current!);
      markersRef.current.push(marker);
    });

    if (showPolygon) {
      const allProps = subjectProperty 
        ? [subjectProperty, ...properties.filter(p => p.id !== subjectProperty.id)]
        : properties;
      const validProps = allProps.filter(p => p.lat && p.lng);
      
      if (validProps.length >= 3) {
        addPolygonLayer(map.current, validProps);
      }
    }

    fitBoundsToMarkers(map.current, properties, subjectProperty);

  }, [properties, subjectProperty, mapLoaded, showPolygon]);

  if (mapError) {
    return (
      <div 
        className="flex items-center justify-center bg-muted rounded-lg"
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <p className="mb-2">{mapError}</p>
          <p className="text-sm">Please configure VITE_MAPBOX_TOKEN</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div 
        ref={mapContainer} 
        className="w-full rounded-lg overflow-hidden"
        style={{ height }}
      />
      
      {onStyleChange && (
        <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg shadow-md p-1 flex gap-1">
          {(Object.keys(MAPBOX_STYLES) as Array<keyof typeof MAPBOX_STYLES>).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={style === s ? 'default' : 'ghost'}
              onClick={() => onStyleChange(s)}
              className="capitalize text-xs h-7"
            >
              {s}
            </Button>
          ))}
        </div>
      )}
      
      <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg shadow-md p-3">
        <div className="text-xs font-medium mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.Subject }} />
            <span>Subject Property</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.Active }} />
            <span>Active</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS['Active Under Contract'] }} />
            <span>Under Contract</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.Closed }} />
            <span>Closed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function createMarkerElement(isSubject: boolean, status: string): HTMLElement {
  const el = document.createElement('div');
  el.style.width = isSubject ? '24px' : '18px';
  el.style.height = isSubject ? '24px' : '18px';
  el.style.borderRadius = '50%';
  el.style.backgroundColor = isSubject ? STATUS_COLORS.Subject : getStatusColor(status);
  el.style.border = '3px solid white';
  el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
  el.style.cursor = 'pointer';
  return el;
}

function createPopup(property: PropertyLocation, isSubject: boolean): mapboxgl.Popup {
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(property.price);

  return new mapboxgl.Popup({ offset: 25 }).setHTML(`
    <div style="padding: 8px; font-family: system-ui, sans-serif;">
      <div style="font-weight: 600; margin-bottom: 4px;">${property.address}</div>
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
        ${isSubject ? 'Subject Property' : property.status}
      </div>
      <div style="font-size: 14px; font-weight: 500; color: #ea580c;">
        ${formattedPrice}
      </div>
    </div>
  `);
}

function addPolygonLayer(map: mapboxgl.Map, properties: PropertyLocation[]) {
  const coordinates = properties.map(p => [p.lng, p.lat]);
  
  if (coordinates.length > 0) {
    coordinates.push(coordinates[0]);
  }

  map.addSource('property-polygon', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      }
    }
  });

  map.addLayer({
    id: 'property-polygon',
    type: 'fill',
    source: 'property-polygon',
    paint: {
      'fill-color': '#f97316',
      'fill-opacity': 0.1
    }
  });

  map.addLayer({
    id: 'property-polygon-outline',
    type: 'line',
    source: 'property-polygon',
    paint: {
      'line-color': '#f97316',
      'line-width': 2,
      'line-dasharray': [2, 2]
    }
  });
}

function fitBoundsToMarkers(
  map: mapboxgl.Map, 
  properties: PropertyLocation[], 
  subject?: PropertyLocation | null
) {
  const allProps = subject 
    ? [subject, ...properties.filter(p => p.id !== subject.id)]
    : properties;
  const validProps = allProps.filter(p => p.lat && p.lng);
  
  if (validProps.length === 0) return;

  const bounds = new mapboxgl.LngLatBounds();
  validProps.forEach(p => bounds.extend([p.lng, p.lat]));
  
  map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
}

export function generateMapboxStaticMapUrl(
  properties: PropertyLocation[],
  subjectProperty: PropertyLocation | undefined | null,
  style: 'streets' | 'satellite' | 'dark' = 'streets',
  width: number = 800,
  height: number = 400
): string | null {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) return null;

  const styleId = {
    streets: 'streets-v11',
    satellite: 'satellite-streets-v11',
    dark: 'dark-v10'
  }[style];

  const validProps = properties.filter(p => p.lat && p.lng);
  if (validProps.length === 0 && !subjectProperty) return null;

  const markers: string[] = [];
  
  if (subjectProperty?.lat && subjectProperty?.lng) {
    markers.push(`pin-l-star+ef4444(${subjectProperty.lng},${subjectProperty.lat})`);
  }

  validProps.forEach(p => {
    if (subjectProperty && p.id === subjectProperty.id) return;
    const color = getStatusColor(p.status).replace('#', '');
    markers.push(`pin-s+${color}(${p.lng},${p.lat})`);
  });

  if (markers.length === 0) return null;

  const allProps = subjectProperty 
    ? [subjectProperty, ...validProps.filter(p => p.id !== subjectProperty.id)]
    : validProps;
  
  const lngs = allProps.map(p => p.lng);
  const lats = allProps.map(p => p.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  
  const bounds = `[${minLng},${minLat},${maxLng},${maxLat}]`;
  
  return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/${markers.join(',')}/${bounds}/${width}x${height}@2x?padding=50&access_token=${token}`;
}
