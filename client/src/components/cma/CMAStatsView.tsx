import { useMemo, useState } from 'react';
import { 
  BarChart, Bar, ScatterChart, Scatter, 
  XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, Cell 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, TrendingUp, DollarSign, Calendar, Ruler, FileText } from 'lucide-react';
import { 
  extractPrice, 
  extractSqft, 
  formatPrice, 
  formatPriceShort, 
  formatYAxisPrice,
  calculateStatistics,
  normalizeStatus,
  getPropertyAddress,
  getPropertyPhotos,
  SUBJECT_COLOR,
} from '@/lib/cma-data-utils';
import { STATUS_COLORS } from '@/lib/statusColors';
import { BRAND_COLORS } from '@/lib/designTokens';

interface CMAStatsViewProps {
  properties: any[];
  subjectProperty: any;
  onPropertyClick?: (property: any) => void;
}

export function CMAStatsView({ properties, subjectProperty, onPropertyClick }: CMAStatsViewProps) {
  const closedProperties = useMemo(() => {
    return properties.filter(p => {
      const status = normalizeStatus(p.status || p.standardStatus);
      return status === 'SOLD';
    });
  }, [properties]);

  return (
    <div className="space-y-6" data-testid="cma-stats-view">
      <SummaryCards properties={properties} subjectProperty={subjectProperty} />
      <PriceComparisonChart properties={properties} subjectProperty={subjectProperty} onPropertyClick={onPropertyClick} />
      <CMAMarketReviewSection properties={properties} closedProperties={closedProperties} subjectProperty={subjectProperty} />
      <DaysOnMarketSection closedProperties={closedProperties} onPropertyClick={onPropertyClick} />
      <AveragePricePerSqftSection closedProperties={closedProperties} subjectProperty={subjectProperty} onPropertyClick={onPropertyClick} />
    </div>
  );
}

