import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";

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
    color: "#1f2937",
  },
  coverPage: {
    padding: 40,
    fontFamily: "Inter",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    backgroundColor: "#f8fafc",
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 16,
    textAlign: "center",
  },
  coverSubtitle: {
    fontSize: 18,
    color: "#475569",
    marginBottom: 40,
    textAlign: "center",
  },
  coverAddress: {
    fontSize: 24,
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  coverDetails: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 60,
  },
  coverAgent: {
    marginTop: 40,
    textAlign: "center",
  },
  coverAgentName: {
    fontSize: 16,
    fontWeight: 600,
    color: "#0f172a",
  },
  coverAgentTitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  coverCompany: {
    fontSize: 14,
    color: "#475569",
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0f172a",
  },
  headerDate: {
    fontSize: 9,
    color: "#64748b",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: "#3b82f6",
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "#334155",
    marginTop: 12,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.6,
    color: "#374151",
    marginBottom: 8,
  },
  table: {
    marginTop: 10,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 600,
    color: "#475569",
    flex: 1,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableRowHighlight: {
    backgroundColor: "#eff6ff",
  },
  tableCell: {
    fontSize: 9,
    color: "#374151",
    flex: 1,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 10,
  },
  statCard: {
    width: "48%",
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statLabel: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0f172a",
  },
  statSubValue: {
    fontSize: 8,
    color: "#94a3b8",
    marginTop: 2,
  },
  propertyCard: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  propertyAddress: {
    fontSize: 12,
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: 8,
  },
  propertyDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  propertyDetail: {
    fontSize: 9,
    color: "#475569",
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  propertyPrice: {
    fontSize: 14,
    fontWeight: 700,
    color: "#059669",
    marginTop: 8,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  footerText: {
    fontSize: 8,
    color: "#94a3b8",
  },
  coverLetter: {
    lineHeight: 1.8,
    fontSize: 11,
    color: "#374151",
  },
  agentContact: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  agentRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
  },
  agentDetail: {
    fontSize: 10,
    color: "#475569",
    marginBottom: 2,
  },
  priceBar: {
    height: 16,
    backgroundColor: "#3b82f6",
    borderRadius: 2,
    marginVertical: 2,
  },
  priceBarSubject: {
    backgroundColor: "#059669",
  },
  priceBarLabel: {
    fontSize: 8,
    color: "#475569",
    marginBottom: 2,
  },
  priceBarValue: {
    fontSize: 8,
    fontWeight: 600,
    color: "#0f172a",
    marginLeft: 4,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  chartLabel: {
    width: 120,
    fontSize: 8,
    color: "#475569",
  },
  chartBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 40,
    objectFit: "contain",
  },
  agentPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    objectFit: "cover",
  },
});

interface PropertyData {
  id?: string;
  listingId?: string;
  streetAddress?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  listPrice?: number | string;
  closePrice?: number | string;
  livingArea?: number | string;
  bedroomsTotal?: number | string;
  bathroomsTotal?: number | string;
  yearBuilt?: number | string;
  status?: string;
  daysOnMarket?: number | string;
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
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

const formatNumber = (value: number): string => {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
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
    .map(p => Number(p.bathroomsTotal))
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
    priceRange: { min: Math.min(...prices, 0), max: Math.max(...prices, 0) },
    sqftRange: { min: Math.min(...livingAreas, 0), max: Math.max(...livingAreas, 0) },
  };
};

