import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";
import { PDF_COLORS, getStatusColor, formatCurrency, formatNumber } from "@/lib/pdfStyles";

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hjp-Ek-_EeA.woff", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hjp-Ek-_EeA.woff", fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Inter",
    fontSize: 10,
    color: PDF_COLORS.text,
    backgroundColor: PDF_COLORS.background,
  },
  coverPage: {
    padding: 60,
    fontFamily: "Inter",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    backgroundColor: PDF_COLORS.background,
  },
  coverLogo: {
    width: 200,
    height: 70,
    objectFit: "contain",
    marginBottom: 40,
  },
  coverCompanyName: {
    fontSize: 14,
    fontWeight: 600,
    color: PDF_COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: PDF_COLORS.text,
    marginBottom: 8,
    textAlign: "center",
  },
  coverSubtitle: {
    fontSize: 14,
    color: PDF_COLORS.textLight,
    marginBottom: 40,
    textAlign: "center",
  },
  coverAddress: {
    fontSize: 20,
    fontWeight: 600,
    color: PDF_COLORS.text,
    marginBottom: 6,
    textAlign: "center",
  },
  coverDetails: {
    fontSize: 14,
    color: PDF_COLORS.textLight,
    textAlign: "center",
    marginBottom: 40,
  },
  coverDate: {
    fontSize: 11,
    color: PDF_COLORS.textMuted,
    marginBottom: 40,
  },
  coverAgent: {
    alignItems: "center",
    marginTop: 20,
  },
  coverAgentPhoto: {
    width: 70,
    height: 70,
    borderRadius: 35,
    objectFit: "cover",
    marginBottom: 12,
  },
  coverAgentName: {
    fontSize: 16,
    fontWeight: 600,
    color: PDF_COLORS.text,
    marginBottom: 4,
  },
  coverAgentTitle: {
    fontSize: 11,
    color: PDF_COLORS.textLight,
    marginBottom: 4,
  },
  coverAgentCompany: {
    fontSize: 12,
    color: PDF_COLORS.textLight,
    marginTop: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: PDF_COLORS.text,
  },
  headerDate: {
    fontSize: 10,
    color: PDF_COLORS.textMuted,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  sectionAccentBar: {
    width: 4,
    height: 24,
    backgroundColor: PDF_COLORS.primary,
    marginRight: 12,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: PDF_COLORS.text,
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: PDF_COLORS.textLight,
    marginTop: 16,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.7,
    color: PDF_COLORS.textLight,
    marginBottom: 8,
  },
  table: {
    marginTop: 12,
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: PDF_COLORS.backgroundAlt,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: PDF_COLORS.primary,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 600,
    color: PDF_COLORS.text,
    flex: 1,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
  },
  tableRowAlt: {
    backgroundColor: PDF_COLORS.backgroundAlt,
  },
  tableRowHighlight: {
    backgroundColor: "#EFF6FF",
    borderLeftWidth: 3,
    borderLeftColor: PDF_COLORS.statusSubject,
  },
  tableCell: {
    fontSize: 9,
    color: PDF_COLORS.text,
    flex: 1,
  },
  tableCellBold: {
    fontSize: 9,
    fontWeight: 600,
    color: PDF_COLORS.text,
  },
  tableCellMuted: {
    fontSize: 8,
    color: PDF_COLORS.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    fontSize: 7,
    fontWeight: 600,
    color: PDF_COLORS.background,
    textTransform: "uppercase",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
  },
  statCard: {
    width: "48%",
    padding: 16,
    backgroundColor: PDF_COLORS.backgroundAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PDF_COLORS.borderLight,
  },
  statCardHighlight: {
    borderColor: PDF_COLORS.primary,
    borderWidth: 2,
  },
  statLabel: {
    fontSize: 9,
    color: PDF_COLORS.textLight,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 18,
    fontWeight: 700,
    color: PDF_COLORS.text,
  },
  statValuePrimary: {
    fontSize: 18,
    fontWeight: 700,
    color: PDF_COLORS.primary,
  },
  statSubValue: {
    fontSize: 8,
    color: PDF_COLORS.textMuted,
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    backgroundColor: PDF_COLORS.backgroundAlt,
    borderRadius: 8,
    alignItems: "center",
  },
  propertyCard: {
    marginBottom: 16,
    padding: 14,
    backgroundColor: PDF_COLORS.backgroundAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PDF_COLORS.borderLight,
  },
  propertyAddress: {
    fontSize: 12,
    fontWeight: 600,
    color: PDF_COLORS.text,
    marginBottom: 8,
  },
  propertyDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  propertyDetail: {
    fontSize: 9,
    color: PDF_COLORS.textLight,
    backgroundColor: PDF_COLORS.backgroundDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  propertyPrice: {
    fontSize: 14,
    fontWeight: 700,
    color: PDF_COLORS.primary,
    marginTop: 10,
  },
  footer: {
    position: "absolute",
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
  },
  footerLogo: {
    width: 100,
    height: 30,
    objectFit: "contain",
  },
  footerText: {
    fontSize: 8,
    color: PDF_COLORS.textMuted,
  },
  coverLetter: {
    lineHeight: 1.8,
    fontSize: 11,
    color: PDF_COLORS.text,
  },
  agentContact: {
    marginTop: 24,
    padding: 20,
    backgroundColor: PDF_COLORS.backgroundAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PDF_COLORS.borderLight,
  },
  agentRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  agentPhoto: {
    width: 70,
    height: 70,
    borderRadius: 35,
    objectFit: "cover",
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 16,
    fontWeight: 700,
    color: PDF_COLORS.text,
    marginBottom: 4,
  },
  agentDetail: {
    fontSize: 10,
    color: PDF_COLORS.textLight,
    marginBottom: 3,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  chartLabel: {
    width: 100,
    fontSize: 8,
    color: PDF_COLORS.textLight,
  },
  chartBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  priceBar: {
    height: 18,
    backgroundColor: PDF_COLORS.primary,
    borderRadius: 3,
    marginVertical: 2,
  },
  priceBarSubject: {
    backgroundColor: PDF_COLORS.statusSubject,
  },
  priceBarValue: {
    fontSize: 9,
    fontWeight: 600,
    color: PDF_COLORS.text,
    marginLeft: 8,
  },
  adjustmentPositive: {
    color: PDF_COLORS.success,
    fontWeight: 600,
  },
  adjustmentNegative: {
    color: PDF_COLORS.danger,
    fontWeight: 600,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  photoContainer: {
    width: "31%",
    aspectRatio: 1.3,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: PDF_COLORS.backgroundDark,
  },
  photo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  morePhotosText: {
    textAlign: "center",
    fontSize: 10,
    color: PDF_COLORS.textMuted,
    marginTop: 12,
  },
});

interface PropertyData {
  id?: string;
  listingId?: string;
  mlsNumber?: string;
  streetAddress?: string;
  address?: string;
  unparsedAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  listPrice?: number | string;
  closePrice?: number | string;
  livingArea?: number | string;
  bedroomsTotal?: number | string;
  bathroomsTotal?: number | string;
  baths?: number | string;
  bathrooms?: number | string;
  bathroomsFull?: number | string;
  bathroomsHalf?: number | string;
  yearBuilt?: number | string;
  status?: string;
  standardStatus?: string;
  lastStatus?: string;
  daysOnMarket?: number | string;
  photos?: string[];
  images?: string[];
}

interface CmaBrochure {
  type: "pdf" | "image";
  url: string;
  filename: string;
  generated: boolean;
  uploadedAt: string;
}

interface CMAPdfDocumentProps {
  cma: {
    id: string;
    name: string;
    subjectPropertyId?: string | null;
    propertiesData?: PropertyData[];
    createdAt?: Date | string;
  };
  agentProfile?: {
    bio?: string | null;
    title?: string | null;
    defaultCoverLetter?: string | null;
    headshotUrl?: string | null;
  } | null;
  companySettings?: {
    companyName?: string | null;
    logoUrl?: string | null;
    primaryColor?: string | null;
  } | null;
  currentUser?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
    phone?: string | null;
  } | null;
  includedSections: string[];
  coverLetterOverride?: string;
  includeAgentFooter: boolean;
  brochure?: CmaBrochure | null;
  customPhotoSelections?: Record<string, string[]>;
}

const getBathCount = (property: PropertyData): number => {
  const baths = Number(property.bathroomsTotal) ||
    Number(property.baths) ||
    Number(property.bathrooms) ||
    0;
  
  if (baths > 0) return baths;
  
  const full = Number(property.bathroomsFull) || 0;
  const half = Number(property.bathroomsHalf) || 0;
  return full + (half * 0.5);
};

const getAbsolutePhotoUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://cdn.repliers.io${url}`;
};

