import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { cn } from '@/lib/utils';
import { formatPrice, normalizeStatus } from '@/lib/cma-data-utils';
import type { Property } from '@shared/schema';

interface PropertyDetailModalProps {
  property: Property | null;
  subjectProperty?: Property | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PropertyDetailModal({ 
  property, 
  subjectProperty,
  isOpen, 
  onClose 
}: PropertyDetailModalProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [property?.id]);

  if (!property) return null;

  const photos = getPropertyPhotos(property);
  const status = normalizeStatus(property.standardStatus || 'Active');
  const price = getPropertyPrice(property);
  const sqft = property.livingArea ? Number(property.livingArea) : 0;
  const pricePerSqft = sqft ? Math.round(price / sqft) : null;
  const distance = calculateDistance(property, subjectProperty);

  const getStatusStyle = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case 'ACTIVE': return 'bg-green-500 text-white';
      case 'UNDER_CONTRACT': 
      case 'ACTIVE UNDER CONTRACT': return 'bg-orange-500 text-white';
      case 'PENDING': return 'bg-gray-500 text-white';
      case 'SOLD': 
      case 'CLOSED': return 'bg-red-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  const getStatusLabel = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case 'ACTIVE': return 'Active';
      case 'UNDER_CONTRACT': 
      case 'ACTIVE UNDER CONTRACT': return 'Active Under Contract';
      case 'PENDING': return 'Pending';
      case 'SOLD': 
      case 'CLOSED': return 'Closed';
      default: return status;
    }
  };

  const nextPhoto = () => setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  const prevPhoto = () => setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);

  const address = property.unparsedAddress || `${property.streetNumber || ''} ${property.streetName || ''}`.trim() || 'Unknown Address';
  const addressParts = address.split(',');
  const streetAddress = addressParts[0];
  const cityStateZip = addressParts.slice(1, 3).join(',').trim();
  const mlsNumber = (property as any).listingId || (property as any).mlsNumber || (property as any).mlsId || property.id;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-xl gap-0" data-testid="modal-property-detail" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Property Details</DialogTitle>
        </VisuallyHidden>
        <div className="p-4 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold leading-tight" data-testid="text-property-address">
                {streetAddress}
                {cityStateZip && (
                  <span className="text-muted-foreground font-normal">
                    , {cityStateZip}
                  </span>
                )}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-mls-number">
                MLS# {mlsNumber}
              </p>
            </div>
            
            {distance && (
              <Badge variant="outline" className="flex-shrink-0 text-xs whitespace-nowrap" data-testid="badge-distance">
                {distance} mi away
              </Badge>
            )}
          </div>
        </div>

        {/* Image Carousel - matching CMAReport pattern exactly */}
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {photos.length > 0 ? (
            <>
              <img 
                src={photos[currentPhotoIndex]} 
                alt={`Photo ${currentPhotoIndex + 1}`}
                className="w-full h-full object-cover"
                data-testid="img-property-photo"
              />
              {/* Carousel Controls - Click zones for navigation (full height, invisible background) */}
              {photos.length > 1 && (
                <>
                  {/* Left click zone - covers left half */}
                  <div 
                    className="absolute left-0 top-0 w-1/2 h-full cursor-pointer z-10 group"
                    onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                    data-testid="zone-photo-prev"
                  >
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all opacity-70 group-hover:opacity-100">
                      <ChevronLeft className="w-5 h-5" />
                    </div>
                  </div>
                  {/* Right click zone - covers right half */}
                  <div 
                    className="absolute right-0 top-0 w-1/2 h-full cursor-pointer z-10 group"
                    onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                    data-testid="zone-photo-next"
                  >
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all opacity-70 group-hover:opacity-100">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </>
              )}
              {/* Photo Count - centered at bottom */}
              {photos.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                  {currentPhotoIndex + 1} / {photos.length}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Home className="w-16 h-16 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Thumbnail Strip */}
        {photos.length > 1 && (
          <div className="flex gap-1 p-2 overflow-x-auto bg-muted/30">
            {photos.slice(0, 12).map((photo: string, idx: number) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentPhotoIndex(idx)}
                className={cn(
                  "flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-all",
                  currentPhotoIndex === idx 
                    ? "border-primary opacity-100" 
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
                data-testid={`button-thumbnail-${idx}`}
              >
                <img src={photo} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Price</p>
              <p className="text-xl font-bold" data-testid="text-price">{formatPrice(price)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Price/SqFt</p>
              <p className="text-xl font-bold" data-testid="text-price-sqft">{pricePerSqft ? `$${pricePerSqft}` : 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Bedrooms</p>
              <p className="text-lg font-semibold" data-testid="text-bedrooms">{property.bedroomsTotal || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bathrooms</p>
              <p className="text-lg font-semibold" data-testid="text-bathrooms">{property.bathroomsTotalInteger || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Square Feet</p>
              <p className="text-lg font-semibold" data-testid="text-sqft">{sqft ? sqft.toLocaleString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Days on Market</p>
              <p className="text-lg font-semibold" data-testid="text-dom">{getDaysOnMarket(property) ?? 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Badge className={getStatusStyle(status)} data-testid="badge-status">{getStatusLabel(status)}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">List Date</p>
              <p className="text-sm font-medium" data-testid="text-list-date">
                {(property as any).listDate 
                  ? new Date((property as any).listDate).toLocaleDateString('en-US', { 
                      month: 'short', day: 'numeric', year: 'numeric' 
                    })
                  : 'N/A'
                }
              </p>
            </div>
          </div>

          {status.toUpperCase() === 'CLOSED' && ((property as any).closeDate || property.closePrice) && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              {(property as any).closeDate && (
                <div>
                  <p className="text-xs text-muted-foreground">Sold Date</p>
                  <p className="text-sm font-medium" data-testid="text-sold-date">
                    {new Date((property as any).closeDate).toLocaleDateString('en-US', { 
                      month: 'short', day: 'numeric', year: 'numeric' 
                    })}
                  </p>
                </div>
              )}
              {property.closePrice && (
                <div>
                  <p className="text-xs text-muted-foreground">Sold Price</p>
                  <p className="text-sm font-medium" data-testid="text-sold-price">{formatPrice(Number(property.closePrice))}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getPropertyPhotos(property: Property): string[] {
  const photos = (property as any).photos as string[] | undefined;
  const media = (property as any).media as any[] | undefined;
  if (photos && photos.length > 0) return photos;
  if (media && media.length > 0) {
    return media.map((m: any) => m.mediaURL || m.mediaUrl).filter(Boolean);
  }
  return [];
}

function getPropertyPrice(property: Property): number {
  const isClosed = property.standardStatus === 'Closed';
  return isClosed 
    ? (property.closePrice ? Number(property.closePrice) : Number(property.listPrice || 0))
    : Number(property.listPrice || 0);
}

function getDaysOnMarket(property: Property): number | null {
  return (property as any).daysOnMarket || (property as any).cumulativeDaysOnMarket || property.daysOnMarket || null;
}

function calculateDistance(property: Property, subjectProperty?: Property | null): string | null {
  if (!property || !subjectProperty) return null;
  
  const getCoords = (p: any) => {
    if (p.map?.latitude && p.map?.longitude) return { lat: p.map.latitude, lng: p.map.longitude };
    if (p.latitude && p.longitude) return { lat: p.latitude, lng: p.longitude };
    if (p.coordinates?.latitude && p.coordinates?.longitude) return { lat: p.coordinates.latitude, lng: p.coordinates.longitude };
    if (p.geo?.lat && p.geo?.lng) return { lat: p.geo.lat, lng: p.geo.lng };
    return null;
  };

  const propCoords = getCoords(property);
  const subjectCoords = getCoords(subjectProperty);
  if (!propCoords || !subjectCoords) return null;

  const R = 3959;
  const dLat = (propCoords.lat - subjectCoords.lat) * Math.PI / 180;
  const dLon = (propCoords.lng - subjectCoords.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(subjectCoords.lat * Math.PI / 180) * Math.cos(propCoords.lat * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1);
}

export default PropertyDetailModal;
