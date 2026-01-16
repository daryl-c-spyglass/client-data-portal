import { STATUS_COLORS, StatusKey } from '@/lib/statusColors';

interface MapLegendProps {
  statuses?: StatusKey[];
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

const DEFAULT_STATUSES: StatusKey[] = ['subject', 'active', 'underContract', 'closed', 'pending'];

export function MapLegend({ 
  statuses = DEFAULT_STATUSES,
  orientation = 'vertical',
  className = ''
}: MapLegendProps) {
  return (
    <div 
      className={`bg-background/95 backdrop-blur-sm rounded-lg shadow-md p-3 text-sm border ${orientation === 'horizontal' ? 'flex flex-wrap gap-4' : 'space-y-2'} ${className}`}
      data-testid="map-legend"
    >
      {orientation === 'vertical' && (
        <div className="font-medium text-foreground mb-2">Legend</div>
      )}
      
      {statuses.map((statusKey) => {
        const status = STATUS_COLORS[statusKey];
        return (
          <div key={statusKey} className="flex items-center gap-2">
            <span 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: status.hex }}
            />
            <span className="text-muted-foreground">
              {status.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