function SummaryCards({ properties, subjectProperty }: { properties: any[]; subjectProperty: any }) {
  const stats = useMemo(() => calculateStatistics(properties), [properties]);
  
  const subjectPrice = extractPrice(subjectProperty);
  const subjectSqft = extractSqft(subjectProperty);
  const subjectPricePerSqft = subjectPrice && subjectSqft ? subjectPrice / subjectSqft : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-4">
      <Card data-testid="card-avg-price">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium">Avg Price</span>
          </div>
          <p className="text-2xl font-bold">{formatPriceShort(stats.price.average)}</p>
          <p className="text-xs text-muted-foreground">
            Range: {formatPriceShort(stats.price.range.min)} - {formatPriceShort(stats.price.range.max)}
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-avg-sqft-price">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Ruler className="w-4 h-4" />
            <span className="text-xs font-medium">Avg $/Sq.Ft.</span>
          </div>
          <p className="text-2xl font-bold">${Math.round(stats.pricePerSqFt.average)}</p>
          <p className="text-xs text-muted-foreground">
            Subject: ${Math.round(subjectPricePerSqft)}
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-avg-living-area">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Home className="w-4 h-4" />
            <span className="text-xs font-medium">Avg Living Area</span>
          </div>
          <p className="text-2xl font-bold">{Math.round(stats.livingArea.average).toLocaleString()} sf</p>
          <p className="text-xs text-muted-foreground">
            {stats.bedrooms.average.toFixed(1)} beds / {stats.bathrooms.average.toFixed(1)} baths
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-avg-dom">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-medium">Avg Days on Market</span>
          </div>
          <p className="text-2xl font-bold">{Math.round(stats.daysOnMarket.average)} days</p>
          <p className="text-xs text-muted-foreground">
            Median: {Math.round(stats.daysOnMarket.median)} days
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PriceComparisonChart({ properties, subjectProperty, onPropertyClick }: { properties: any[]; subjectProperty: any; onPropertyClick?: (property: any) => void }) {
  const chartData = useMemo(() => {
    const data: { name: string; fullAddress: string; price: number; isSubject: boolean }[] = [];
    
    if (subjectProperty) {
      const subjectPrice = extractPrice(subjectProperty);
      const subjectAddress = getPropertyAddress(subjectProperty);
      if (subjectPrice) {
        data.push({
          name: 'Subject',
          fullAddress: subjectAddress || 'Subject Property',
          price: subjectPrice,
          isSubject: true,
        });
      }
    }

    properties.slice(0, 11).forEach((p) => {
      const price = extractPrice(p);
      if (price) {
        const address = getPropertyAddress(p);
        const streetAddress = address.split(',')[0] || address;
        data.push({
          name: streetAddress.length > 15 ? streetAddress.substring(0, 15) + '...' : streetAddress,
          fullAddress: address,
          price,
          isSubject: false,
        });
      }
    });

    return data;
  }, [properties, subjectProperty]);

  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    return `$${(value / 1000).toFixed(0)}K`;
  };

  return (
    <Card className="mx-4" data-testid="chart-price-comparison">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Price Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              margin={{ top: 20, right: 20, left: 20, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis 
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis 
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11 }}
                width={60}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const data = payload[0].payload as { fullAddress: string; price: number };
                  return (
                    <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-lg border text-sm">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {data.fullAddress}
                      </p>
                      <p className="text-primary font-semibold">
                        Price: ${data.price.toLocaleString()}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="price" radius={[4, 4, 0, 0]} maxBarSize={50}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={index} 
                    fill={entry.isSubject ? SUBJECT_COLOR : BRAND_COLORS.primary} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: SUBJECT_COLOR }} />
            <span className="text-sm text-muted-foreground">Subject Property</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: BRAND_COLORS.primary }} />
            <span className="text-sm text-muted-foreground">Comparables</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CMAMarketReviewSection({ 
  properties, 
  closedProperties, 
  subjectProperty 
}: { 
  properties: any[]; 
  closedProperties: any[]; 
  subjectProperty: any;
}) {
  const stats = useMemo(() => calculateStatistics(properties), [properties]);
  
  const priceRange = useMemo(() => {
    const prices = properties.map(p => extractPrice(p)).filter(Boolean) as number[];
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [properties]);

  const sqftRange = useMemo(() => {
    const areas = properties.map(p => extractSqft(p)).filter(Boolean) as number[];
    if (areas.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...areas), max: Math.max(...areas) };
  }, [properties]);

  const pricePerSqftRange = useMemo(() => {
    const ppsf = properties.map(p => {
      const price = extractPrice(p);
      const sqft = extractSqft(p);
      return price && sqft ? price / sqft : null;
    }).filter(Boolean) as number[];
    if (ppsf.length === 0) return { min: 0, max: 0 };
    return { min: Math.round(Math.min(...ppsf)), max: Math.round(Math.max(...ppsf)) };
  }, [properties]);

  return (
    <Card className="mx-4" data-testid="cma-market-review">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5" />
          CMA Market Review
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Market Overview</h4>
            <p className="text-sm">
              Based on {properties.length} comparable properties, the average price is{' '}
              <span className="font-semibold text-primary">{formatPrice(stats.price.average)}</span>{' '}
              with a median of{' '}
              <span className="font-semibold text-primary">{formatPrice(stats.price.median)}</span>.
              Prices range from {formatPrice(priceRange.min)} to {formatPrice(priceRange.max)}.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Price Per Square Foot</h4>
            <p className="text-sm">
              Average price per square foot is{' '}
              <span className="font-semibold text-primary">${Math.round(stats.pricePerSqFt.average)}</span>{' '}
              across comparable properties. This ranges from ${pricePerSqftRange.min} to ${pricePerSqftRange.max}/sqft.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Days on Market</h4>
            <p className="text-sm">
              Average: <span className="font-semibold">{Math.round(stats.daysOnMarket.average)} days</span>
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Bed/Bath</h4>
            <p className="text-sm">
              Avg: <span className="font-semibold">{stats.bedrooms.average.toFixed(1)} beds / {stats.bathrooms.average.toFixed(1)} baths</span>
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Property Size</h4>
            <p className="text-sm">
              Avg: <span className="font-semibold">{Math.round(stats.livingArea.average).toLocaleString()} sqft</span>
              <br />
              <span className="text-muted-foreground text-xs">
                Range: {sqftRange.min.toLocaleString()} - {sqftRange.max.toLocaleString()} sqft
              </span>
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground italic">
          This analysis is based on {closedProperties.length} Closed propert{closedProperties.length === 1 ? 'y' : 'ies'} in your selection.
        </div>
      </CardContent>
    </Card>
  );
}

