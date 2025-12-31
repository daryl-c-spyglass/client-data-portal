import { Resend } from 'resend';
import type { SellerUpdate } from '@shared/schema';

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

const RESEND_API_KEY = process.env.RESEND_API_KEY;
let resend: Resend | null = null;

export function initResend(): boolean {
  if (!RESEND_API_KEY) {
    console.warn('⚠️ Resend API key not configured. Email sending is disabled.');
    return false;
  }
  
  resend = new Resend(RESEND_API_KEY);
  console.log('✅ Resend initialized successfully');
  return true;
}

export function isResendConfigured(): boolean {
  return !!RESEND_API_KEY;
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

function generateEmailHtml({
  clientName,
  agentName,
  agentEmail,
  agentPhone,
  updateName,
  properties,
  marketStats,
  isTest,
}: {
  clientName: string;
  agentName: string;
  agentEmail: string;
  agentPhone?: string;
  updateName: string;
  properties: Array<{
    address: string;
    city: string;
    state: string;
    zip: string;
    formattedPrice: string;
    beds: number;
    baths: number;
    formattedSqft: string;
    status: string;
    photo: string;
    daysOnMarket: number;
  }>;
  marketStats: MarketStats;
  isTest: boolean;
}): string {
  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const propertyRows = properties.map(p => `
    <tr>
      <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${p.photo ? `
            <td width="120" style="vertical-align: top; padding-right: 16px;">
              <img src="${p.photo}" alt="${p.address}" style="width: 120px; height: 80px; object-fit: cover; border-radius: 8px;" />
            </td>
            ` : ''}
            <td style="vertical-align: top;">
              <div style="font-weight: 600; color: #111827; font-size: 16px; margin-bottom: 4px;">${p.address}</div>
              <div style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">${p.city}, ${p.state} ${p.zip}</div>
              <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                <span style="color: #ea580c; font-weight: 700; font-size: 18px;">${p.formattedPrice}</span>
                <span style="color: #6b7280; font-size: 14px;">${p.beds} bd • ${p.baths} ba • ${p.formattedSqft} sqft</span>
              </div>
              <div style="margin-top: 8px;">
                <span style="display: inline-block; padding: 4px 8px; background-color: ${p.status === 'Active' ? '#dcfce7' : p.status === 'Closed' ? '#fee2e2' : '#fef3c7'}; color: ${p.status === 'Active' ? '#166534' : p.status === 'Closed' ? '#991b1b' : '#92400e'}; border-radius: 4px; font-size: 12px; font-weight: 500;">${p.status}</span>
                ${p.daysOnMarket > 0 ? `<span style="color: #6b7280; font-size: 12px; margin-left: 8px;">${p.daysOnMarket} days on market</span>` : ''}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Market Update: ${updateName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; padding: 24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #ea580c; padding: 32px 24px; border-radius: 12px 12px 0 0;">
              <img src="https://spyglassrealty.com/wp-content/uploads/2023/01/spyglass-logo-white.png" alt="Spyglass Realty" style="height: 40px; margin-bottom: 16px;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Market Update</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">${currentDate}</p>
              ${isTest ? '<p style="margin: 8px 0 0; color: #fef3c7; font-size: 12px; font-weight: 600;">🧪 TEST EMAIL</p>' : ''}
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px 24px;">
              
              <!-- Greeting -->
              <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                Hi ${clientName},
              </p>
              <p style="margin: 0 0 32px; color: #374151; font-size: 16px; line-height: 1.6;">
                Here's your latest market update for <strong>${updateName}</strong>. Below you'll find current market statistics and recent property activity in your area.
              </p>
              
              <!-- Market Stats -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 12px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 16px; color: #111827; font-size: 18px; font-weight: 600;">Market Summary</h2>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="50%" style="padding: 8px 0;">
                          <div style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Properties</div>
                          <div style="color: #111827; font-size: 24px; font-weight: 700;">${marketStats.totalProperties}</div>
                        </td>
                        <td width="50%" style="padding: 8px 0;">
                          <div style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Avg Price</div>
                          <div style="color: #111827; font-size: 24px; font-weight: 700;">$${Math.round(marketStats.averagePrice).toLocaleString()}</div>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding: 8px 0;">
                          <div style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Price/Sq Ft</div>
                          <div style="color: #111827; font-size: 24px; font-weight: 700;">$${Math.round(marketStats.averagePricePerSqFt)}</div>
                        </td>
                        <td width="50%" style="padding: 8px 0;">
                          <div style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Avg Days on Market</div>
                          <div style="color: #111827; font-size: 24px; font-weight: 700;">${Math.round(marketStats.averageDaysOnMarket)}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Properties -->
              <h2 style="margin: 0 0 16px; color: #111827; font-size: 18px; font-weight: 600;">Recent Activity</h2>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                ${propertyRows}
              </table>
              
            </td>
          </tr>
          
          <!-- Agent Signature -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #374151; font-size: 14px;">Questions about the market? I'm here to help!</p>
              <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 600;">${agentName}</p>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">
                <a href="mailto:${agentEmail}" style="color: #ea580c; text-decoration: none;">${agentEmail}</a>
                ${agentPhone ? ` • ${agentPhone}` : ''}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #111827; padding: 24px; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 8px; color: #9ca3af; font-size: 12px;">
                Spyglass Realty • Austin, TX
              </p>
              <p style="margin: 0; color: #6b7280; font-size: 11px;">
                <a href="#unsubscribe" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a> from these updates
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export async function sendSellerUpdateEmail(
  sellerUpdate: SellerUpdate,
  properties: Property[],
  agent: AgentInfo,
  clientName: string,
  isTest: boolean = false
): Promise<SendEmailResult> {
  if (!resend && !initResend()) {
    return { success: false, error: 'Resend not configured' };
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

  const emailHtml = generateEmailHtml({
    clientName,
    agentName: agent.name,
    agentEmail: agent.email,
    agentPhone: agent.phone,
    updateName: sellerUpdate.name,
    properties: formattedProperties,
    marketStats,
    isTest,
  });

  try {
    const { data, error } = await resend!.emails.send({
      from: 'Spyglass Realty Updates <updates@spyglassrealty.com>',
      replyTo: agent.email,
      to: recipientEmail,
      subject: `Market Update: ${sellerUpdate.name}${isTest ? ' [TEST]' : ''}`,
      html: emailHtml,
    });

    if (error) {
      console.error(`❌ Resend error for ${recipientEmail}:`, error);
      return { success: false, error: error.message };
    }

    console.log(`📧 Email sent successfully to ${recipientEmail} (Test: ${isTest})`);
    
    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
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
