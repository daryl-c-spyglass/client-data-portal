import { useRef, useEffect, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import * as turf from '@turf/turf';
import { 
  CMA_STATUS_COLORS, 
  SUBJECT_COLOR, 
  STATUS_LABELS, 
  normalizeStatus, 
  getCoordinates,
  extractPrice,
  formatPriceShort,
  getPropertyAddress,
  getPropertyPhotos,
  type NormalizedStatus 
} from '@/lib/cma-data-utils';
import { useTheme } from '@/contexts/ThemeContext';

interface CMAMapViewProps {
  properties: any[];
  subjectProperty: any;
  onPropertyClick?: (property: any) => void;
  className?: string;
}

interface CmaPointProperties {
  id: string;
  type: 'subject' | 'comp';
  status: NormalizedStatus;
  price: number;
  priceFormatted: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  address: string;
  dom: number | null;
  mlsNumber: string | null;
}

type CmaPointFeature = GeoJSON.Feature<GeoJSON.Point, CmaPointProperties>;

const MAPBOX_STYLES = {
  STREETS: 'mapbox://styles/mapbox/streets-v12',
  SATELLITE: 'mapbox://styles/mapbox/satellite-streets-v12',
  DARK: 'mapbox://styles/mapbox/dark-v11',
} as const;

const SOURCE_IDS = {
  comps: 'cma-comps-source',
  subject: 'cma-subject-source',
};

const LAYER_IDS = {
  clusterCircle: 'cma-cluster-circle',
  clusterCount: 'cma-cluster-count',
  compPoints: 'cma-comp-points',
  compLabels: 'cma-comp-labels',
  subjectPoint: 'cma-subject-point',
  subjectLabel: 'cma-subject-label',
};

function buildPropertyFeature(property: any, isSubject: boolean): CmaPointFeature | null {
  const coords = getCoordinates(property);
  if (!coords) return null;

  const price = extractPrice(property);
  const status = normalizeStatus(property.status || property.standardStatus);

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [coords.lng, coords.lat],
    },
    properties: {
      id: property.mlsNumber || property.id || Math.random().toString(),
      type: isSubject ? 'subject' : 'comp',
      status: isSubject ? 'ACTIVE' : status,
      price: price || 0,
      priceFormatted: formatPriceShort(price),
      beds: property.bedrooms || property.beds || null,
      baths: property.bathrooms || property.baths || null,
      sqft: property.sqft || property.livingArea || null,
      address: getPropertyAddress(property),
      dom: property.daysOnMarket || null,
      mlsNumber: property.mlsNumber || null,
    },
  };
}

function buildBounds(
  subjectFeature: CmaPointFeature | null,
  compFeatures: CmaPointFeature[]
): [[number, number], [number, number]] | null {
  const allFeatures = [
    ...(subjectFeature ? [subjectFeature] : []),
    ...compFeatures,
  ];
  if (allFeatures.length === 0) return null;
  const collection = turf.featureCollection(allFeatures);
  const bbox = turf.bbox(collection);
  return [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[3]],
  ];
}

