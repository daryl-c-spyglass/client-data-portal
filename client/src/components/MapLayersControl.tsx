import { useState, useEffect, useCallback, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { createRoot } from "react-dom/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Layers, Droplets, GraduationCap, X, Info, Check, Loader2, AlertCircle, RefreshCw } from "lucide-react";

interface MapLayersControlProps {
  position?: "topleft" | "topright" | "bottomleft" | "bottomright";
}

interface FloodZoneFeature {
  type: "Feature";
  properties: {
    FLD_ZONE?: string;
    ZONE_SUBTY?: string;
    SFHA_TF?: string;
  };
  geometry: any;
}

interface SchoolDistrictFeature {
  type: "Feature";
  properties: {
    NAME?: string;
    OBJECTID?: number;
  };
  geometry: any;
}

const FLOOD_ZONE_COLORS: Record<string, string> = {
  "A": "#0066FF",
  "AE": "#0044AA",
  "AO": "#3366FF",
  "AH": "#4477FF",
  "VE": "#FF0000",
  "V": "#CC0000",
  "X": "#99CCFF",
  "D": "#AAAAAA",
};

const FLOOD_ZONE_LABELS: Record<string, string> = {
  "A": "High Risk (100-yr flood)",
  "AE": "High Risk w/ Base Elevation",
  "AO": "High Risk - Sheet Flow",
  "AH": "High Risk - Ponding",
  "VE": "Coastal High Hazard",
  "V": "Coastal High Hazard",
  "X": "Moderate to Low Risk",
  "D": "Undetermined Risk",
};

const SCHOOL_DISTRICT_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", 
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#85C1E9", "#F8B500", "#82E0AA",
];

function getSchoolDistrictColor(index: number): string {
  return SCHOOL_DISTRICT_COLORS[index % SCHOOL_DISTRICT_COLORS.length];
}

const isDev = import.meta.env.DEV;

const DEMO_FLOOD_ZONE: any = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { FLD_ZONE: "AE", DEMO: true },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-97.76, 30.28],
        [-97.74, 30.28],
        [-97.74, 30.26],
        [-97.76, 30.26],
        [-97.76, 30.28],
      ]],
    },
  }],
};

const DEMO_SCHOOL_DISTRICT: any = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { NAME: "Austin ISD (Demo)", DEMO: true },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-97.78, 30.30],
        [-97.72, 30.30],
        [-97.72, 30.24],
        [-97.78, 30.24],
        [-97.78, 30.30],
      ]],
    },
  }],
};

