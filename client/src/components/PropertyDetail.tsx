import { useState, useEffect, useRef } from "react";
import { MapboxMap, type MapMarker } from "@/components/shared/MapboxMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  Copy,
  Bug
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Property, Media } from "@shared/schema";


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
  const [debugOpen, setDebugOpen] = useState(false);
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
                <MapboxMap
                  markers={[{
                    id: String(property.id || property.listingId || 'property'),
                    latitude: Number(property.latitude),
                    longitude: Number(property.longitude),
                    price: Number(property.listPrice) || Number(property.closePrice) || 0,
                    label: property.unparsedAddress || '',
                    status: (property.standardStatus as MapMarker['status']) || 'Active',
                    isSubject: false
                  }]}
                  center={[Number(property.longitude), Number(property.latitude)]}
                  zoom={15}
                  height="100%"
                  showLegend={false}
                  interactive={true}
                />
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

        {/* Dev-only Location Debug Panel */}
        {import.meta.env.DEV && debugData && (
          <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2 text-xs text-muted-foreground">
                <Bug className="w-3 h-3" />
                Location Debug {debugOpen ? '▼' : '▶'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-2 border-dashed border-yellow-500/50 bg-yellow-50/10">
                <CardContent className="pt-4">
                  <div className="text-xs font-mono space-y-3">
                    <div className="p-2 bg-blue-50/30 rounded border border-blue-500/30">
                      <p className="font-semibold text-blue-600">Data Source</p>
                      <p>Source: <span className="text-foreground">{debugData.dataSource}</span></p>
                      <p>Fetched: <span className="text-foreground">{new Date(debugData.fetchTimestamp).toLocaleString()}</span></p>
                    </div>

                    {debugData.rawFields && (
                      <div className="p-2 bg-purple-50/30 rounded border border-purple-500/30">
                        <p className="font-semibold text-purple-600">Raw Subdivision Fields (from API)</p>
                        <div className="space-y-1 mt-1">
                          {Object.entries(debugData.rawFields).map(([field, value]) => (
                            <p key={field}>
                              {field}: <span className={value ? 'text-green-600 font-semibold' : 'text-muted-foreground'}>
                                {value || '(null)'}
                              </span>
                            </p>
                          ))}
                        </div>
                        <Separator className="my-2" />
                        <p className="text-yellow-600 font-semibold">
                          Subdivision Source: <span className="text-foreground">{debugData.subdivisionSource}</span>
                        </p>
                        <p className="text-yellow-600 font-semibold">
                          Final Value: <span className="text-foreground">{debugData.subdivisionValue || '(none)'}</span>
                        </p>
                      </div>
                    )}

                    <h5 className="font-semibold text-yellow-600">Location Data Mapping</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <p className="text-muted-foreground">From Listing (Normalized):</p>
                        <p>subdivision: <span className="text-foreground">{property.subdivision || '(empty)'}</span></p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Coordinates:</p>
                        <p>lat: {property.latitude || '(none)'}, lng: {property.longitude || '(none)'}</p>
                      </div>
                    </div>
                    <div className="mt-2 p-2 bg-muted/50 rounded text-muted-foreground">
                      <p className="font-semibold">Data Integrity Rules:</p>
                      <p>• Subdivision = tract/community label from listing data</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}
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
