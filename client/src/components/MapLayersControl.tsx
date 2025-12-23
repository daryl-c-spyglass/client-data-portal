import { useState, useEffect, useCallback } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Layers, Droplets, GraduationCap, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

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

function FloodZoneLegend() {
  const zones = ["A", "AE", "AO", "X"];
  
  return (
    <div className="mt-2 space-y-1">
      <div className="text-xs font-medium text-muted-foreground mb-1">Flood Zone Legend</div>
      {zones.map(zone => (
        <div key={zone} className="flex items-center gap-2">
          <div 
            className="w-4 h-3 rounded-sm border border-black/20" 
            style={{ backgroundColor: FLOOD_ZONE_COLORS[zone], opacity: 0.6 }}
          />
          <span className="text-xs">{FLOOD_ZONE_LABELS[zone]}</span>
        </div>
      ))}
    </div>
  );
}

function SchoolDistrictLegend({ districts }: { districts: string[] }) {
  const displayDistricts = districts.slice(0, 6);
  
  return (
    <div className="mt-2 space-y-1">
      <div className="text-xs font-medium text-muted-foreground mb-1">School Districts</div>
      {displayDistricts.map((name, index) => (
        <div key={name} className="flex items-center gap-2">
          <div 
            className="w-4 h-3 rounded-sm border border-black/20" 
            style={{ backgroundColor: getSchoolDistrictColor(index), opacity: 0.4 }}
          />
          <span className="text-xs truncate max-w-[120px]">{name}</span>
        </div>
      ))}
      {districts.length > 6 && (
        <div className="text-xs text-muted-foreground">+{districts.length - 6} more</div>
      )}
    </div>
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
  const [showFloodZones, setShowFloodZones] = useState(false);
  const [showSchoolDistricts, setShowSchoolDistricts] = useState(false);
  const [districtNames, setDistrictNames] = useState<string[]>([]);

  const handleDistrictsLoaded = useCallback((names: string[]) => {
    setDistrictNames(names);
  }, []);

  const positionClasses = {
    topleft: "top-2 left-2",
    topright: "top-2 right-2",
    bottomleft: "bottom-2 left-2",
    bottomright: "bottom-2 right-2",
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
      >
        <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
          <Button
            variant="ghost"
            size="sm"
            className="w-full flex items-center justify-between gap-2 px-3"
            onClick={() => setIsOpen(!isOpen)}
            data-testid="button-map-layers-toggle"
          >
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              <span className="text-sm font-medium">Map Layers</span>
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          
          {isOpen && (
            <div className="p-3 pt-0 space-y-3 border-t">
              <div className="flex items-center justify-between gap-4 pt-3">
                <Label htmlFor="flood-zones" className="flex items-center gap-2 cursor-pointer">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Flood Zones</span>
                </Label>
                <Switch
                  id="flood-zones"
                  checked={showFloodZones}
                  onCheckedChange={setShowFloodZones}
                  data-testid="switch-flood-zones"
                />
              </div>
              
              {showFloodZones && <FloodZoneLegend />}
              
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="school-districts" className="flex items-center gap-2 cursor-pointer">
                  <GraduationCap className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">School Districts</span>
                </Label>
                <Switch
                  id="school-districts"
                  checked={showSchoolDistricts}
                  onCheckedChange={setShowSchoolDistricts}
                  data-testid="switch-school-districts"
                />
              </div>
              
              {showSchoolDistricts && districtNames.length > 0 && (
                <SchoolDistrictLegend districts={districtNames} />
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