function MapLayerRenderer({ 
  showFloodZones, 
  showSchoolDistricts,
  demoMode,
  onDistrictsLoaded,
  onFloodStatus,
  onSchoolStatus,
}: { 
  showFloodZones: boolean;
  showSchoolDistricts: boolean;
  demoMode: boolean;
  onDistrictsLoaded: (names: string[]) => void;
  onFloodStatus: (status: "idle" | "loading" | "success" | "error", count?: number) => void;
  onSchoolStatus: (status: "idle" | "loading" | "success" | "error", count?: number) => void;
}) {
  const map = useMap();
  const [floodLayer, setFloodLayer] = useState<L.GeoJSON | null>(null);
  const [schoolLayer, setSchoolLayer] = useState<L.GeoJSON | null>(null);

  const { data: floodData, isLoading: floodLoading, isError: floodError, refetch: refetchFlood } = useQuery<{ features?: FloodZoneFeature[]; success?: boolean }>({
    queryKey: ["/api/map-layers/flood-zones"],
    enabled: showFloodZones && !demoMode,
    staleTime: 1000 * 60 * 30,
  });

  const { data: schoolData, isLoading: schoolLoading, isError: schoolError, refetch: refetchSchool } = useQuery<{ features?: SchoolDistrictFeature[]; success?: boolean }>({
    queryKey: ["/api/map-layers/school-districts"],
    enabled: showSchoolDistricts && !demoMode,
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    if (!showFloodZones) {
      onFloodStatus("idle");
    } else if (floodLoading) {
      onFloodStatus("loading");
    } else if (floodError) {
      onFloodStatus("error");
    } else if (floodData?.features) {
      onFloodStatus("success", floodData.features.length);
    }
  }, [showFloodZones, floodLoading, floodError, floodData, onFloodStatus]);

  useEffect(() => {
    if (!showSchoolDistricts) {
      onSchoolStatus("idle");
    } else if (schoolLoading) {
      onSchoolStatus("loading");
    } else if (schoolError) {
      onSchoolStatus("error");
    } else if (schoolData?.features) {
      onSchoolStatus("success", schoolData.features.length);
    }
  }, [showSchoolDistricts, schoolLoading, schoolError, schoolData, onSchoolStatus]);

  useEffect(() => {
    if (floodLayer) {
      map.removeLayer(floodLayer);
      setFloodLayer(null);
    }

    const dataToRender = demoMode && showFloodZones ? DEMO_FLOOD_ZONE : floodData;

    if (showFloodZones && dataToRender?.features && dataToRender.features.length > 0) {
      const layer = L.geoJSON(dataToRender as any, {
        style: (feature) => {
          const zone = feature?.properties?.FLD_ZONE || "X";
          const isDemo = feature?.properties?.DEMO;
          return {
            fillColor: FLOOD_ZONE_COLORS[zone] || FLOOD_ZONE_COLORS["X"],
            fillOpacity: isDemo ? 0.5 : 0.35,
            color: FLOOD_ZONE_COLORS[zone] || FLOOD_ZONE_COLORS["X"],
            weight: isDemo ? 3 : 1,
            opacity: 0.8,
            dashArray: isDemo ? "5, 5" : undefined,
          };
        },
        onEachFeature: (feature, layer) => {
          const zone = feature.properties?.FLD_ZONE || "Unknown";
          const label = FLOOD_ZONE_LABELS[zone] || zone;
          const isDemo = feature.properties?.DEMO;
          layer.bindPopup(`
            <div class="p-2">
              <div class="font-semibold">Flood Zone: ${zone}${isDemo ? " (Demo)" : ""}</div>
              <div class="text-sm text-gray-600">${label}</div>
            </div>
          `);
        },
      });
      
      layer.addTo(map);
      setFloodLayer(layer);
    }

    return () => {
      if (floodLayer) {
        map.removeLayer(floodLayer);
      }
    };
  }, [showFloodZones, floodData, demoMode, map]);

  useEffect(() => {
    if (schoolLayer) {
      map.removeLayer(schoolLayer);
      setSchoolLayer(null);
    }

    const dataToRender = demoMode && showSchoolDistricts ? DEMO_SCHOOL_DISTRICT : schoolData;

    if (showSchoolDistricts && dataToRender?.features && dataToRender.features.length > 0) {
      const districtNames: string[] = [];
      
      const layer = L.geoJSON(dataToRender as any, {
        style: (feature) => {
          const idx = districtNames.indexOf(feature?.properties?.NAME || "");
          const colorIndex = idx >= 0 ? idx : districtNames.length;
          const isDemo = feature?.properties?.DEMO;
          if (feature?.properties?.NAME && !districtNames.includes(feature.properties.NAME)) {
            districtNames.push(feature.properties.NAME);
          }
          return {
            fillColor: getSchoolDistrictColor(colorIndex),
            fillOpacity: isDemo ? 0.4 : 0.25,
            color: getSchoolDistrictColor(colorIndex),
            weight: isDemo ? 3 : 2,
            opacity: 0.8,
            dashArray: isDemo ? "5, 5" : undefined,
          };
        },
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.NAME || "Unknown District";
          const isDemo = feature.properties?.DEMO;
          layer.bindPopup(`
            <div class="p-2">
              <div class="font-semibold">${name}${isDemo ? " (Demo)" : ""}</div>
              <div class="text-sm text-gray-600">School District</div>
            </div>
          `);
        },
      });
      
      layer.addTo(map);
      setSchoolLayer(layer);
      onDistrictsLoaded(districtNames);
    }

    return () => {
      if (schoolLayer) {
        map.removeLayer(schoolLayer);
      }
    };
  }, [showSchoolDistricts, schoolData, demoMode, map, onDistrictsLoaded]);

  return null;
}