function DaysOnMarketSection({ closedProperties, onPropertyClick }: { closedProperties: any[]; onPropertyClick?: (property: any) => void }) {
  const avgDOM = useMemo(() => {
    const withDom = closedProperties.filter(p => p.daysOnMarket != null);
    if (withDom.length === 0) return 0;
    const sum = withDom.reduce((acc, p) => acc + (p.daysOnMarket || 0), 0);
    return Math.round(sum / withDom.length);
  }, [closedProperties]);

  const avgListPricePercent = useMemo(() => {
    const withRatio = closedProperties.filter(p => {
      const soldPrice = p.soldPrice || p.closePrice || p.price;
      const listPrice = p.listPrice;
      return soldPrice && listPrice && listPrice > 0;
    });
    if (withRatio.length === 0) return 100;
    const sum = withRatio.reduce((acc, p) => {
      const soldPrice = p.soldPrice || p.closePrice || p.price;
      const listPrice = p.listPrice || soldPrice;
      return acc + (soldPrice / listPrice) * 100;
    }, 0);
    return sum / withRatio.length;
  }, [closedProperties]);

  const getColor = (percent: number) => {
    if (percent >= 100) return '#22c55e';
    if (percent >= 95) return '#eab308';
    return '#ef4444';
  };

  const chartData = useMemo(() => {
    return closedProperties.map(p => {
      const soldPrice = p.soldPrice || p.closePrice || p.price;
      const listPrice = p.listPrice || soldPrice;
      const percent = listPrice > 0 ? (soldPrice / listPrice) * 100 : 100;
      const photos = getPropertyPhotos(p);
      return {
        dom: p.daysOnMarket || 0,
        price: soldPrice,
        percent,
        fill: getColor(percent),
        address: getPropertyAddress(p),
        photo: photos[0] || null,
        property: p,
      };
    });
  }, [closedProperties]);

  if (closedProperties.length === 0) {
    return (
      <Card className="mx-4" data-testid="section-dom">
        <CardContent className="pt-4">
          <p className="text-center text-muted-foreground py-8">No closed properties to analyze</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-4" data-testid="section-dom">
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-center gap-4 mb-2">
          <div>
            <span className="text-3xl font-bold">{avgDOM}</span>
            <span className="text-sm font-normal text-muted-foreground ml-2">DAYS ON MARKET</span>
          </div>
          <div>
            <span className="text-3xl font-bold text-primary">{avgListPricePercent.toFixed(2)}%</span>
            <span className="text-sm font-normal text-muted-foreground ml-2">OF LIST PRICE</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Sold homes were on the market for an average of{' '}
          <span className="font-semibold text-foreground">{avgDOM} days</span>{' '}
          before they accepted an offer. These homes sold for an average of{' '}
          <span className="font-semibold text-foreground">{avgListPricePercent.toFixed(2)}%</span>{' '}
          of list price.
        </p>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-1/3 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded">
                {closedProperties.length}
              </span>
              <span className="font-medium">Closed</span>
            </div>
            
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
              {chartData.slice(0, 10).map((data, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  data-testid={`dom-property-${idx}`}
                  onClick={() => onPropertyClick?.(data.property)}
                >
                  <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                    {data.photo ? (
                      <img src={data.photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Home className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{data.address}</p>
                    <p className="text-xs text-muted-foreground">
                      {data.dom} Days • {data.percent.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:w-2/3 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  type="number" 
                  dataKey="dom" 
                  name="Days on Market"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Days on Market', position: 'bottom', offset: 20, fontSize: 12 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="price" 
                  tickFormatter={formatYAxisPrice}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  content={({ payload }) => {
                    if (!payload?.[0]) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background p-2 rounded-lg shadow-lg border text-sm">
                        <p className="font-semibold">{data.address}</p>
                        <p>Price: {formatPrice(data.price)}</p>
                        <p>DOM: {data.dom} days</p>
                        <p>List Ratio: {data.percent.toFixed(2)}%</p>
                      </div>
                    );
                  }}
                />
                <Scatter data={chartData}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} r={8} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-6 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">≥100% of list</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-sm text-muted-foreground">95-99% of list</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm text-muted-foreground">&lt;95% of list</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AveragePricePerSqftSection({ 
  closedProperties, 
  subjectProperty,
  onPropertyClick 
}: { 
  closedProperties: any[]; 
  subjectProperty: any;
  onPropertyClick?: (property: any) => void;
}) {
  const [showSubject, setShowSubject] = useState(true);
  const [showClosed, setShowClosed] = useState(true);

  const avgPricePerSqft = useMemo(() => {
    const withData = closedProperties.filter(p => {
      const price = extractPrice(p);
      const sqft = extractSqft(p);
      return price && sqft && sqft > 0;
    });
    if (withData.length === 0) return 0;
    const sum = withData.reduce((acc, p) => {
      const price = extractPrice(p)!;
      const sqft = extractSqft(p)!;
      return acc + (price / sqft);
    }, 0);
    return Math.round(sum / withData.length);
  }, [closedProperties]);

  const subjectPricePerSqft = useMemo(() => {
    const price = extractPrice(subjectProperty);
    const sqft = extractSqft(subjectProperty);
    if (!price || !sqft || sqft === 0) return 0;
    return Math.round(price / sqft);
  }, [subjectProperty]);

  const chartData = useMemo(() => {
    const data: any[] = [];
    
    if (showSubject && subjectProperty) {
      const sqft = extractSqft(subjectProperty);
      const price = extractPrice(subjectProperty);
      if (sqft && price) {
        data.push({
          x: sqft,
          y: price,
          isSubject: true,
          address: getPropertyAddress(subjectProperty),
          pricePerSqft: subjectPricePerSqft,
        });
      }
    }

    if (showClosed) {
      closedProperties.forEach(p => {
        const sqft = extractSqft(p);
        const price = extractPrice(p);
        if (sqft && price) {
          data.push({
            x: sqft,
            y: price,
            isSubject: false,
            address: getPropertyAddress(p),
            pricePerSqft: Math.round(price / sqft),
          });
        }
      });
    }

    return data;
  }, [showSubject, showClosed, subjectProperty, closedProperties, subjectPricePerSqft]);

  return (
    <Card className="mx-4" data-testid="section-sqft-price">
      <CardContent className="pt-4">
        <div className="font-bold text-lg mb-1">AVERAGE PRICE/SQ. FT.</div>
        <div className="text-sm text-muted-foreground mb-4">
          1 Subject, {closedProperties.length} Closed
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-56 flex-shrink-0">
            {subjectProperty && (
              <div 
                className="flex items-center gap-3 p-2 rounded-lg border-b mb-2 pb-3 ring-2 ring-blue-500/30 cursor-pointer hover:bg-muted/50 transition-colors"
                data-testid="sqft-subject-property"
                onClick={() => onPropertyClick?.(subjectProperty)}
              >
                <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                  {getPropertyPhotos(subjectProperty)[0] ? (
                    <img src={getPropertyPhotos(subjectProperty)[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-blue-500">
                    Subject: {getPropertyAddress(subjectProperty)}
                  </p>
                  <p className="font-semibold text-primary">
                    ${subjectPricePerSqft} / sq. ft.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {closedProperties.map((property, idx) => {
                const price = extractPrice(property);
                const sqft = extractSqft(property);
                const pricePerSqft = price && sqft ? Math.round(price / sqft) : 0;
                const photos = getPropertyPhotos(property);

                return (
                  <div 
                    key={idx}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    data-testid={`sqft-property-${idx}`}
                    onClick={() => onPropertyClick?.(property)}
                  >
                    <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                      {photos[0] ? (
                        <img src={photos[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Home className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {getPropertyAddress(property)}
                      </p>
                      <p className="font-semibold text-primary">
                        ${pricePerSqft} / sq. ft.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-1">
            <div className="mb-4">
              <span className="text-4xl font-bold text-primary">${avgPricePerSqft}</span>
              <span className="text-xl text-muted-foreground ml-1">/ Sq. Ft.</span>
              <p className="text-sm text-muted-foreground mt-2">
                Comparable homes sold for an average of{' '}
                <span className="font-semibold text-primary">${avgPricePerSqft}</span>/sq. ft. 
                Many factors such as location, use of space, condition, quality, and amenities 
                determine the market value per square foot.
              </p>
            </div>

            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="Square Feet"
                    tickFormatter={(v) => v.toLocaleString()}
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Square feet', position: 'bottom', offset: 20, fontSize: 12 }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    tickFormatter={formatYAxisPrice}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip 
                    content={({ payload }) => {
                      if (!payload?.[0]) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background p-2 rounded-lg shadow-lg border text-sm">
                          <p className="font-semibold">{data.address}</p>
                          <p>Price: {formatPrice(data.y)}</p>
                          <p>Sq Ft: {data.x?.toLocaleString()}</p>
                          <p>$/SqFt: ${data.pricePerSqft}</p>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={chartData}>
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={index} 
                        fill={entry.isSubject ? SUBJECT_COLOR : '#ef4444'}
                        r={entry.isSubject ? 12 : 8}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 mt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showSubject}
                  onChange={(e) => setShowSubject(e.target.checked)}
                  className="rounded"
                  data-testid="checkbox-show-subject"
                />
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: SUBJECT_COLOR }} />
                <span className="text-sm">Subject Property</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showClosed}
                  onChange={(e) => setShowClosed(e.target.checked)}
                  className="rounded"
                  data-testid="checkbox-show-closed"
                />
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm">Closed Comparables</span>
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CMAStatsView;