export function CMAMapView({ 
  properties, 
  subjectProperty, 
  onPropertyClick,
  className = '',
}: CMAMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const currentStyleRef = useRef<string | null>(null);
  const addLayersRef = useRef<(() => void) | null>(null);
  const { theme } = useTheme();

  // Use Vite environment variable directly (same pattern as MapboxMap component)
  const mapToken = import.meta.env.VITE_MAPBOX_TOKEN;

  const mapModel = useMemo(() => {
    const subjectFeature = subjectProperty 
      ? buildPropertyFeature(subjectProperty, true) 
      : null;
    
    const compFeatures = properties
      .map(p => buildPropertyFeature(p, false))
      .filter((f): f is CmaPointFeature => f !== null);

    const bounds = buildBounds(subjectFeature, compFeatures);

    return {
      subjectFeature,
      compFeatures,
      compsCollection: turf.featureCollection(compFeatures),
      subjectCollection: subjectFeature 
        ? turf.featureCollection([subjectFeature]) 
        : turf.featureCollection([]),
      bounds,
      propertiesWithCoords: compFeatures.length,
      propertiesMissingCoords: properties.length - compFeatures.length,
    };
  }, [properties, subjectProperty]);

  useEffect(() => {
    if (!mapContainer.current || !mapToken || map.current) return;

    console.log('[CMAMap] Creating map instance with token length:', mapToken.length);
    
    try {
      mapboxgl.accessToken = mapToken;

      let initialCenter: [number, number] = [-97.7431, 30.2672];
      if (mapModel.subjectFeature) {
        initialCenter = mapModel.subjectFeature.geometry.coordinates as [number, number];
      } else if (mapModel.compFeatures.length > 0) {
        initialCenter = mapModel.compFeatures[0].geometry.coordinates as [number, number];
      }

      const initialStyle = mapStyle === 'satellite' 
        ? MAPBOX_STYLES.SATELLITE 
        : (theme === 'dark' ? MAPBOX_STYLES.DARK : MAPBOX_STYLES.STREETS);

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: initialStyle,
        center: initialCenter,
        zoom: 11,
        attributionControl: true,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      map.current.on('load', () => {
        console.log('[CMAMap] Map loaded successfully!');
        setMapLoaded(true);
      });
      
      map.current.on('style.load', () => {
        console.log('[CMAMap] Style loaded event');
        map.current?.once('idle', () => {
          console.log('[CMAMap] Map idle - calling addLayers');
          if (addLayersRef.current) {
            addLayersRef.current();
          }
        });
      });
      
      map.current.on('error', (e) => {
        console.error('[CMAMap] Map error:', e.error);
        setMapError(e.error?.message || 'Map failed to load');
      });
    } catch (error) {
      console.error('[CMAMap] Map init error:', error);
      setMapError('Failed to initialize map');
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapToken]);

  const clickHandlerRef = useRef<((e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => void) | null>(null);
  const mouseEnterHandlerRef = useRef<(() => void) | null>(null);
  const mouseLeaveHandlerRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const addLayers = () => {
      if (!map.current || !map.current.isStyleLoaded()) {
        console.log('[CMAMap] Style not loaded yet, skipping addLayers');
        return;
      }
      console.log('[CMAMap] Adding layers to map');
      
      if (clickHandlerRef.current) {
        map.current.off('click', LAYER_IDS.compPoints, clickHandlerRef.current);
      }
      if (mouseEnterHandlerRef.current) {
        map.current.off('mouseenter', LAYER_IDS.compPoints, mouseEnterHandlerRef.current);
      }
      if (mouseLeaveHandlerRef.current) {
        map.current.off('mouseleave', LAYER_IDS.compPoints, mouseLeaveHandlerRef.current);
      }
      
      [SOURCE_IDS.comps, SOURCE_IDS.subject].forEach(sourceId => {
        if (map.current?.getSource(sourceId)) {
          Object.values(LAYER_IDS).forEach(layerId => {
            if (map.current?.getLayer(layerId)) {
              map.current.removeLayer(layerId);
            }
          });
          map.current.removeSource(sourceId);
        }
      });

      map.current.addSource(SOURCE_IDS.comps, {
        type: 'geojson',
        data: mapModel.compsCollection,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.current.addSource(SOURCE_IDS.subject, {
        type: 'geojson',
        data: mapModel.subjectCollection,
      });

      map.current.addLayer({
        id: LAYER_IDS.clusterCircle,
        type: 'circle',
        source: SOURCE_IDS.comps,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#6366f1',
          'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 50, 40],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.current.addLayer({
        id: LAYER_IDS.clusterCount,
        type: 'symbol',
        source: SOURCE_IDS.comps,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      map.current.addLayer({
        id: LAYER_IDS.compPoints,
        type: 'circle',
        source: SOURCE_IDS.comps,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['feature-state', 'hover'], false], 10, 8,
          ],
          'circle-color': [
            'match',
            ['get', 'status'],
            'ACTIVE', CMA_STATUS_COLORS.ACTIVE,
            'UNDER_CONTRACT', CMA_STATUS_COLORS.UNDER_CONTRACT,
            'PENDING', CMA_STATUS_COLORS.PENDING,
            'SOLD', CMA_STATUS_COLORS.SOLD,
            'LEASING', CMA_STATUS_COLORS.LEASING,
            CMA_STATUS_COLORS.UNKNOWN,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.current.addLayer({
        id: LAYER_IDS.compLabels,
        type: 'symbol',
        source: SOURCE_IDS.comps,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': [
            'format',
            ['get', 'priceFormatted'], { 'font-scale': 1.0 },
            '\n', {},
            ['slice', ['get', 'address'], 0, 18], { 'font-scale': 0.85 },
          ],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-offset': [0, -2.2],
          'text-anchor': 'bottom',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#333333',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      });

      map.current.addLayer({
        id: LAYER_IDS.subjectPoint,
        type: 'circle',
        source: SOURCE_IDS.subject,
        paint: {
          'circle-radius': 12,
          'circle-color': SUBJECT_COLOR,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.current.addLayer({
        id: LAYER_IDS.subjectLabel,
        type: 'symbol',
        source: SOURCE_IDS.subject,
        layout: {
          'text-field': [
            'format',
            'SUBJECT', { 'font-scale': 0.9 },
            '\n', {},
            ['get', 'priceFormatted'], { 'font-scale': 1.0 },
          ],
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
          'text-offset': [0, -2.5],
          'text-anchor': 'bottom',
        },
        paint: {
          'text-color': SUBJECT_COLOR,
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      });

      const clickHandler = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        if (e.features?.[0]?.properties && onPropertyClick) {
          const props = e.features[0].properties;
          const property = properties.find(p => 
            p.mlsNumber === props.mlsNumber || p.id === props.id
          );
          if (property) onPropertyClick(property);
        }
      };
      clickHandlerRef.current = clickHandler;
      map.current.on('click', LAYER_IDS.compPoints, clickHandler);

      const mouseEnterHandler = () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      };
      const mouseLeaveHandler = () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      };
      mouseEnterHandlerRef.current = mouseEnterHandler;
      mouseLeaveHandlerRef.current = mouseLeaveHandler;
      map.current.on('mouseenter', LAYER_IDS.compPoints, mouseEnterHandler);
      map.current.on('mouseleave', LAYER_IDS.compPoints, mouseLeaveHandler);

      if (mapModel.bounds) {
        map.current.fitBounds(mapModel.bounds, {
          padding: { top: 60, right: 60, bottom: 60, left: 60 },
          maxZoom: 15,
          duration: 600,
        });
      }
    };

    addLayersRef.current = addLayers;
    
    if (map.current.isStyleLoaded()) {
      addLayers();
    }
  }, [mapLoaded, mapModel, properties, onPropertyClick]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const newStyle = mapStyle === 'satellite' 
      ? MAPBOX_STYLES.SATELLITE 
      : (theme === 'dark' ? MAPBOX_STYLES.DARK : MAPBOX_STYLES.STREETS);
    
    if (currentStyleRef.current === newStyle) return;
    currentStyleRef.current = newStyle;
    
    console.log('[CMAMap] Changing style to:', mapStyle, theme);
    map.current.setStyle(newStyle);
  }, [mapStyle, theme, mapLoaded]);

  if (!mapToken) {
    return (
      <div className={`space-y-2 ${className}`} data-testid="cma-map-view">
        <div className="h-[550px] flex items-center justify-center bg-muted rounded-lg border">
          <div className="text-center">
            <p className="text-red-500 font-medium">Map Configuration Error</p>
            <p className="text-sm text-muted-foreground mt-1">Please configure VITE_MAPBOX_TOKEN</p>
          </div>
        </div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className={`space-y-2 ${className}`} data-testid="cma-map-view">
        <div className="h-[550px] flex items-center justify-center bg-muted rounded-lg border">
          <div className="text-center">
            <p className="text-red-500 font-medium">Map Error</p>
            <p className="text-sm text-muted-foreground">{mapError}</p>
            <p className="text-xs text-muted-foreground mt-2">Check console for details</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`} data-testid="cma-map-view">
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>{mapModel.propertiesWithCoords} comparables{mapModel.subjectFeature ? ' + Subject' : ''}</span>
        {mapModel.propertiesMissingCoords > 0 && (
          <span className="text-amber-600">
            {mapModel.propertiesMissingCoords} missing coordinates
          </span>
        )}
      </div>

      <div className="relative w-full h-[550px] rounded-lg overflow-hidden border">
        <div ref={mapContainer} className="w-full h-full touch-manipulation" />

        <div className="absolute bottom-4 left-4 bg-background/90 dark:bg-background/95 backdrop-blur rounded-lg p-3 shadow-md border">
          <p className="text-xs font-medium mb-2">Legend</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SUBJECT_COLOR }} />
              <span className="text-xs">Subject Property</span>
            </div>
            {Object.entries(CMA_STATUS_COLORS).map(([status, color]) => (
              status !== 'UNKNOWN' && (
                <div key={status} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs">{STATUS_LABELS[status as NormalizedStatus]}</span>
                </div>
              )
            ))}
          </div>
        </div>

        <div className="absolute top-4 left-4 flex gap-1 bg-background/90 rounded-lg p-1 shadow-md border">
          <button
            onClick={() => setMapStyle('streets')}
            className={`px-2 py-1 text-xs rounded ${mapStyle === 'streets' ? 'bg-primary text-primary-foreground' : ''}`}
            data-testid="button-map-streets"
          >
            Map
          </button>
          <button
            onClick={() => setMapStyle('satellite')}
            className={`px-2 py-1 text-xs rounded ${mapStyle === 'satellite' ? 'bg-primary text-primary-foreground' : ''}`}
            data-testid="button-map-satellite"
          >
            Satellite
          </button>
        </div>
      </div>
    </div>
  );
}

export default CMAMapView;