function LayerPanelContent({
  showFloodZones,
  showSchoolDistricts,
  demoMode,
  floodStatus,
  schoolStatus,
  floodCount,
  schoolCount,
  districtNames,
  districtsExpanded,
  onFloodToggle,
  onSchoolToggle,
  onDemoToggle,
  onToggleDistrictsExpanded,
  onClose,
}: {
  showFloodZones: boolean;
  showSchoolDistricts: boolean;
  demoMode: boolean;
  floodStatus: "idle" | "loading" | "success" | "error";
  schoolStatus: "idle" | "loading" | "success" | "error";
  floodCount: number;
  schoolCount: number;
  districtNames: string[];
  districtsExpanded: boolean;
  onFloodToggle: () => void;
  onSchoolToggle: () => void;
  onDemoToggle: () => void;
  onToggleDistrictsExpanded: () => void;
  onClose: () => void;
}) {
  const enabledCount = (showFloodZones ? 1 : 0) + (showSchoolDistricts ? 1 : 0);

  return (
    <div 
      className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-[300px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-gray-900 dark:text-gray-100">Map Layers</span>
        <button
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          onClick={onClose}
          data-testid="button-layers-panel-close"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>
      
      <div className="p-2 space-y-1">
        <button
          className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer text-left"
          onClick={onFloodToggle}
          data-testid="button-toggle-flood-zones"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Droplets className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                Flood Zones
                {showFloodZones && floodStatus === "success" && <Check className="h-4 w-4 text-green-500" />}
                {showFloodZones && floodStatus === "loading" && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                {showFloodZones && floodStatus === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {floodStatus === "loading" ? "Loading flood data..." : 
                 floodStatus === "error" ? "Failed to load" :
                 floodStatus === "success" && floodCount === 0 ? "No data in area" :
                 floodStatus === "success" ? `${floodCount} zones loaded` :
                 "FEMA flood hazard areas"}
              </div>
            </div>
          </div>
          <Switch
            checked={showFloodZones}
            onCheckedChange={onFloodToggle}
            onClick={(e) => e.stopPropagation()}
            data-testid="switch-flood-zones"
          />
        </button>
        
        <button
          className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer text-left"
          onClick={onSchoolToggle}
          data-testid="button-toggle-school-districts"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <GraduationCap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                School Districts
                {showSchoolDistricts && schoolStatus === "success" && <Check className="h-4 w-4 text-green-500" />}
                {showSchoolDistricts && schoolStatus === "loading" && <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />}
                {showSchoolDistricts && schoolStatus === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {schoolStatus === "loading" ? "Loading districts..." : 
                 schoolStatus === "error" ? "Failed to load" :
                 schoolStatus === "success" && schoolCount === 0 ? "No data in area" :
                 schoolStatus === "success" ? `${schoolCount} districts loaded` :
                 "Austin area school boundaries"}
              </div>
            </div>
          </div>
          <Switch
            checked={showSchoolDistricts}
            onCheckedChange={onSchoolToggle}
            onClick={(e) => e.stopPropagation()}
            data-testid="switch-school-districts"
          />
        </button>

        {isDev && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
            <button
              className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors cursor-pointer text-left"
              onClick={onDemoToggle}
              data-testid="button-toggle-demo-mode"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <RefreshCw className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100">Demo Mode</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Show sample overlays (dev only)</div>
                </div>
              </div>
              <Switch
                checked={demoMode}
                onCheckedChange={onDemoToggle}
                onClick={(e) => e.stopPropagation()}
                data-testid="switch-demo-mode"
              />
            </button>
          </div>
        )}
      </div>

      <div className="px-3 pb-3 pt-1">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Toggle layers to display overlays on the map
        </p>
      </div>

      {(showFloodZones || showSchoolDistricts) && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Legend</div>
          {showFloodZones && (
            <div className="mb-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Flood Zones</div>
              <div className="space-y-1">
                {["A", "AE", "X"].map(zone => (
                  <div key={zone} className="flex items-center gap-2">
                    <div 
                      className="w-4 h-3 rounded-sm border border-black/20" 
                      style={{ backgroundColor: FLOOD_ZONE_COLORS[zone], opacity: 0.7 }}
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">{FLOOD_ZONE_LABELS[zone]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {showSchoolDistricts && districtNames.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">School Districts</div>
              <div className="space-y-1">
                {districtNames.slice(0, districtsExpanded ? districtNames.length : 4).map((name, idx) => (
                  <div key={name} className="flex items-center gap-2">
                    <div 
                      className="w-4 h-3 rounded-sm border border-black/20" 
                      style={{ backgroundColor: getSchoolDistrictColor(idx), opacity: 0.6 }}
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[180px]">{name}</span>
                  </div>
                ))}
                {districtNames.length > 4 && (
                  <button 
                    onClick={onToggleDistrictsExpanded}
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    {districtsExpanded ? "Show less" : `+${districtNames.length - 4} more`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MapLayersControl({ position = "topright" }: MapLayersControlProps) {
  const map = useMap();
  const [isOpen, setIsOpen] = useState(false);
  const [showFloodZones, setShowFloodZones] = useState(false);
  const [showSchoolDistricts, setShowSchoolDistricts] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [districtNames, setDistrictNames] = useState<string[]>([]);
  const [floodStatus, setFloodStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [schoolStatus, setSchoolStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [floodCount, setFloodCount] = useState(0);
  const [schoolCount, setSchoolCount] = useState(0);
  const [districtsExpanded, setDistrictsExpanded] = useState(false);
  const controlRef = useRef<L.Control | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);

  const enabledCount = (showFloodZones ? 1 : 0) + (showSchoolDistricts ? 1 : 0);

  const handleDistrictsLoaded = useCallback((names: string[]) => {
    setDistrictNames(names);
  }, []);

  const handleFloodStatus = useCallback((status: "idle" | "loading" | "success" | "error", count?: number) => {
    setFloodStatus(status);
    if (count !== undefined) setFloodCount(count);
  }, []);

  const handleSchoolStatus = useCallback((status: "idle" | "loading" | "success" | "error", count?: number) => {
    setSchoolStatus(status);
    if (count !== undefined) setSchoolCount(count);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const LeafletControl = L.Control.extend({
      onAdd: function() {
        const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        container.style.background = "none";
        container.style.border = "none";
        container.style.boxShadow = "none";
        
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        
        containerRef.current = container;
        return container;
      },
      onRemove: function() {
        if (rootRef.current) {
          rootRef.current.unmount();
          rootRef.current = null;
        }
      }
    });

    const control = new LeafletControl({ position });
    controlRef.current = control;
    map.addControl(control);

    return () => {
      if (controlRef.current) {
        map.removeControl(controlRef.current);
      }
    };
  }, [map, position]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!rootRef.current) {
      rootRef.current = createRoot(containerRef.current);
    }

    rootRef.current.render(
      <div className="relative">
        <button
          className="flex items-center gap-2 h-10 px-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="button-map-layers-toggle"
        >
          <Layers className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          <span className="font-medium text-sm text-gray-700 dark:text-gray-300">Layers</span>
          {enabledCount > 0 && (
            <span 
              className="flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-full"
              data-testid="badge-layers-count"
            >
              {enabledCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 z-[2000]">
            <LayerPanelContent
              showFloodZones={showFloodZones}
              showSchoolDistricts={showSchoolDistricts}
              demoMode={demoMode}
              floodStatus={floodStatus}
              schoolStatus={schoolStatus}
              floodCount={floodCount}
              schoolCount={schoolCount}
              districtNames={districtNames}
              districtsExpanded={districtsExpanded}
              onFloodToggle={() => setShowFloodZones(!showFloodZones)}
              onSchoolToggle={() => setShowSchoolDistricts(!showSchoolDistricts)}
              onDemoToggle={() => setDemoMode(!demoMode)}
              onToggleDistrictsExpanded={() => setDistrictsExpanded(!districtsExpanded)}
              onClose={() => setIsOpen(false)}
            />
          </div>
        )}
      </div>
    );
  }, [isOpen, showFloodZones, showSchoolDistricts, demoMode, enabledCount, floodStatus, schoolStatus, floodCount, schoolCount, districtNames, districtsExpanded]);

  return (
    <MapLayerRenderer 
      showFloodZones={showFloodZones}
      showSchoolDistricts={showSchoolDistricts}
      demoMode={demoMode}
      onDistrictsLoaded={handleDistrictsLoaded}
      onFloodStatus={handleFloodStatus}
      onSchoolStatus={handleSchoolStatus}
    />
  );
}
