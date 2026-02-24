import { type ReactNode } from 'react';
import { useFeatureVisibility } from '@/hooks/use-feature-visibility';
import { UnderDevelopment } from './UnderDevelopment';
import { Loader2 } from 'lucide-react';

interface FeatureGateProps {
  featureKey: string;
  children: ReactNode;
}

export function FeatureGate({ featureKey, children }: FeatureGateProps) {
  const { features, isLoading, isDeveloper } = useFeatureVisibility();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isDeveloper) return <>{children}</>;

  const feature = features.find(f => f.featureKey === featureKey);

  if (!feature) return <>{children}</>;

  if (!feature.isVisible || feature.status !== 'live') {
    return (
      <UnderDevelopment
        featureName={feature.featureLabel}
        message={feature.hiddenMessage}
      />
    );
  }

  return <>{children}</>;
}
