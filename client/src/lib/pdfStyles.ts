export const PDF_COLORS = {
  primary: '#EA580C',
  primaryDark: '#C2410C',
  primaryLight: '#FB923C',
  text: '#1F2937',
  textLight: '#6B7280',
  textMuted: '#9CA3AF',
  background: '#FFFFFF',
  backgroundAlt: '#F9FAFB',
  backgroundDark: '#F3F4F6',
  success: '#22C55E',
  danger: '#EF4444',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  
  statusActive: '#22C55E',
  statusUnderContract: '#F97316',
  statusClosed: '#EF4444',
  statusSubject: '#3B82F6',
  statusPending: '#6B7280',
};

export const PDF_FONTS = {
  heading: 'Helvetica-Bold',
  body: 'Helvetica',
  mono: 'Courier',
};

export const PDF_SPACING = {
  page: 40,
  section: 24,
  element: 12,
  small: 8,
};

export const getStatusColor = (status?: string): string => {
  if (!status) return PDF_COLORS.textMuted;
  const normalizedStatus = status.toLowerCase();
  
  if (normalizedStatus.includes('active') && normalizedStatus.includes('under contract')) {
    return PDF_COLORS.statusUnderContract;
  }
  if (normalizedStatus === 'active') {
    return PDF_COLORS.statusActive;
  }
  if (normalizedStatus === 'closed' || normalizedStatus === 'sold') {
    return PDF_COLORS.statusClosed;
  }
  if (normalizedStatus === 'pending') {
    return PDF_COLORS.statusPending;
  }
  return PDF_COLORS.textMuted;
};

export const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export const formatNumber = (value: number): string => {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
};