const calculateStatistics = (properties: PropertyData[]) => {
  if (!properties || properties.length === 0) {
    return {
      avgPrice: 0,
      medianPrice: 0,
      avgPricePerSqft: 0,
      medianPricePerSqft: 0,
      avgLivingArea: 0,
      avgBedrooms: 0,
      avgBathrooms: 0,
      propertyCount: 0,
      priceRange: { min: 0, max: 0 },
      sqftRange: { min: 0, max: 0 },
    };
  }

  const prices = properties
    .map(p => Number(p.listPrice || p.closePrice))
    .filter(p => p > 0);
  const pricesPerSqft = properties
    .filter(p => Number(p.listPrice || p.closePrice) > 0 && Number(p.livingArea) > 0)
    .map(p => Number(p.listPrice || p.closePrice) / Number(p.livingArea));
  const livingAreas = properties
    .map(p => Number(p.livingArea))
    .filter(a => a > 0);
  const bedrooms = properties
    .map(p => Number(p.bedroomsTotal))
    .filter(b => b > 0);
  const bathrooms = properties
    .map(p => getBathCount(p))
    .filter(b => b > 0);

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const median = (arr: number[]) => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  return {
    avgPrice: avg(prices),
    medianPrice: median(prices),
    avgPricePerSqft: avg(pricesPerSqft),
    medianPricePerSqft: median(pricesPerSqft),
    avgLivingArea: avg(livingAreas),
    avgBedrooms: avg(bedrooms),
    avgBathrooms: avg(bathrooms),
    propertyCount: properties.length,
    priceRange: { 
      min: prices.length > 0 ? Math.min(...prices) : 0, 
      max: prices.length > 0 ? Math.max(...prices) : 0 
    },
    sqftRange: { 
      min: livingAreas.length > 0 ? Math.min(...livingAreas) : 0, 
      max: livingAreas.length > 0 ? Math.max(...livingAreas) : 0 
    },
  };
};

