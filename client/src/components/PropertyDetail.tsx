import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Heart, 
  Share2, 
  Plus, 
  Calendar, 
  Bed, 
  Bath, 
  Maximize, 
  Home, 
  MapPin,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Property, Media } from "@shared/schema";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

interface DebugData {
  dataSource: string;
  fetchTimestamp: string;
  rawFields: Record<string, string | null>;
  subdivisionSource: string;
  subdivisionValue: string | null;
  rawAddress?: {
    streetNumber: string | null;
    streetName: string | null;
    streetSuffix: string | null;
    unitNumber: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
}

interface PropertyDetailProps {
  property: Property;
  media: Media[];
  onAddToCMA?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  onScheduleViewing?: () => void;
  debugData?: DebugData | null;
}

export function PropertyDetail({ 
  property, 
  media, 
  onAddToCMA,
  onSave,
  onShare,
  onScheduleViewing,
  debugData
}: PropertyDetailProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { toast } = useToast();
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if we have valid coordinates
  const hasCoordinates = Boolean(
    property.latitude && 
    property.longitude && 
    !isNaN(Number(property.latitude)) && 
    !isNaN(Number(property.longitude))
  );

  // Function to start auto-advance
  const startAutoAdvance = () => {
    if (autoAdvanceRef.current) {
      clearInterval(autoAdvanceRef.current);
    }
    if (media.length > 1) {
      autoAdvanceRef.current = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % media.length);
      }, 3000);
    }
  };

  // Function to pause and resume auto-advance after manual navigation
  const pauseAndResumeAutoAdvance = () => {
    // Clear existing timers
    if (autoAdvanceRef.current) {
      clearInterval(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    
    // Resume after 3 seconds
    pauseTimeoutRef.current = setTimeout(() => {
      startAutoAdvance();
    }, 3000);
  };

  useEffect(() => {
    startAutoAdvance();
    return () => {
      if (autoAdvanceRef.current) {
        clearInterval(autoAdvanceRef.current);
      }
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, [media.length]);
  
  const formattedPrice = property.listPrice 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(property.listPrice))
    : 'Price upon request';

  const pricePerSqFt = property.listPrice && property.livingArea
    ? (Number(property.listPrice) / Number(property.livingArea)).toFixed(2)
    : null;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % media.length);
    pauseAndResumeAutoAdvance();
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + media.length) % media.length);
    pauseAndResumeAutoAdvance();
  };

  const handleScheduleViewing = () => {
    toast({
      title: "Schedule Viewing",
      description: "Contact your agent to schedule a viewing for this property.",
    });
    onScheduleViewing?.();
  };

  const handleAddToCMA = () => {
    toast({
      title: "Added to CMA",
      description: "This property has been added to your CMA comparables.",
    });
    onAddToCMA?.();
  };

  const handleSave = () => {
    setSaved(!saved);
    toast({
      title: saved ? "Removed from Saved" : "Property Saved",
      description: saved ? "Property removed from your saved list." : "Property added to your saved list.",
    });
    onSave?.();
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      toast({
        title: "Link Copied",
        description: "Property link copied to clipboard.",
      });
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {
      toast({
        title: "Share",
        description: "Use your browser's share function to share this property.",
        variant: "destructive",
      });
    });
    onShare?.();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column - Images & Description */}
      <div className="lg:col-span-2 space-y-6">
        {/* Image Gallery */}
        <div className="space-y-4">
          <div className="relative aspect-[16/9] bg-muted rounded-md overflow-hidden">
            {media.length > 0 ? (
              <>
                <img 
                  src={media[currentImageIndex].mediaURL || media[currentImageIndex].localPath || undefined} 
                  alt={property.unparsedAddress || ''} 
                  className="w-full h-full object-cover"
                  data-testid="img-property-main"
                />
                
                {/* Full-width left/right click zones for navigation */}
                {media.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="absolute left-0 top-0 w-1/2 h-full cursor-pointer z-10 flex items-center justify-start pl-4 bg-transparent hover:bg-black/5 transition-colors focus:outline-none"
                      onClick={prevImage}
                      aria-label="Previous image"
                      data-testid="zone-prev-image"
                    >
                      <ChevronLeft className="w-8 h-8 text-white/80 drop-shadow-lg" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-0 top-0 w-1/2 h-full cursor-pointer z-10 flex items-center justify-end pr-4 bg-transparent hover:bg-black/5 transition-colors focus:outline-none"
                      onClick={nextImage}
                      aria-label="Next image"
                      data-testid="zone-next-image"
                    >
                      <ChevronRight className="w-8 h-8 text-white/80 drop-shadow-lg" />
                    </button>
                  </>
                )}

                {/* Image Counter - z-20 to stay above navigation zones */}
                <div className="absolute bottom-4 right-4 bg-black/60 text-white px-3 py-1 rounded-md text-sm z-20 pointer-events-none">
                  {currentImageIndex + 1} / {media.length}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Home className="w-12 h-12" />
              </div>
            )}
          </div>

          {/* Thumbnail Strip */}
          {media.length > 1 && (
            <div className="grid grid-cols-6 gap-2">
              {media.slice(0, 6).map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setCurrentImageIndex(idx);
                    pauseAndResumeAutoAdvance();
                  }}
                  className={`aspect-square rounded-md overflow-hidden border-2 ${
                    idx === currentImageIndex ? 'border-primary' : 'border-transparent'
                  }`}
                  data-testid={`button-thumbnail-${idx}`}
                >
                  <img 
                    src={m.mediaURL || m.localPath || undefined} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Description Tabs */}
        <Tabs defaultValue="description">
          <TabsList>
            <TabsTrigger value="description" data-testid="tab-description">Description</TabsTrigger>
            <TabsTrigger value="features" data-testid="tab-features">Features & Amenities</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">Property History</TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap" data-testid="text-description">
                  {property.publicRemarks || 'No description available.'}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Interior Features</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• {property.bedroomsTotal} Bedrooms</li>
                      <li>• {property.bathroomsTotalInteger} Bathrooms</li>
                      <li>• {property.livingArea && `${Number(property.livingArea).toLocaleString()} sqft living area`}</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Exterior Features</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• {property.lotSizeSquareFeet && `${Number(property.lotSizeSquareFeet).toLocaleString()} sqft lot`}</li>
                      <li>• {property.lotSizeAcres && `${Number(property.lotSizeAcres).toFixed(2)} acres`}</li>
                      <li>• Built in {property.yearBuilt}</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Location</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {property.subdivision && <li>• Subdivision: {property.subdivision}</li>}
                      <li>• City: {property.city || 'N/A'}</li>
                      <li>• State: {property.stateOrProvince || 'TX'}</li>
                      <li>• ZIP: {property.postalCode || 'N/A'}</li>
                      {property.countyOrParish && <li>• County: {property.countyOrParish}</li>}
                    </ul>
                  </div>
                  {(property.elementarySchool || property.middleOrJuniorSchool || property.highSchool || property.schoolDistrict) && (
                    <div>
                      <h4 className="font-semibold mb-2">Schools</h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {property.elementarySchool && <li>• Elementary: {property.elementarySchool}</li>}
                        {property.middleOrJuniorSchool && <li>• Middle: {property.middleOrJuniorSchool}</li>}
                        {property.highSchool && <li>• High: {property.highSchool}</li>}
                        {property.schoolDistrict && <li>• District: {property.schoolDistrict}</li>}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Listing Information</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {property.listingId && <li>MLS #: {property.listingId}</li>}
                      {property.listingContractDate && <li>List Date: {new Date(property.listingContractDate).toLocaleDateString()}</li>}
                      {property.listPrice && <li>List Price: ${Number(property.listPrice).toLocaleString()}</li>}
                      {property.daysOnMarket !== null && property.daysOnMarket !== undefined && <li>Days on Market: {property.daysOnMarket}</li>}
                    </ul>
                  </div>
                  {(property.closePrice || property.closeDate) && (
                    <div>
                      <h4 className="font-semibold mb-2">Sale Information</h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {property.closePrice && <li>Close Price: ${Number(property.closePrice).toLocaleString()}</li>}
                        {property.closeDate && <li>Close Date: {new Date(property.closeDate).toLocaleDateString()}</li>}
                        {property.closePrice && property.listPrice && (
                          <li>Sale/List Ratio: {((Number(property.closePrice) / Number(property.listPrice)) * 100).toFixed(1)}%</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {(property.listAgentMlsId || property.listOfficeMlsId) && (
                    <div>
                      <h4 className="font-semibold mb-2">Agent Information</h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {property.listAgentMlsId && <li>Agent MLS ID: {property.listAgentMlsId}</li>}
                        {property.listOfficeMlsId && <li>Office MLS ID: {property.listOfficeMlsId}</li>}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Interactive Map */}
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent>
            {hasCoordinates ? (
              <div className="aspect-video rounded-md overflow-hidden">
                <MapContainer
                  center={[Number(property.latitude), Number(property.longitude)]}
                  zoom={15}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[Number(property.latitude), Number(property.longitude)]}>
                    <Popup>
                      <div className="text-sm">
                        <strong>{property.unparsedAddress}</strong>
                        <br />
                        {property.city}, {property.stateOrProvince} {property.postalCode}
                        <br />
                        {formattedPrice}
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            ) : (
              <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MapPin className="w-12 h-12 mx-auto mb-2" />
                  <p>Location coordinates not available</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Sticky Stats Panel */}
      <div className="lg:col-span-1">
        <div className="sticky top-4 space-y-4">
          {/* Price & Status */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <div className="text-3xl font-bold mb-2" data-testid="text-price-detail">
                  {formattedPrice}
                </div>
                {pricePerSqFt && (
                  <div className="text-sm text-muted-foreground">
                    ${pricePerSqFt}/sqft
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {property.standardStatus && (
                  <Badge variant="secondary" data-testid="badge-status-detail">
                    {property.standardStatus}
                  </Badge>
                )}
                {property.daysOnMarket !== null && (
                  <Badge variant="outline">
                    {property.daysOnMarket} DOM
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Address */}
              <div>
                <h3 className="font-semibold mb-1" data-testid="text-address-detail">
                  {property.unparsedAddress || `${property.streetNumber || ''} ${property.streetName || ''}`.trim()}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {property.city}, {property.stateOrProvince} {property.postalCode}
                </p>
              </div>

              <Separator />

              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Bed className="w-4 h-4" />
                    <span className="text-xs">Bedrooms</span>
                  </div>
                  <div className="text-lg font-semibold">{property.bedroomsTotal || '—'}</div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Bath className="w-4 h-4" />
                    <span className="text-xs">Bathrooms</span>
                  </div>
                  <div className="text-lg font-semibold">{property.bathroomsTotalInteger || '—'}</div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Maximize className="w-4 h-4" />
                    <span className="text-xs">Living Area</span>
                  </div>
                  <div className="text-lg font-semibold">
                    {property.livingArea ? `${Number(property.livingArea).toLocaleString()} sqft` : '—'}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Home className="w-4 h-4" />
                    <span className="text-xs">Year Built</span>
                  </div>
                  <div className="text-lg font-semibold">{property.yearBuilt || '—'}</div>
                </div>
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button className="w-full" onClick={handleScheduleViewing} data-testid="button-schedule-viewing">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Viewing
                </Button>
                <Button className="w-full" variant="outline" onClick={handleAddToCMA} data-testid="button-add-to-cma">
                  <Plus className="w-4 h-4 mr-2" />
                  Add to CMA
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={handleSave} data-testid="button-save-property">
                    {saved ? <Check className="w-4 h-4 mr-2" /> : <Heart className="w-4 h-4 mr-2" />}
                    {saved ? 'Saved' : 'Save'}
                  </Button>
                  <Button variant="outline" onClick={handleShare} data-testid="button-share-property">
                    {linkCopied ? <Check className="w-4 h-4 mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
                    {linkCopied ? 'Copied!' : 'Share'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* MLS Info */}
          <Card>
            <CardContent className="pt-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">MLS #</span>
                <span className="font-medium">{property.listingId}</span>
              </div>
              {property.propertyType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Property Type</span>
                  <span className="font-medium">{property.propertyType}</span>
                </div>
              )}
              {property.listingContractDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Listed</span>
                  <span className="font-medium">
                    {new Date(property.listingContractDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
