import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { STATUS_COLORS, getStatusHexFromMLS, MAP_STYLES, MapStyleKey } from '@/lib/statusColors';
import { MapLegend } from '@/components/maps/MapLegend';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  label?: string;
  price?: number;
  status?: 'Active' | 'Active Under Contract' | 'Pending' | 'Closed' | 'Subject';
  isSubject?: boolean;
  photos?: string[];
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  mlsNumber?: string;
}

interface MapboxMapProps {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  showLegend?: boolean;
  interactive?: boolean;
  onMarkerClick?: (markerId: string) => void;
  className?: string;
  style?: MapStyleKey;
  polygon?: number[][][];
  showPolygon?: boolean;
  polygonColor?: string;
  syncWithTheme?: boolean;
  currentTheme?: 'light' | 'dark';
}

function getStatusColor(status: string, isSubject?: boolean): string {
  return getStatusHexFromMLS(status, isSubject);
}

function formatPrice(price: number): string {
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(2)}M`;
  }
  return `$${Math.round(price / 1000)}K`;
}

function createMarkerElement(marker: MapMarker): HTMLDivElement {
  const el = document.createElement('div');
  const color = getStatusColor(marker.status || '', marker.isSubject);
  
  if (marker.price) {
    el.className = 'mapbox-price-marker';
    el.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px 10px;
      background-color: ${color};
      color: white;
      font-size: 12px;
      font-weight: 700;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      white-space: nowrap;
      cursor: pointer;
      transition: transform 0.15s ease;
    `;
    el.innerHTML = formatPrice(marker.price);
    el.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.1)';
      el.style.zIndex = '10';
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'scale(1)';
      el.style.zIndex = '1';
    });
  } else {
    el.style.cssText = `
      width: ${marker.isSubject ? '24px' : '16px'};
      height: ${marker.isSubject ? '24px' : '16px'};
      background-color: ${color};
      border: 3px solid white;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      transition: transform 0.15s ease;
    `;
  }
  
  return el;
}

