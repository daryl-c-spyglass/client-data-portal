import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Camera, Grid3X3 } from 'lucide-react';
import type { ClassifiedPhoto } from '@shared/types/photos';
import { ROOM_TYPE_DISPLAY_NAMES } from '@shared/types/photos';
import { getPhotosByRoom } from '@/lib/photoNormalizer';

interface RoomTypeTabsProps {
  photos: ClassifiedPhoto[];
  roomTypes: string[];
  hasClassifications: boolean;
  selectedRoomType: string;
  onRoomTypeChange: (roomType: string) => void;
}

export function RoomTypeTabs({
  photos,
  roomTypes,
  hasClassifications,
  selectedRoomType,
  onRoomTypeChange,
}: RoomTypeTabsProps) {
  if (!hasClassifications || roomTypes.length === 0) {
    return null;
  }

  const getPhotoCount = (roomType: string) => {
    if (roomType === 'all') return photos.length;
    return getPhotosByRoom(photos, roomType).length;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Camera className="h-4 w-4" />
        <span>Browse by Room Type</span>
      </div>
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          <Button
            size="sm"
            variant={selectedRoomType === 'all' ? 'default' : 'outline'}
            onClick={() => onRoomTypeChange('all')}
            className="whitespace-nowrap toggle-elevate"
            data-testid="button-room-all"
          >
            <Grid3X3 className="h-4 w-4 mr-1" />
            All
            <Badge variant="secondary" className="ml-1.5 text-xs">
              {photos.length}
            </Badge>
          </Button>
          {roomTypes.map((roomType) => {
            const displayName = ROOM_TYPE_DISPLAY_NAMES[roomType] || roomType;
            const count = getPhotoCount(roomType);
            return (
              <Button
                key={roomType}
                size="sm"
                variant={selectedRoomType === roomType ? 'default' : 'outline'}
                onClick={() => onRoomTypeChange(roomType)}
                className="whitespace-nowrap toggle-elevate"
                data-testid={`button-room-${roomType.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {displayName}
                <Badge variant="secondary" className="ml-1.5 text-xs">
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
