import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Mail, Home, DollarSign, Bed, Bath, Ruler, Calendar, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SellerUpdate } from "@shared/schema";
import spyglassLogo from "@assets/Large_Logo_1765233192587.jpeg";

const AGENT_INFO = {
  name: "Ryan Rodenbeck",
  title: "Broker / Owner",
  email: "ryan@spyglassrealty.com",
  phone: "(512) 710-7101",
  company: "Spyglass Realty",
  website: "spyglassrealty.com",
};

interface PreviewProperty {
  id: string;
  unparsedAddress?: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
  listPrice?: number;
  closePrice?: number;
  standardStatus?: string;
  bedroomsTotal?: number;
  bathroomsTotalInteger?: number;
  livingArea?: number;
  yearBuilt?: number;
  photos?: string[];
  daysOnMarket?: number;
  propertySubType?: string;
}

interface PreviewData {
  update: SellerUpdate;
  properties: PreviewProperty[];
  stats: {
    activeCount: number;
    soldCount: number;
    avgPrice: number;
    avgDom: number;
  };
}

function formatPrice(price?: number): string {
  if (!price) return 'N/A';
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 0 
  }).format(price);
}

export default function SellerUpdatePreview() {
  const { id } = useParams<{ id: string }>();
  
  const { data: update, isLoading: updateLoading } = useQuery<SellerUpdate>({
    queryKey: ['/api/seller-updates', id],
    enabled: !!id,
  });

  const { data: previewData, isLoading: previewLoading } = useQuery<PreviewData>({
    queryKey: ['/api/seller-updates', id, 'preview'],
    enabled: !!id,
  });

  const isLoading = updateLoading || previewLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!update) {
    return (
      <div className="space-y-6">
        <Link href="/seller-updates">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Seller Updates
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Update Not Found</h3>
            <p className="text-muted-foreground text-center">
              The seller update you're looking for doesn't exist or has been deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const properties = previewData?.properties || [];
  const stats = previewData?.stats || { activeCount: 0, soldCount: 0, avgPrice: 0, avgDom: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/seller-updates">
            <Button variant="ghost" className="gap-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Preview: {update.name}</h1>
            <p className="text-muted-foreground text-sm">
              Market update for {update.postalCode}
              {update.elementarySchool && ` • ${update.elementarySchool} school zone`}
            </p>
          </div>
        </div>
        <Badge variant={update.isActive ? "default" : "secondary"}>
          {update.isActive ? 'Active' : 'Paused'}
        </Badge>
      </div>

      <Card className="overflow-hidden border-primary/20">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <img 
              src={spyglassLogo} 
              alt="Spyglass Realty" 
              className="h-20 w-auto object-contain"
              data-testid="img-logo"
            />
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold text-primary">{AGENT_INFO.company}</h2>
              <p className="text-lg font-semibold">{AGENT_INFO.name}</p>
              <p className="text-sm text-muted-foreground">{AGENT_INFO.title}</p>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <a 
                href={`mailto:${AGENT_INFO.email}`} 
                className="flex items-center gap-2 hover:text-primary transition-colors"
                data-testid="link-agent-email"
              >
                <Mail className="w-4 h-4 text-primary" />
                {AGENT_INFO.email}
              </a>
              <a 
                href={`tel:${AGENT_INFO.phone.replace(/\D/g, '')}`} 
                className="flex items-center gap-2 hover:text-primary transition-colors"
                data-testid="link-agent-phone"
              >
                <Phone className="w-4 h-4 text-primary" />
                {AGENT_INFO.phone}
              </a>
              <a 
                href={`https://${AGENT_INFO.website}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-primary transition-colors"
                data-testid="link-agent-website"
              >
                <MapPin className="w-4 h-4 text-primary" />
                {AGENT_INFO.website}
              </a>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Listings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold" data-testid="stat-active">{stats.activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recently Sold</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold" data-testid="stat-sold">{stats.soldCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Price</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold" data-testid="stat-avg-price">{formatPrice(stats.avgPrice)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Days on Market</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold" data-testid="stat-avg-dom">{Math.round(stats.avgDom) || 'N/A'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sample Properties</CardTitle>
          <CardDescription>
            Properties that match this update's criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          {properties.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {properties.slice(0, 6).map((property) => (
                <Card key={property.id} className="overflow-hidden" data-testid={`property-card-${property.id}`}>
                  <div className="aspect-video bg-muted relative">
                    {property.photos && property.photos.length > 0 ? (
                      <img 
                        src={property.photos[0]} 
                        alt={property.unparsedAddress || 'Property'} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                        <Home className="w-8 h-8 mb-1" />
                        <span className="text-xs">No photo</span>
                      </div>
                    )}
                    {property.standardStatus && (
                      <Badge 
                        className="absolute top-2 right-2"
                        variant={property.standardStatus === 'Active' ? 'default' : 'secondary'}
                      >
                        {property.standardStatus}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <p className="font-semibold text-lg text-primary">
                      {formatPrice(property.standardStatus === 'Closed' ? property.closePrice : property.listPrice)}
                    </p>
                    <p className="text-sm font-medium line-clamp-1">{property.unparsedAddress || 'Address unavailable'}</p>
                    <p className="text-xs text-muted-foreground">
                      {property.city}, {property.stateOrProvince || 'TX'} {property.postalCode}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {property.bedroomsTotal != null && (
                        <span className="flex items-center gap-1">
                          <Bed className="w-3 h-3" />
                          {property.bedroomsTotal} bd
                        </span>
                      )}
                      {property.bathroomsTotalInteger != null && (
                        <span className="flex items-center gap-1">
                          <Bath className="w-3 h-3" />
                          {property.bathroomsTotalInteger} ba
                        </span>
                      )}
                      {property.livingArea && (
                        <span className="flex items-center gap-1">
                          <Ruler className="w-3 h-3" />
                          {Number(property.livingArea).toLocaleString()} sqft
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Home className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No matching properties found for this area</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Recipient:</span>
            <span className="font-medium">{update.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Zip Code:</span>
            <span className="font-medium">{update.postalCode}</span>
          </div>
          {update.elementarySchool && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">School Zone:</span>
              <span className="font-medium">{update.elementarySchool}</span>
            </div>
          )}
          {update.propertySubType && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Property Type:</span>
              <span className="font-medium">{update.propertySubType}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Frequency:</span>
            <span className="font-medium capitalize">{update.emailFrequency.replace('-', ' ')}</span>
          </div>
          {update.lastSentAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Sent:</span>
              <span className="font-medium">
                {new Date(update.lastSentAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
