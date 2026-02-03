import type { ClassifiedPhoto, PhotoGalleryData } from '@shared/types/photos';
import { ROOM_TYPE_ORDER, CLASSIFICATION_CONFIDENCE_THRESHOLD } from '@shared/types/photos';

interface PhotoInsight {
  url: string;
  thumbnailUrl?: string;
  classification?: string | null;
  confidence?: number | null;
}

interface RepliersPhotoResponse {
  mlsNumber: string;
  photos: PhotoInsight[];
  hasInsights: boolean;
}

export function normalizePhotos(photoResponse: RepliersPhotoResponse): PhotoGalleryData {
  const { photos = [], hasInsights } = photoResponse;

  const allPhotos: ClassifiedPhoto[] = photos.map((photo) => {
    const filename = photo.url.split('/').pop() || photo.url;
    
    return {
      url: photo.url,
      filename,
      roomType: photo.classification || null,
      confidence: photo.confidence || null,
    };
  });

  const roomTypesSet = new Set<string>();
  allPhotos.forEach(photo => {
    if (photo.roomType && photo.confidence && photo.confidence >= CLASSIFICATION_CONFIDENCE_THRESHOLD) {
      roomTypesSet.add(photo.roomType);
    }
  });

  const roomTypes = Array.from(roomTypesSet).sort((a, b) => {
    const indexA = ROOM_TYPE_ORDER.indexOf(a);
    const indexB = ROOM_TYPE_ORDER.indexOf(b);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  return {
    allPhotos,
    roomTypes,
    hasClassifications: hasInsights && allPhotos.some(p => p.roomType !== null),
  };
}

export function getPhotosByRoom(
  photos: ClassifiedPhoto[],
  roomType: string | 'all',
  includeUnclassified = false
): ClassifiedPhoto[] {
  if (roomType === 'all') {
    return photos;
  }

  return photos.filter(photo => {
    if (photo.roomType === roomType && photo.confidence && photo.confidence >= CLASSIFICATION_CONFIDENCE_THRESHOLD) {
      return true;
    }
    if (includeUnclassified && !photo.roomType) {
      return true;
    }
    return false;
  });
}

export function getBestPhotosForCMA(
  photos: ClassifiedPhoto[],
  maxPhotos: number = 6
): ClassifiedPhoto[] {
  const preferredRoomTypes = [
    'Front of Structure',
    'Living Room',
    'Kitchen',
    'Primary Bedroom',
    'Primary Bathroom',
    'Backyard',
    'Pool',
    'Dining Room',
    'Family Room',
  ];

  const selectedPhotos: ClassifiedPhoto[] = [];
  const usedRoomTypes = new Set<string>();

  for (const roomType of preferredRoomTypes) {
    if (selectedPhotos.length >= maxPhotos) break;

    const roomPhotos = photos.filter(p => 
      p.roomType === roomType && 
      p.confidence && 
      p.confidence >= CLASSIFICATION_CONFIDENCE_THRESHOLD
    );

    if (roomPhotos.length > 0) {
      const bestPhoto = roomPhotos.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
      selectedPhotos.push(bestPhoto);
      usedRoomTypes.add(roomType);
    }
  }

  if (selectedPhotos.length < maxPhotos) {
    const remainingPhotos = photos.filter(p => 
      !selectedPhotos.includes(p) &&
      p.confidence && 
      p.confidence >= CLASSIFICATION_CONFIDENCE_THRESHOLD
    ).sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    for (const photo of remainingPhotos) {
      if (selectedPhotos.length >= maxPhotos) break;
      selectedPhotos.push(photo);
    }
  }

  if (selectedPhotos.length < maxPhotos) {
    const unclassifiedPhotos = photos.filter(p => 
      !selectedPhotos.includes(p) && !p.roomType
    );
    for (const photo of unclassifiedPhotos) {
      if (selectedPhotos.length >= maxPhotos) break;
      selectedPhotos.push(photo);
    }
  }

  return selectedPhotos;
}
