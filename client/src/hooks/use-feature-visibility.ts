import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from './use-permissions';
import { apiRequest } from '@/lib/queryClient';

interface FeatureVisibilityItem {
  id: number;
  featureKey: string;
  featureLabel: string;
  route: string;
  section: string;
  isVisible: boolean;
  status: 'live' | 'development' | 'disabled';
  hiddenMessage: string;
  updatedBy: string | null;
  updatedAt: string | null;
  createdAt: string | null;
}

export function useFeatureVisibility() {
  const { user, isDeveloper } = usePermissions();
  const queryClient = useQueryClient();

  const { data: features = [], isLoading } = useQuery<FeatureVisibilityItem[]>({
    queryKey: ['/api/feature-visibility'],
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  });

  const updateFeature = useMutation({
    mutationFn: async (update: { featureKey: string; isVisible: boolean; status: string; hiddenMessage?: string }) => {
      const res = await apiRequest('PUT', `/api/feature-visibility/${update.featureKey}`, update);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/feature-visibility'] }),
  });

  const bulkUpdate = useMutation({
    mutationFn: async (updates: Array<{ featureKey: string; isVisible: boolean; status: string; hiddenMessage?: string }>) => {
      const res = await apiRequest('PUT', '/api/feature-visibility/bulk', { updates });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/feature-visibility'] }),
  });

  const isFeatureVisible = (featureKey: string): boolean => {
    if (isDeveloper) return true;
    const feature = features.find(f => f.featureKey === featureKey);
    return feature?.isVisible ?? true;
  };

  const isRouteAccessible = (route: string): boolean => {
    if (isDeveloper) return true;
    const feature = features.find(f => f.route === route);
    return feature?.isVisible ?? true;
  };

  const getFeaturesBySection = (section: string) => features.filter(f => f.section === section);

  const getFeature = (featureKey: string) => features.find(f => f.featureKey === featureKey);

  return {
    features,
    isLoading,
    isDeveloper,
    isFeatureVisible,
    isRouteAccessible,
    getFeaturesBySection,
    getFeature,
    updateFeature,
    bulkUpdate,
  };
}