function createPopupHTML(marker: MapMarker): string {
  const priceStr = marker.price 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(marker.price)
    : 'Price N/A';
  
  const statusColor = getStatusColor(marker.status || '', marker.isSubject);
  const statusLabel = marker.isSubject ? 'Subject' : (marker.status || 'Unknown');
  
  let photoHTML = '';
  if (marker.photos && marker.photos.length > 0) {
    photoHTML = `<img src="${marker.photos[0]}" alt="Property" style="width:100%;height:120px;object-fit:cover;border-radius:6px 6px 0 0;margin-bottom:8px;" />`;
  }
  
  const detailsHTML = [
    marker.beds != null ? `${marker.beds} bd` : null,
    marker.baths != null ? `${marker.baths} ba` : null,
    marker.sqft ? `${marker.sqft.toLocaleString()} sqft` : null,
    marker.yearBuilt ? `Built ${marker.yearBuilt}` : null,
  ].filter(Boolean).join(' • ');
  
  return `
    <div style="min-width:220px;max-width:280px;font-family:system-ui,-apple-system,sans-serif;">
      ${photoHTML}
      <div style="padding:${photoHTML ? '0' : '8px'} 8px 8px 8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
          <span style="font-weight:700;font-size:16px;">${priceStr}</span>
          <span style="background-color:${statusColor};color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${statusLabel}</span>
        </div>
        <p style="margin:0 0 4px 0;font-weight:500;font-size:13px;color:#1f2937;">${marker.label || 'Unknown Address'}</p>
        ${detailsHTML ? `<p style="margin:0;font-size:12px;color:#6b7280;">${detailsHTML}</p>` : ''}
        ${marker.mlsNumber ? `<p style="margin:4px 0 0 0;font-size:11px;color:#9ca3af;">MLS# ${marker.mlsNumber}</p>` : ''}
      </div>
    </div>
  `;
}

export function MapboxMap({
  markers,
  center,
  zoom = 12,
  height = '400px',
  showLegend = true,
  interactive = true,
  onMarkerClick,
  className = '',
  style = 'streets',
  polygon,
  showPolygon = false,
  polygonColor = STATUS_COLORS.underContract.hex,
  syncWithTheme = false,
  currentTheme,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  
  const effectiveStyle = useMemo((): MapStyleKey => {
    // Satellite always stays satellite regardless of theme
    if (style === 'satellite') {
      return 'satellite';
    }
    // For streets mode, respect theme sync
    if (syncWithTheme && currentTheme) {
      return currentTheme === 'dark' ? 'dark' : 'streets';
    }
    return style;
  }, [syncWithTheme, currentTheme, style]);

  const calculatedCenter = useMemo((): [number, number] => {
    if (center) return center;
    if (markers.length === 0) return [-97.7431, 30.2672];
    const validMarkers = markers.filter(m => m.latitude && m.longitude);
    if (validMarkers.length === 0) return [-97.7431, 30.2672];
    const sumLng = validMarkers.reduce((sum, m) => sum + m.longitude, 0);
    const sumLat = validMarkers.reduce((sum, m) => sum + m.latitude, 0);
    return [sumLng / validMarkers.length, sumLat / validMarkers.length];
  }, [center, markers]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!mapboxToken || mapboxToken === 'undefined' || !mapboxToken.startsWith('pk.')) {
      setMapError('Mapbox token not configured');
      console.error('[MapboxMap] Token missing or invalid');
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: MAP_STYLES[effectiveStyle],
        center: calculatedCenter,
        zoom,
        interactive,
      });

      map.current.on('load', () => {
        setMapLoaded(true);
      });

      map.current.on('error', (e) => {
        console.error('[MapboxMap] Error:', e);
        setMapError('Failed to load map');
      });

      if (interactive) {
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      }
    } catch (error) {
      console.error('[MapboxMap] Initialization error:', error);
      setMapError('Failed to initialize map');
    }

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken, effectiveStyle]);

  // Track current style to detect changes
  const currentStyleRef = useRef<MapStyleKey>(effectiveStyle);

  // Function to add polygon overlays to map
  const addPolygonToMap = () => {
    if (!map.current) return;
    
    // Remove existing polygon layers/source
    if (map.current.getLayer('polygon-layer')) {
      map.current.removeLayer('polygon-layer');
    }
    if (map.current.getLayer('polygon-outline')) {
      map.current.removeLayer('polygon-outline');
    }
    if (map.current.getSource('polygon-source')) {
      map.current.removeSource('polygon-source');
    }

    if (showPolygon && polygon && polygon.length > 0) {
      map.current.addSource('polygon-source', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: polygon,
          },
        },
      });

      map.current.addLayer({
        id: 'polygon-layer',
        type: 'fill',
        source: 'polygon-source',
        paint: {
          'fill-color': polygonColor,
          'fill-opacity': 0.15,
        },
      });

      map.current.addLayer({
        id: 'polygon-outline',
        type: 'line',
        source: 'polygon-source',
        paint: {
          'line-color': polygonColor,
          'line-width': 2,
        },
      });
    }
  };

  // Handle style changes (theme sync)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (currentStyleRef.current === effectiveStyle) return;
    
    currentStyleRef.current = effectiveStyle;
    
    // Set new style - Mapbox will handle the transition
    map.current.setStyle(MAP_STYLES[effectiveStyle]);
    
    // Re-add polygons after style loads (markers are DOM elements and persist,
    // but polygon sources/layers need to be re-added)
    map.current.once('style.load', () => {
      addPolygonToMap();
    });
  }, [effectiveStyle, mapLoaded, polygon, showPolygon, polygonColor]);

  // Function to add markers to map
  const addMarkersToMap = () => {
    if (!map.current) return;
    
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const validMarkers = markers.filter(m => m.latitude && m.longitude);

    validMarkers.forEach((marker) => {
      const el = createMarkerElement(marker);
      
      const popup = new mapboxgl.Popup({ 
        offset: 25, 
        closeButton: true,
        maxWidth: '300px'
      }).setHTML(createPopupHTML(marker));

      const mapboxMarker = new mapboxgl.Marker(el)
        .setLngLat([marker.longitude, marker.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      if (onMarkerClick) {
        el.addEventListener('click', () => onMarkerClick(marker.id));
      }

      markersRef.current.push(mapboxMarker);
    });

    if (validMarkers.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      validMarkers.forEach((marker) => {
        bounds.extend([marker.longitude, marker.latitude]);
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    } else if (validMarkers.length === 1) {
      map.current.setCenter([validMarkers[0].longitude, validMarkers[0].latitude]);
      map.current.setZoom(14);
    }
  };

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    addMarkersToMap();
  }, [markers, mapLoaded, onMarkerClick]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    addPolygonToMap();
  }, [polygon, showPolygon, polygonColor, mapLoaded]);

  if (mapError) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted rounded-lg ${className}`}
        style={{ height }}
        data-testid="mapbox-error"
      >
        <div className="text-center text-muted-foreground p-4">
          <p className="font-medium">{mapError}</p>
          <p className="text-sm mt-1">Please configure VITE_MAPBOX_TOKEN</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapContainer} 
        style={{ height }} 
        className="rounded-lg"
        data-testid="mapbox-container"
      />
      
      {showLegend && (
        <MapLegend 
          statuses={['subject', 'active', 'underContract', 'closed', 'pending']} 
          className="absolute bottom-4 left-4"
        />
      )}
    </div>
  );
}

export function generateStaticMapUrl(
  markers: MapMarker[],
  width: number = 800,
  height: number = 400,
  style: 'streets' | 'satellite' | 'dark' = 'streets'
): string | null {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token || token === 'undefined' || !token.startsWith('pk.')) return null;

  const validMarkers = markers.filter(m => m.latitude && m.longitude);
  if (validMarkers.length === 0) return null;

  const styleId = {
    streets: 'streets-v12',
    satellite: 'satellite-streets-v12',
    dark: 'dark-v11'
  }[style];

  const pins = validMarkers.map(m => {
    const color = getStatusColor(m.status || '', m.isSubject).replace('#', '');
    return `pin-s+${color}(${m.longitude},${m.latitude})`;
  }).join(',');

  return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/${pins}/auto/${width}x${height}?access_token=${token}&padding=50`;
}

export default MapboxMap;
