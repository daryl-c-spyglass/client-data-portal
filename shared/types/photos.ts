export interface ClassifiedPhoto {
  url: string;
  filename: string;
  roomType: string | null;
  confidence: number | null;
  qualityScore?: number | null;
}

export interface PhotoGalleryData {
  allPhotos: ClassifiedPhoto[];
  roomTypes: string[];
  hasClassifications: boolean;
}

export const ROOM_TYPE_ORDER = [
  'Front of Structure',
  'Entrance Foyer',
  'Living Room',
  'Dining Room',
  'Kitchen',
  'Primary Bedroom',
  'Bedroom',
  'Primary Bathroom',
  'Bathroom',
  'Office',
  'Family Room',
  'Laundry',
  'Garage',
  'Backyard',
  'Pool',
  'Other'
];

export const CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.90;

export const ROOM_TYPE_DISPLAY_NAMES: Record<string, string> = {
  'Front of Structure': 'Front',
  'Entrance Foyer': 'Foyer',
  'Living Room': 'Living',
  'Dining Room': 'Dining',
  'Kitchen': 'Kitchen',
  'Primary Bedroom': 'Primary Bed',
  'Bedroom': 'Bedroom',
  'Primary Bathroom': 'Primary Bath',
  'Bathroom': 'Bathroom',
  'Office': 'Office',
  'Family Room': 'Family',
  'Laundry': 'Laundry',
  'Garage': 'Garage',
  'Backyard': 'Backyard',
  'Pool': 'Pool',
  'Other': 'Other'
};
