import { useState, useEffect, useCallback, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Layers, Droplets, GraduationCap, X, Info, Check } from "lucide-react";

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

function LegendPanel({ 
  showFloodZones, 
  showSchoolDistricts, 
  districtNames,
  onClose 
}: { 
  showFloodZones: boolean;
  showSchoolDistricts: boolean;
  districtNames: string[];
  onClose: () => void;
}) {
  const zones = ["A", "AE", "AO", "X"];
  const displayDistricts = districtNames.slice(0, 8);

  return (
    <Card className="w-[280px] bg-background/98 backdrop-blur-sm shadow-xl border">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Map Legend</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
          data-testid="button-legend-close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="p-3 space-y-4 max-h-[300px] overflow-y-auto">
        {showFloodZones && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Flood Zones</span>
            </div>
            <div className="space-y-1.5 pl-6">
              {zones.map(zone => (
                <div key={zone} className="flex items-center gap-2">
                  <div 
                    className="w-5 h-3.5 rounded-sm border border-black/20" 
                    style={{ backgroundColor: FLOOD_ZONE_COLORS[zone], opacity: 0.7 }}
                  />
                  <span className="text-xs text-muted-foreground">{FLOOD_ZONE_LABELS[zone]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {showSchoolDistricts && districtNames.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">School Districts</span>
            </div>
            <div className="space-y-1.5 pl-6">
              {displayDistricts.map((name, index) => (
                <div key={name} className="flex items-center gap-2">
                  <div 
                    className="w-5 h-3.5 rounded-sm border border-black/20" 
                    style={{ backgroundColor: getSchoolDistrictColor(index), opacity: 0.6 }}
                  />
                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">{name}</span>
                </div>
              ))}
              {districtNames.length > 8 && (
                <div className="text-xs text-muted-foreground pl-7">
                  +{districtNames.length - 8} more districts
                </div>
              )}
            </div>
          </div>
        )}

        {!showFloodZones && !showSchoolDistricts && (
          <div className="text-sm text-muted-foreground text-center py-2">
            Enable layers to see legend
          </div>
        )}
      </div>
    </Card>
  );
}

function MapLayerRenderer({ 
  showFloodZones, 
  showSchoolDistricts,
  onDistrictsLoaded,
}: { 
  showFloodZones: boolean;
  showSchoolDistricts: boolean;
  onDistrictsLoaded: (names: string[]) => void;
}) {
  const map = useMap();
  const [floodLayer, setFloodLayer] = useState<L.GeoJSON | null>(null);
  const [schoolLayer, setSchoolLayer] = useState<L.GeoJSON | null>(null);

  const { data: floodData } = useQuery<{ features?: FloodZoneFeature[]; success?: boolean }>({
    queryKey: ["/api/map-layers/flood-zones"],
    enabled: showFloodZones,
    staleTime: 1000 * 60 * 30,
  });

  const { data: schoolData } = useQuery<{ features?: SchoolDistrictFeature[]; success?: boolean }>({
    queryKey: ["/api/map-layers/school-districts"],
    enabled: showSchoolDistricts,
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    if (floodLayer) {
      map.removeLayer(floodLayer);
      setFloodLayer(null);
    }

    if (showFloodZones && floodData?.features && floodData.features.length > 0) {
      const layer = L.geoJSON(floodData as any, {
        style: (feature) => {
          const zone = feature?.properties?.FLD_ZONE || "X";
          return {
            fillColor: FLOOD_ZONE_COLORS[zone] || FLOOD_ZONE_COLORS["X"],
            fillOpacity: 0.35,
            color: FLOOD_ZONE_COLORS[zone] || FLOOD_ZONE_COLORS["X"],
            weight: 1,
            opacity: 0.6,
          };
        },
        onEachFeature: (feature, layer) => {
          const zone = feature.properties?.FLD_ZONE || "Unknown";
          const label = FLOOD_ZONE_LABELS[zone] || zone;
          layer.bindPopup(`
            <div class="p-2">
              <div class="font-semibold">Flood Zone: ${zone}</div>
              <div class="text-sm text-muted-foreground">${label}</div>
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
  }, [showFloodZones, floodData, map]);

  useEffect(() => {
    if (schoolLayer) {
      map.removeLayer(schoolLayer);
      setSchoolLayer(null);
    }

    if (showSchoolDistricts && schoolData?.features && schoolData.features.length > 0) {
      const districtNames: string[] = [];
      
      const layer = L.geoJSON(schoolData as any, {
        style: (feature) => {
          const idx = districtNames.indexOf(feature?.properties?.NAME || "");
          const colorIndex = idx >= 0 ? idx : districtNames.length;
          if (feature?.properties?.NAME && !districtNames.includes(feature.properties.NAME)) {
            districtNames.push(feature.properties.NAME);
          }
          return {
            fillColor: getSchoolDistrictColor(colorIndex),
            fillOpacity: 0.25,
            color: getSchoolDistrictColor(colorIndex),
            weight: 2,
            opacity: 0.8,
          };
        },
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.NAME || "Unknown District";
          layer.bindPopup(`
            <div class="p-2">
              <div class="font-semibold">${name}</div>
              <div class="text-sm text-muted-foreground">School District</div>
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
  }, [showSchoolDistricts, schoolData, map, onDistrictsLoaded]);

  return null;
}

export function MapLayersControl({ position = "topright" }: MapLayersControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showFloodZones, setShowFloodZones] = useState(false);
  const [showSchoolDistricts, setShowSchoolDistricts] = useState(false);
  const [districtNames, setDistrictNames] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);

  const enabledCount = (showFloodZones ? 1 : 0) + (showSchoolDistricts ? 1 : 0);

  const handleDistrictsLoaded = useCallback((names: string[]) => {
    setDistrictNames(names);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setIsOpen(false);
      }
      if (legendRef.current && !legendRef.current.contains(target)) {
        setShowLegend(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setShowLegend(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const positionClasses = {
    topleft: "top-14 left-2",
    topright: "top-2 right-2",
    bottomleft: "bottom-2 left-2",
    bottomright: "bottom-2 right-2",
  };

  const panelAnchor = {
    topleft: "left-0 top-full mt-2",
    topright: "right-0 top-full mt-2",
    bottomleft: "left-0 bottom-full mb-2",
    bottomright: "right-0 bottom-full mb-2",
  };

  return (
    <>
      <MapLayerRenderer 
        showFloodZones={showFloodZones}
        showSchoolDistricts={showSchoolDistricts}
        onDistrictsLoaded={handleDistrictsLoaded}
      />
      
      <div 
        className={`absolute ${positionClasses[position]} z-[1000]`}
        style={{ pointerEvents: "auto" }}
        ref={panelRef}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="h-10 px-4 gap-2 shadow-lg bg-background/95 backdrop-blur-sm border hover-elevate"
            onClick={() => setIsOpen(!isOpen)}
            data-testid="button-map-layers-toggle"
          >
            <Layers className="h-5 w-5" />
            <span className="font-medium">Layers</span>
            {enabledCount > 0 && (
              <Badge 
                variant="default" 
                className="h-5 min-w-[20px] px-1.5 text-xs"
                data-testid="badge-layers-count"
              >
                {enabledCount}
              </Badge>
            )}
          </Button>

          {enabledCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-3 gap-1.5 shadow-lg bg-background/95 backdrop-blur-sm"
              onClick={() => setShowLegend(!showLegend)}
              data-testid="button-legend-toggle"
            >
              <Info className="h-4 w-4" />
              <span className="text-sm">Legend</span>
            </Button>
          )}
        </div>
        
        {isOpen && (
          <div className={`absolute ${panelAnchor[position]}`}>
            <Card className="w-[300px] bg-background/98 backdrop-blur-sm shadow-xl border">
              <div className="flex items-center justify-between p-3 border-b">
                <span className="font-semibold">Map Layers</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsOpen(false)}
                  data-testid="button-layers-panel-close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="p-3 space-y-1">
                <button
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setShowFloodZones(!showFloodZones)}
                  data-testid="button-toggle-flood-zones"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10">
                      <Droplets className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm flex items-center gap-2">
                        Flood Zones
                        {showFloodZones && <Check className="h-4 w-4 text-green-500" />}
                      </div>
                      <div className="text-xs text-muted-foreground">FEMA flood hazard areas</div>
                    </div>
                  </div>
                  <Switch
                    checked={showFloodZones}
                    onCheckedChange={setShowFloodZones}
                    onClick={(e) => e.stopPropagation()}
                    data-testid="switch-flood-zones"
                  />
                </button>
                
                <button
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setShowSchoolDistricts(!showSchoolDistricts)}
                  data-testid="button-toggle-school-districts"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-500/10">
                      <GraduationCap className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm flex items-center gap-2">
                        School Districts
                        {showSchoolDistricts && <Check className="h-4 w-4 text-green-500" />}
                      </div>
                      <div className="text-xs text-muted-foreground">Austin area school boundaries</div>
                    </div>
                  </div>
                  <Switch
                    checked={showSchoolDistricts}
                    onCheckedChange={setShowSchoolDistricts}
                    onClick={(e) => e.stopPropagation()}
                    data-testid="switch-school-districts"
                  />
                </button>
              </div>

              {enabledCount > 0 && (
                <div className="px-3 pb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setShowFloodZones(false);
                      setShowSchoolDistricts(false);
                    }}
                    data-testid="button-clear-layers"
                  >
                    Clear All Layers
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}

        {showLegend && (
          <div 
            className={`absolute ${panelAnchor[position]}`}
            style={{ marginLeft: position.includes("left") ? "0" : "-60px" }}
            ref={legendRef}
          >
            <LegendPanel
              showFloodZones={showFloodZones}
              showSchoolDistricts={showSchoolDistricts}
              districtNames={districtNames}
              onClose={() => setShowLegend(false)}
            />
          </div>
        )}
      </div>
    </>
  );
}
