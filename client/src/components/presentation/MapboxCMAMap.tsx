import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { STATUS_COLORS, getStatusHexFromMLS, MAP_STYLES } from '@/lib/statusColors';
import { useTheme } from '@/contexts/ThemeContext';

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
  style?: 'streets' | 'satellite';
  showPolygon?: boolean;
  onStyleChange?: (style: 'streets' | 'satellite') => void;
  onPolygonChange?: (show: boolean) => void;
  height?: string;
  interactive?: boolean;
}

function getStatusColor(status: string, isSubject?: boolean): string {
  return getStatusHexFromMLS(status, isSubject);
}

export function MapboxCMAMap({ 
  properties, 
  subjectProperty,
  style = 'streets',
  showPolygon = true,
  onStyleChange,
  onPolygonChange,
  height = '400px',
  interactive = true
}: MapboxCMAMapProps) {
  const { theme } = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  
  // Compute effective map style: satellite stays satellite, streets respects theme
  const effectiveMapStyle = useMemo(() => {
    if (style === 'satellite') {
      return 'satellite';
    }
    // Streets mode respects dark/light theme
    return theme === 'dark' ? 'dark' : 'streets';
  }, [style, theme]);

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

    // Check for token - try VITE_ prefixed first, then fall back to non-prefixed
    const token = import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.MAPBOX_ACCESS_TOKEN;
    
    console.log('[MAPBOX] Token check:', {
      hasViteToken: !!import.meta.env.VITE_MAPBOX_TOKEN,
      hasAccessToken: !!import.meta.env.MAPBOX_ACCESS_TOKEN,
      tokenPrefix: token?.substring(0, 10)
    });
    
    if (!token || token === 'undefined' || !token.startsWith('pk.')) {
      setMapError('Mapbox token not configured');
      return;
    }

    mapboxgl.accessToken = token;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: MAP_STYLES[effectiveMapStyle],
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
      map.current.setStyle(MAP_STYLES[effectiveMapStyle]);
    }
  }, [effectiveMapStyle, mapLoaded]);

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
          {(['streets', 'satellite'] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={style === s ? 'default' : 'ghost'}
              onClick={() => onStyleChange(s)}
              className="capitalize text-xs h-7"
              data-testid={`button-map-style-${s}`}
            >
              {s === 'streets' ? 'Streets' : 'Satellite'}
            </Button>
          ))}
        </div>
      )}
      
      {onPolygonChange && (
        <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm rounded-lg shadow-md px-3 py-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showPolygon}
              onChange={(e) => onPolygonChange(e.target.checked)}
              className="rounded border-muted-foreground"
              data-testid="checkbox-show-polygon"
            />
            <span>Show Area</span>
          </label>
        </div>
      )}
      
      <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg shadow-md p-3">
        <div className="text-xs font-medium mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.subject.hex }} />
            <span>Subject Property</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.active.hex }} />
            <span>Active</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.underContract.hex }} />
            <span>Under Contract</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.closed.hex }} />
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
  el.style.backgroundColor = getStatusColor(status, isSubject);
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
      <div style="font-size: 14px; font-weight: 500; color: #EF4923;">
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
      'fill-color': STATUS_COLORS.underContract.hex,
      'fill-opacity': 0.1
    }
  });

  map.addLayer({
    id: 'property-polygon-outline',
    type: 'line',
    source: 'property-polygon',
    paint: {
      'line-color': STATUS_COLORS.underContract.hex,
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
  const token = import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.MAPBOX_ACCESS_TOKEN;
  if (!token || token === 'undefined' || !token.startsWith('pk.')) return null;

  const styleId = {
    streets: 'streets-v11',
    satellite: 'satellite-streets-v11',
    dark: 'dark-v10'
  }[style];

  const validProps = properties.filter(p => p.lat && p.lng);
  if (validProps.length === 0 && !subjectProperty) return null;

  const markers: string[] = [];
  
  if (subjectProperty?.lat && subjectProperty?.lng) {
    const subjectColor = STATUS_COLORS.subject.hex.replace('#', '');
    markers.push(`pin-l-star+${subjectColor}(${subjectProperty.lng},${subjectProperty.lat})`);
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