export function CMAPdfDocument({
  cma,
  agentProfile,
  companySettings,
  currentUser,
  includedSections,
  coverLetterOverride,
  includeAgentFooter,
  brochure,
}: CMAPdfDocumentProps) {
  const properties = (cma.propertiesData || []) as PropertyData[];
  const statistics = calculateStatistics(properties);
  const subjectId = cma.subjectPropertyId;
  
  const subjectProperty = subjectId 
    ? properties.find(p => p.id === subjectId || p.listingId === subjectId)
    : properties[0];

  const agentName = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser?.email?.split("@")[0] || "Agent";

  const coverLetter = coverLetterOverride || agentProfile?.defaultCoverLetter || "";
  const companyName = companySettings?.companyName || "Real Estate Company";
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const pricePerSqftData = properties
    .filter(p => Number(p.listPrice || p.closePrice) > 0 && Number(p.livingArea) > 0)
    .map(p => {
      const price = Number(p.listPrice || p.closePrice);
      const sqft = Number(p.livingArea);
      const pricePerSqft = price / sqft;
      const address = p.streetAddress || p.address || "Property";
      const shortAddress = address.length > 25 ? address.substring(0, 22) + "..." : address;
      const isSubject = subjectId ? (p.id === subjectId || p.listingId === subjectId) : false;
      return { name: shortAddress, pricePerSqft: Math.round(pricePerSqft), isSubject };
    })
    .sort((a, b) => a.pricePerSqft - b.pricePerSqft);

  const maxPricePerSqft = Math.max(...pricePerSqftData.map(d => d.pricePerSqft), 1);

  return (
    <Document>
      {includedSections.includes("cover_page") && (
        <Page size="LETTER" style={styles.coverPage}>
          {companySettings?.logoUrl && (
            <Image src={companySettings.logoUrl} style={styles.logo} />
          )}
          <Text style={styles.coverTitle}>Comparative Market Analysis</Text>
          <Text style={styles.coverSubtitle}>Prepared exclusively for you</Text>
          
          {subjectProperty && (
            <>
              <Text style={styles.coverAddress}>
                {subjectProperty.streetAddress || subjectProperty.address || "Property Address"}
              </Text>
              <Text style={styles.coverDetails}>
                {subjectProperty.city}, {subjectProperty.state} {subjectProperty.postalCode}
              </Text>
            </>
          )}

          <View style={styles.coverAgent}>
            <Text style={styles.coverAgentName}>{agentName}</Text>
            {agentProfile?.title && (
              <Text style={styles.coverAgentTitle}>{agentProfile.title}</Text>
            )}
            <Text style={styles.coverCompany}>{companyName}</Text>
          </View>

          <Text style={{ ...styles.headerDate, marginTop: 40 }}>{currentDate}</Text>
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
        </Page>
      )}

      {includedSections.includes("cover_letter") && coverLetter && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Personal Letter</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>

          <Text style={styles.sectionTitle}>Dear Homeowner,</Text>
          <Text style={styles.coverLetter}>{coverLetter}</Text>

          <View style={styles.agentContact}>
            <Text style={styles.agentName}>{agentName}</Text>
            {agentProfile?.title && (
              <Text style={styles.agentDetail}>{agentProfile.title}</Text>
            )}
            {currentUser?.email && (
              <Text style={styles.agentDetail}>{currentUser.email}</Text>
            )}
            {currentUser?.phone && (
              <Text style={styles.agentDetail}>{currentUser.phone}</Text>
            )}
          </View>

          {includeAgentFooter && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>{companyName}</Text>
              <Text style={styles.footerText}>Prepared by {agentName}</Text>
            </View>
          )}
        </Page>
      )}

      {includedSections.includes("contact_me") && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Contact Information</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>

          <Text style={styles.sectionTitle}>Your Real Estate Professional</Text>

          <View style={styles.agentContact}>
            <View style={styles.agentRow}>
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
              <View style={{ marginTop: 16 }}>
                <Text style={styles.subsectionTitle}>About Me</Text>
                <Text style={styles.paragraph}>{agentProfile.bio}</Text>
              </View>
            )}
          </View>

          {includeAgentFooter && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>{companyName}</Text>
              <Text style={styles.footerText}>Prepared by {agentName}</Text>
            </View>
          )}
        </Page>
      )}

      {includedSections.includes("summary_comparables") && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Summary of Comparable Properties</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>

          <Text style={styles.sectionTitle}>Market Overview</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average Price</Text>
              <Text style={styles.statValue}>{formatCurrency(statistics.avgPrice)}</Text>
              <Text style={styles.statSubValue}>Median: {formatCurrency(statistics.medianPrice)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average $/SqFt</Text>
              <Text style={styles.statValue}>${formatNumber(statistics.avgPricePerSqft)}</Text>
              <Text style={styles.statSubValue}>Median: ${formatNumber(statistics.medianPricePerSqft)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Properties Analyzed</Text>
              <Text style={styles.statValue}>{statistics.propertyCount}</Text>
              <Text style={styles.statSubValue}>Comparable properties</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Price Range</Text>
              <Text style={styles.statValue}>
                {formatCurrency(statistics.priceRange.min)} - {formatCurrency(statistics.priceRange.max)}
              </Text>
              <Text style={styles.statSubValue}>Market spread</Text>
            </View>
          </View>

          <View style={{ marginTop: 20 }}>
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
            <View style={styles.footer}>
              <Text style={styles.footerText}>{companyName}</Text>
              <Text style={styles.footerText}>Prepared by {agentName}</Text>
            </View>
          )}
        </Page>
      )}

      {includedSections.includes("property_details") && properties.length > 0 && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Property Details</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>

          <Text style={styles.sectionTitle}>Comparable Properties</Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Address</Text>
              <Text style={styles.tableHeaderCell}>Price</Text>
              <Text style={styles.tableHeaderCell}>SqFt</Text>
              <Text style={styles.tableHeaderCell}>$/SqFt</Text>
              <Text style={styles.tableHeaderCell}>Bed/Bath</Text>
              <Text style={styles.tableHeaderCell}>Status</Text>
            </View>
            {properties.slice(0, 15).map((property, index) => {
              const isSubject = subjectId 
                ? (property.id === subjectId || property.listingId === subjectId) 
                : false;
              const price = Number(property.listPrice || property.closePrice) || 0;
              const sqft = Number(property.livingArea) || 0;
              const pricePerSqft = sqft > 0 ? price / sqft : 0;

              return (
                <View 
                  key={index} 
                  style={isSubject ? [styles.tableRow, styles.tableRowHighlight] : styles.tableRow}
                >
                  <Text style={{ ...styles.tableCell, flex: 2 }}>
                    {isSubject ? "★ " : ""}
                    {property.streetAddress || property.address || "N/A"}
                  </Text>
                  <Text style={styles.tableCell}>{formatCurrency(price)}</Text>
                  <Text style={styles.tableCell}>{formatNumber(sqft)}</Text>
                  <Text style={styles.tableCell}>${formatNumber(pricePerSqft)}</Text>
                  <Text style={styles.tableCell}>
                    {property.bedroomsTotal || "-"}/{property.bathroomsTotal || "-"}
                  </Text>
                  <Text style={styles.tableCell}>{property.status || "N/A"}</Text>
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
            <View style={styles.footer}>
              <Text style={styles.footerText}>{companyName}</Text>
              <Text style={styles.footerText}>Prepared by {agentName}</Text>
            </View>
          )}
        </Page>
      )}

      {includedSections.includes("price_per_sqft") && pricePerSqftData.length > 0 && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Price Per Square Foot Analysis</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>

          <Text style={styles.sectionTitle}>Price Per Sq. Ft. Comparison</Text>
          <Text style={styles.paragraph}>
            This chart compares the price per square foot across all comparable properties.
            {subjectId && " Your property is highlighted in green."}
          </Text>

          <View style={{ marginTop: 16 }}>
            {pricePerSqftData.slice(0, 12).map((item, index) => (
              <View key={index} style={styles.chartRow}>
                <Text style={styles.chartLabel}>{item.name}</Text>
                <View style={styles.chartBarContainer}>
                  <View
                    style={
                      item.isSubject 
                        ? [styles.priceBar, styles.priceBarSubject, { width: `${(item.pricePerSqft / maxPricePerSqft) * 70}%` }]
                        : [styles.priceBar, { width: `${(item.pricePerSqft / maxPricePerSqft) * 70}%` }]
                    }
                  />
                  <Text style={styles.priceBarValue}>${item.pricePerSqft}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 20 }}>
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
            <View style={styles.footer}>
              <Text style={styles.footerText}>{companyName}</Text>
              <Text style={styles.footerText}>Prepared by {agentName}</Text>
            </View>
          )}
        </Page>
      )}

      {includedSections.includes("comparable_stats") && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Detailed Statistics</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>

          <Text style={styles.sectionTitle}>Comparable Property Statistics</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average Price</Text>
              <Text style={styles.statValue}>{formatCurrency(statistics.avgPrice)}</Text>
              <Text style={styles.statSubValue}>Median: {formatCurrency(statistics.medianPrice)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average $/SqFt</Text>
              <Text style={styles.statValue}>${formatNumber(statistics.avgPricePerSqft)}</Text>
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
              The price per square foot ranges from ${formatNumber(statistics.avgPricePerSqft - 50)} to
              ${formatNumber(statistics.avgPricePerSqft + 50)}, with the market median at
              ${formatNumber(statistics.medianPricePerSqft)} per square foot.
            </Text>
          </View>

          {includeAgentFooter && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>{companyName}</Text>
              <Text style={styles.footerText}>Prepared by {agentName}</Text>
            </View>
          )}
        </Page>
      )}
    </Document>
  );
}

export default CMAPdfDocument;