const SectionHeaderComponent = ({ title }: { title: string }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionAccentBar} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const StatusBadge = ({ status, isSubject }: { status?: string; isSubject?: boolean }) => {
  const displayStatus = isSubject ? 'Subject' : (status || 'Unknown');
  const color = isSubject ? PDF_COLORS.statusSubject : getStatusColor(status);
  return (
    <View style={[styles.statusBadge, { backgroundColor: color }]}>
      <Text style={styles.statusBadgeText}>{displayStatus}</Text>
    </View>
  );
};

const isPropertySubject = (property: PropertyData, subjectId?: string | null): boolean => {
  if (!subjectId) return false;
  return property.id === subjectId || 
         property.listingId === subjectId || 
         property.mlsNumber === subjectId;
};

const PageFooter = ({ 
  companyName, 
  agentName, 
  logoUrl 
}: { 
  companyName: string; 
  agentName: string;
  logoUrl?: string | null;
}) => (
  <View style={styles.footer} fixed>
    {logoUrl ? (
      <Image src={logoUrl} style={styles.footerLogo} />
    ) : (
      <Text style={styles.footerText}>{companyName}</Text>
    )}
    <Text style={styles.footerText}>Prepared by {agentName}</Text>
  </View>
);

export function CMAPdfDocument({
  cma,
  agentProfile,
  companySettings,
  currentUser,
  includedSections,
  coverLetterOverride,
  includeAgentFooter,
  brochure,
  customPhotoSelections,
}: CMAPdfDocumentProps) {
  const properties = (cma.propertiesData || []) as PropertyData[];
  const statistics = calculateStatistics(properties);
  const subjectId = cma.subjectPropertyId;
  
  const subjectProperty = subjectId 
    ? properties.find(p => isPropertySubject(p, subjectId))
    : properties[0];

  const agentName = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser?.email?.split("@")[0] || "Agent";

  const coverLetter = coverLetterOverride || agentProfile?.defaultCoverLetter || "";
  const companyName = companySettings?.companyName || "Spyglass Realty";
  const logoUrl = companySettings?.logoUrl || "/logos/spyglass-logo-black.png";
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const getPropertyAddress = (p: PropertyData) => 
    p.streetAddress || p.unparsedAddress || p.address || "Property";

  const pricePerSqftData = properties
    .filter(p => Number(p.listPrice || p.closePrice) > 0 && Number(p.livingArea) > 0)
    .map(p => {
      const price = Number(p.listPrice || p.closePrice);
      const sqft = Number(p.livingArea);
      const pricePerSqft = price / sqft;
      const address = getPropertyAddress(p);
      const shortAddress = address.length > 20 ? address.substring(0, 17) + "..." : address;
      const isSubject = isPropertySubject(p, subjectId);
      return { name: shortAddress, pricePerSqft: Math.round(pricePerSqft), isSubject };
    })
    .sort((a, b) => a.pricePerSqft - b.pricePerSqft);

  const maxPricePerSqft = Math.max(...pricePerSqftData.map(d => d.pricePerSqft), 1);

  return (
    <Document>
      {includedSections.includes("cover_page") && (
        <Page size="LETTER" style={styles.coverPage}>
          <Image src={logoUrl} style={styles.coverLogo} />
          
          <View style={{ alignItems: "center", marginBottom: 40 }}>
            <Text style={styles.coverCompanyName}>{companyName}</Text>
            <Text style={styles.coverTitle}>Comparative Market Analysis</Text>
            <Text style={styles.coverSubtitle}>Prepared exclusively for you</Text>
          </View>
          
          {subjectProperty && (
            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <Text style={styles.coverAddress}>
                {getPropertyAddress(subjectProperty)}
              </Text>
              <Text style={styles.coverDetails}>
                {subjectProperty.city}, {subjectProperty.state} {subjectProperty.postalCode}
              </Text>
            </View>
          )}

          <Text style={styles.coverDate}>{currentDate}</Text>

          <View style={styles.coverAgent}>
            {agentProfile?.headshotUrl && (
              <Image src={agentProfile.headshotUrl} style={styles.coverAgentPhoto} />
            )}
            <Text style={styles.coverAgentName}>{agentName}</Text>
            {agentProfile?.title && (
              <Text style={styles.coverAgentTitle}>{agentProfile.title}</Text>
            )}
            <Text style={styles.coverAgentCompany}>{companyName}</Text>
          </View>
        </Page>
      )}

      {includedSections.includes("listing_brochure") && brochure && brochure.type === "image" && brochure.url && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Property Brochure</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
            <Image 
              src={brochure.url}
              style={{ maxWidth: "100%", maxHeight: "90%", objectFit: "contain" }}
            />
          </View>
          {includeAgentFooter && (
            <PageFooter companyName={companyName} agentName={agentName} logoUrl={logoUrl} />
          )}
        </Page>
      )}

      {includedSections.includes("cover_letter") && coverLetter && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Personal Letter</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>

          <SectionHeaderComponent title="Dear Homeowner," />
          <Text style={styles.coverLetter}>{coverLetter}</Text>

          <View style={styles.agentContact}>
            <View style={styles.agentRow}>
              {agentProfile?.headshotUrl && (
                <Image src={agentProfile.headshotUrl} style={styles.agentPhoto} />
              )}
              <View style={styles.agentInfo}>
                <Text style={styles.agentName}>{agentName}</Text>
                {agentProfile?.title && (
                  <Text style={styles.agentDetail}>{agentProfile.title}</Text>
                )}
                <Text style={styles.agentDetail}>{companyName}</Text>
                {currentUser?.email && (
                  <Text style={styles.agentDetail}>{currentUser.email}</Text>
                )}
                {currentUser?.phone && (
                  <Text style={styles.agentDetail}>{currentUser.phone}</Text>
                )}
              </View>
            </View>
          </View>

          {includeAgentFooter && (
            <PageFooter companyName={companyName} agentName={agentName} logoUrl={logoUrl} />
          )}
        </Page>
      )}

      {includedSections.includes("contact_me") && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Contact Information</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>

          <SectionHeaderComponent title="Your Real Estate Professional" />

          <View style={styles.agentContact}>
            <View style={styles.agentRow}>
              {agentProfile?.headshotUrl && (
                <Image src={agentProfile.headshotUrl} style={styles.agentPhoto} />
              )}
              <View style={styles.agentInfo}>
                <Text style={styles.agentName}>{agentName}</Text>
                {agentProfile?.title && (
                  <Text style={styles.agentDetail}>{agentProfile.title}</Text>
                )}
                <Text style={{ ...styles.agentDetail, marginTop: 8 }}>{companyName}</Text>
                {currentUser?.email && (
                  <Text style={styles.agentDetail}>Email: {currentUser.email}</Text>
                )}
                {currentUser?.phone && (
                  <Text style={styles.agentDetail}>Phone: {currentUser.phone}</Text>
                )}
              </View>
            </View>

            {agentProfile?.bio && (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.subsectionTitle}>About Me</Text>
                <Text style={styles.paragraph}>{agentProfile.bio}</Text>
              </View>
            )}
          </View>

          {includeAgentFooter && (
            <PageFooter companyName={companyName} agentName={agentName} logoUrl={logoUrl} />
          )}
        </Page>
      )}

      {includedSections.includes("summary_comparables") && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Summary of Comparable Properties</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>

          <SectionHeaderComponent title="Market Overview" />

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.statValuePrimary}>{formatCurrency(statistics.avgPrice)}</Text>
              <Text style={styles.statLabel}>Avg Price</Text>
              <Text style={styles.statSubValue}>Median: {formatCurrency(statistics.medianPrice)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.statValuePrimary}>${formatNumber(statistics.avgPricePerSqft)}</Text>
              <Text style={styles.statLabel}>Avg $/SqFt</Text>
              <Text style={styles.statSubValue}>Median: ${formatNumber(statistics.medianPricePerSqft)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.statValuePrimary}>{statistics.propertyCount}</Text>
              <Text style={styles.statLabel}>Properties</Text>
              <Text style={styles.statSubValue}>Analyzed</Text>
            </View>
          </View>

          <View style={{ marginTop: 16, padding: 12, backgroundColor: PDF_COLORS.backgroundAlt, borderRadius: 6 }}>
            <Text style={{ fontSize: 10, color: PDF_COLORS.textLight, textAlign: "center" }}>
              Price range: {formatCurrency(statistics.priceRange.min)} - {formatCurrency(statistics.priceRange.max)}
            </Text>
          </View>

          <View style={{ marginTop: 24 }}>
            <Text style={styles.subsectionTitle}>Additional Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Avg Living Area</Text>
                <Text style={styles.statValue}>{formatNumber(statistics.avgLivingArea)} sqft</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Avg Bed/Bath</Text>
                <Text style={styles.statValue}>
                  {statistics.avgBedrooms.toFixed(1)} / {statistics.avgBathrooms.toFixed(1)}
                </Text>
              </View>
            </View>
          </View>

          {includeAgentFooter && (
            <PageFooter companyName={companyName} agentName={agentName} logoUrl={logoUrl} />
          )}
        </Page>
      )}

      {includedSections.includes("property_details") && properties.length > 0 && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Property Details</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>

          <SectionHeaderComponent title="Comparable Properties" />

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Address</Text>
              <Text style={styles.tableHeaderCell}>Price</Text>
              <Text style={styles.tableHeaderCell}>SqFt</Text>
              <Text style={styles.tableHeaderCell}>$/SqFt</Text>
              <Text style={styles.tableHeaderCell}>Bed/Bath</Text>
              <Text style={{ ...styles.tableHeaderCell, flex: 1.2 }}>Status</Text>
            </View>
            {properties.slice(0, 15).map((property, index) => {
              const isSubject = isPropertySubject(property, subjectId);
              const price = Number(property.listPrice || property.closePrice) || 0;
              const sqft = Number(property.livingArea) || 0;
              const pricePerSqft = sqft > 0 ? price / sqft : 0;
              const beds = Number(property.bedroomsTotal) || 0;
              const baths = getBathCount(property);
              const status = property.standardStatus || property.status || property.lastStatus;

              return (
                <View 
                  key={index} 
                  style={[
                    styles.tableRow,
                    ...(index % 2 === 1 ? [styles.tableRowAlt] : []),
                    ...(isSubject ? [styles.tableRowHighlight] : [])
                  ]}
                >
                  <View style={{ flex: 2 }}>
                    <Text style={styles.tableCellBold}>
                      {isSubject ? "★ " : ""}{getPropertyAddress(property)}
                    </Text>
                    <Text style={styles.tableCellMuted}>{property.city || ''}</Text>
                  </View>
                  <Text style={styles.tableCell}>{formatCurrency(price)}</Text>
                  <Text style={styles.tableCell}>{formatNumber(sqft)}</Text>
                  <Text style={styles.tableCell}>${formatNumber(pricePerSqft)}</Text>
                  <Text style={styles.tableCell}>
                    {beds > 0 ? beds : "-"}/{baths > 0 ? baths : "-"}
                  </Text>
                  <View style={{ flex: 1.2 }}>
                    <StatusBadge status={status} isSubject={isSubject} />
                  </View>
                </View>
              );
            })}
          </View>

          {properties.length > 15 && (
            <Text style={{ ...styles.paragraph, fontStyle: "italic", textAlign: "center" }}>
              Showing 15 of {properties.length} properties. Full list available upon request.
            </Text>
          )}

          {includeAgentFooter && (
            <PageFooter companyName={companyName} agentName={agentName} logoUrl={logoUrl} />
          )}
        </Page>
      )}

      {includedSections.includes("price_per_sqft") && pricePerSqftData.length > 0 && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Price Per Square Foot Analysis</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>

          <SectionHeaderComponent title="Price Per Sq. Ft. Comparison" />
          <Text style={styles.paragraph}>
            This chart compares the price per square foot across all comparable properties.
            {subjectId && " Your property is highlighted in blue."}
          </Text>

          <View style={{ marginTop: 20 }}>
            {pricePerSqftData.slice(0, 12).map((item, index) => (
              <View key={index} style={styles.chartRow}>
                <Text style={styles.chartLabel}>{item.name}</Text>
                <View style={styles.chartBarContainer}>
                  <View
                    style={[
                      styles.priceBar, 
                      ...(item.isSubject ? [styles.priceBarSubject] : []),
                      { width: `${(item.pricePerSqft / maxPricePerSqft) * 65}%` }
                    ]}
                  />
                  <Text style={styles.priceBarValue}>${item.pricePerSqft}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 24 }}>
            <Text style={styles.subsectionTitle}>Key Insights</Text>
            <Text style={styles.paragraph}>
              • Average price per sq. ft.: ${formatNumber(statistics.avgPricePerSqft)}
            </Text>
            <Text style={styles.paragraph}>
              • Median price per sq. ft.: ${formatNumber(statistics.medianPricePerSqft)}
            </Text>
            <Text style={styles.paragraph}>
              • Total properties analyzed: {statistics.propertyCount}
            </Text>
          </View>

          {includeAgentFooter && (
            <PageFooter companyName={companyName} agentName={agentName} logoUrl={logoUrl} />
          )}
        </Page>
      )}

      {includedSections.includes("comparable_stats") && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Detailed Statistics</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>

          <SectionHeaderComponent title="Comparable Property Statistics" />

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardHighlight]}>
              <Text style={styles.statLabel}>Average Price</Text>
              <Text style={styles.statValuePrimary}>{formatCurrency(statistics.avgPrice)}</Text>
              <Text style={styles.statSubValue}>Median: {formatCurrency(statistics.medianPrice)}</Text>
            </View>
            <View style={[styles.statCard, styles.statCardHighlight]}>
              <Text style={styles.statLabel}>Average $/SqFt</Text>
              <Text style={styles.statValuePrimary}>${formatNumber(statistics.avgPricePerSqft)}</Text>
              <Text style={styles.statSubValue}>Median: ${formatNumber(statistics.medianPricePerSqft)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average Living Area</Text>
              <Text style={styles.statValue}>{formatNumber(statistics.avgLivingArea)} sqft</Text>
              <Text style={styles.statSubValue}>
                Range: {formatNumber(statistics.sqftRange.min)} - {formatNumber(statistics.sqftRange.max)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average Bed/Bath</Text>
              <Text style={styles.statValue}>
                {statistics.avgBedrooms.toFixed(1)} / {statistics.avgBathrooms.toFixed(1)}
              </Text>
              <Text style={styles.statSubValue}>{statistics.propertyCount} properties analyzed</Text>
            </View>
          </View>

          <View style={{ marginTop: 30 }}>
            <Text style={styles.subsectionTitle}>Market Analysis Summary</Text>
            <Text style={styles.paragraph}>
              Based on the analysis of {statistics.propertyCount} comparable properties in the area,
              the market shows an average listing price of {formatCurrency(statistics.avgPrice)} with
              properties averaging {formatNumber(statistics.avgLivingArea)} square feet.
            </Text>
            <Text style={styles.paragraph}>
              The price per square foot ranges from ${formatNumber(Math.max(0, statistics.avgPricePerSqft - 50))} to
              ${formatNumber(statistics.avgPricePerSqft + 50)}, with the market median at
              ${formatNumber(statistics.medianPricePerSqft)} per square foot.
            </Text>
          </View>

          {includeAgentFooter && (
            <PageFooter companyName={companyName} agentName={agentName} logoUrl={logoUrl} />
          )}
        </Page>
      )}

      {includedSections.includes("property_photos") && properties.length > 0 && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Property Photos</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>

          <SectionHeaderComponent title="Comparable Property Photos" />

          {properties.slice(0, 6).map((property, propIndex) => {
            const propertyId = property.listingId || property.id || `prop-${propIndex}`;
            const selectedPhotos = customPhotoSelections?.[propertyId] || property.photos || property.images || [];
            const photosToShow = selectedPhotos
              .slice(0, 3)
              .map(url => getAbsolutePhotoUrl(url))
              .filter(url => url.length > 0);
            
            if (photosToShow.length === 0) return null;

            return (
              <View key={propIndex} style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 10, fontWeight: 600, color: PDF_COLORS.text, marginBottom: 6 }}>
                  {getPropertyAddress(property)}
                </Text>
                <View style={styles.photoGrid}>
                  {photosToShow.map((photoUrl, photoIndex) => (
                    <View key={photoIndex} style={styles.photoContainer}>
                      <Image src={photoUrl} style={styles.photo} />
                    </View>
                  ))}
                </View>
              </View>
            );
          })}

          {properties.length > 6 && (
            <Text style={styles.morePhotosText}>
              +{properties.length - 6} more properties in full report
            </Text>
          )}

          {includeAgentFooter && (
            <PageFooter companyName={companyName} agentName={agentName} logoUrl={logoUrl} />
          )}
        </Page>
      )}
    </Document>
  );
}

export default CMAPdfDocument;
