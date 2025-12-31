import sgMail from '@sendgrid/mail';
import type { SellerUpdate, SellerUpdateSendHistory } from '@shared/schema';

interface Property {
  id: string;
  unparsedAddress?: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
  listPrice?: string | number | null;
  closePrice?: string | number | null;
  bedroomsTotal?: number | null;
  bathroomsTotalInteger?: number | null;
  livingArea?: string | number | null;
  standardStatus?: string;
  photos?: string[];
  daysOnMarket?: number | null;
  closeDate?: string | Date | null;
}

interface MarketStats {
  totalProperties: number;
  averagePrice: number;
  medianPrice: number;
  averagePricePerSqFt: number;
  averageDaysOnMarket: number;
  priceRange: { min: number; max: number };
}

interface AgentInfo {
  name: string;
  email: string;
  phone?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'updates@spyglassrealty.com';
const SENDGRID_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_ID;

let isInitialized = false;

export function initSendGrid(): boolean {
  if (!SENDGRID_API_KEY) {
    console.warn('⚠️ SendGrid API key not configured. Email sending is disabled.');
    return false;
  }
  
  sgMail.setApiKey(SENDGRID_API_KEY);
  isInitialized = true;
  console.log('✅ SendGrid initialized successfully');
  return true;
}

export function isSendGridConfigured(): boolean {
  return !!SENDGRID_API_KEY && !!SENDGRID_TEMPLATE_ID;
}

export function calculateNextSendDate(frequency: string, fromDate: Date = new Date()): Date {
  const next = new Date(fromDate);
  
  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'bimonthly':
      next.setDate(next.getDate() + 14);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  
  next.setHours(9, 0, 0, 0);
  return next;
}

export function calculateMarketStats(properties: Property[]): MarketStats {
  if (properties.length === 0) {
    return {
      totalProperties: 0,
      averagePrice: 0,
      medianPrice: 0,
      averagePricePerSqFt: 0,
      averageDaysOnMarket: 0,
      priceRange: { min: 0, max: 0 },
    };
  }

  const prices = properties
    .map(p => Number(p.closePrice || p.listPrice || 0))
    .filter(p => p > 0);
  
  const sqftPrices = properties
    .map(p => {
      const price = Number(p.closePrice || p.listPrice || 0);
      const sqft = Number(p.livingArea || 0);
      return sqft > 0 ? price / sqft : 0;
    })
    .filter(p => p > 0);

  const dom = properties
    .map(p => Number(p.daysOnMarket || 0))
    .filter(d => d > 0);

  const sortedPrices = [...prices].sort((a, b) => a - b);
  const medianPrice = sortedPrices.length > 0
    ? sortedPrices[Math.floor(sortedPrices.length / 2)]
    : 0;

  return {
    totalProperties: properties.length,
    averagePrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
    medianPrice,
    averagePricePerSqFt: sqftPrices.length > 0 ? sqftPrices.reduce((a, b) => a + b, 0) / sqftPrices.length : 0,
    averageDaysOnMarket: dom.length > 0 ? dom.reduce((a, b) => a + b, 0) / dom.length : 0,
    priceRange: {
      min: sortedPrices[0] || 0,
      max: sortedPrices[sortedPrices.length - 1] || 0,
    },
  };
}

export async function sendSellerUpdateEmail(
  sellerUpdate: SellerUpdate,
  properties: Property[],
  agent: AgentInfo,
  clientName: string,
  isTest: boolean = false
): Promise<SendEmailResult> {
  if (!isInitialized && !initSendGrid()) {
    return { success: false, error: 'SendGrid not configured' };
  }

  if (!SENDGRID_TEMPLATE_ID) {
    return { success: false, error: 'SendGrid template ID not configured' };
  }

  const marketStats = calculateMarketStats(properties);
  const recipientEmail = isTest ? agent.email : sellerUpdate.email;

  const formattedProperties = properties.slice(0, 10).map(p => ({
    address: p.unparsedAddress || 'Unknown Address',
    city: p.city || '',
    state: p.stateOrProvince || '',
    zip: p.postalCode || '',
    price: Number(p.closePrice || p.listPrice || 0),
    formattedPrice: `$${Number(p.closePrice || p.listPrice || 0).toLocaleString()}`,
    beds: p.bedroomsTotal || 0,
    baths: p.bathroomsTotalInteger || 0,
    sqft: Number(p.livingArea || 0),
    formattedSqft: Number(p.livingArea || 0).toLocaleString(),
    status: p.standardStatus || 'Unknown',
    photo: p.photos?.[0] || '',
    daysOnMarket: p.daysOnMarket || 0,
  }));

  const msg = {
    to: recipientEmail,
    from: {
      email: SENDGRID_FROM_EMAIL,
      name: 'Spyglass Realty Updates',
    },
    replyTo: agent.email,
    templateId: SENDGRID_TEMPLATE_ID,
    dynamicTemplateData: {
      client_name: clientName,
      agent_name: agent.name,
      agent_email: agent.email,
      agent_phone: agent.phone || '',
      update_name: sellerUpdate.name,
      postal_code: sellerUpdate.postalCode,
      properties: formattedProperties,
      property_count: properties.length,
      market_stats: {
        total_properties: marketStats.totalProperties,
        average_price: `$${Math.round(marketStats.averagePrice).toLocaleString()}`,
        median_price: `$${Math.round(marketStats.medianPrice).toLocaleString()}`,
        price_per_sqft: `$${Math.round(marketStats.averagePricePerSqFt)}`,
        avg_days_on_market: Math.round(marketStats.averageDaysOnMarket),
        price_range_low: `$${Math.round(marketStats.priceRange.min).toLocaleString()}`,
        price_range_high: `$${Math.round(marketStats.priceRange.max).toLocaleString()}`,
      },
      current_date: new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      is_test: isTest,
    },
    trackingSettings: {
      clickTracking: { enable: true },
      openTracking: { enable: true },
    },
  };

  try {
    const [response] = await sgMail.send(msg);
    const messageId = response.headers['x-message-id'] as string || '';
    
    console.log(`📧 Email sent successfully to ${recipientEmail} (Test: ${isTest})`);
    
    return {
      success: true,
      messageId,
    };
  } catch (error: any) {
    const errorMessage = error.response?.body?.errors?.[0]?.message || error.message || 'Unknown error';
    console.error(`❌ Failed to send email to ${recipientEmail}:`, errorMessage);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export function getFrequencyLabel(frequency: string): string {
  switch (frequency) {
    case 'weekly': return 'Weekly';
    case 'bimonthly': return 'Twice Monthly';
    case 'quarterly': return 'Quarterly';
    default: return frequency;
  }
}
