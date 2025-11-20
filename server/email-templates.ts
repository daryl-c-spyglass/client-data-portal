import type { Property } from "@shared/schema";

interface MarketSummary {
  totalListings: number;
  activeListings: number;
  pendingListings: number;
  soldListings: number;
  avgListPrice: number;
  avgActivePrice: number;
  avgSoldPrice: number;
  avgDaysOnMarket: number;
  lowestPrice: number;
  highestPrice: number;
  avgPricePerSqft: number;
}

interface EmailTemplateData {
  recipientName: string;
  updateName: string;
  postalCode: string;
  elementarySchool?: string;
  propertySubType?: string;
  properties: Property[];
  marketSummary: MarketSummary;
  totalMatches: number;
}

function formatCurrency(value: number | string | null | undefined): string {
  if (!value) return 'N/A';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatNumber(value: number | string | null | undefined): string {
  if (!value) return 'N/A';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(num);
}

function getPropertyImageUrl(property: Property): string {
  // TODO: Once media is synced, use actual property images
  // For now, use a placeholder
  return `https://via.placeholder.com/400x300/4F46E5/FFFFFF?text=${encodeURIComponent(property.unparsedAddress || 'Property')}`;
}

function renderPropertyCard(property: Property): string {
  const price = formatCurrency(property.listPrice);
  const beds = property.bedroomsTotal || 0;
  const baths = property.bathroomsTotalInteger || 0;
  const sqft = property.livingArea ? formatNumber(property.livingArea) : 'N/A';
  const address = property.unparsedAddress || 'Address Not Available';
  const status = property.standardStatus || 'Active';
  const dom = property.daysOnMarket || 0;
  const imageUrl = getPropertyImageUrl(property);

  return `
    <tr>
      <td style="padding: 16px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td>
              <img src="${imageUrl}" alt="${address}" width="100%" height="250" style="display: block; object-fit: cover;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #1a1a1a;">${price}</h3>
                    <p style="margin: 0 0 12px 0; color: #666666; font-size: 15px; line-height: 1.5;">${address}</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right: 20px;">
                          <span style="font-size: 16px; font-weight: 600; color: #1a1a1a;">${beds}</span>
                          <span style="font-size: 14px; color: #666666;"> beds</span>
                        </td>
                        <td style="padding-right: 20px;">
                          <span style="font-size: 16px; font-weight: 600; color: #1a1a1a;">${baths}</span>
                          <span style="font-size: 14px; color: #666666;"> baths</span>
                        </td>
                        <td>
                          <span style="font-size: 16px; font-weight: 600; color: #1a1a1a;">${sqft}</span>
                          <span style="font-size: 14px; color: #666666;"> sqft</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 12px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td>
                          <span style="display: inline-block; padding: 4px 12px; background: ${status === 'Active' ? '#10b981' : status === 'Pending' ? '#f59e0b' : '#6b7280'}; color: white; border-radius: 4px; font-size: 12px; font-weight: 600;">${status}</span>
                        </td>
                        <td align="right">
                          <span style="font-size: 13px; color: #666666;">${dom} days on market</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function renderMarketSummaryCard(summary: MarketSummary): string {
  return `
    <tr>
      <td style="padding: 24px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 24px;">
              <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Market Summary</h2>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 12px; background: rgba(255,255,255,0.1); border-radius: 6px; width: 48%;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.5px;">Avg Price</p>
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">${formatCurrency(summary.avgListPrice)}</p>
                  </td>
                  <td style="width: 4%;"></td>
                  <td style="padding: 12px; background: rgba(255,255,255,0.1); border-radius: 6px; width: 48%;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.5px;">Price/SqFt</p>
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">${formatCurrency(summary.avgPricePerSqft)}</p>
                  </td>
                </tr>
                <tr><td colspan="3" style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px; background: rgba(255,255,255,0.1); border-radius: 6px; width: 48%;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.5px;">Total Listings</p>
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">${summary.totalListings}</p>
                  </td>
                  <td style="width: 4%;"></td>
                  <td style="padding: 12px; background: rgba(255,255,255,0.1); border-radius: 6px; width: 48%;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.5px;">Avg Days on Market</p>
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">${Math.round(summary.avgDaysOnMarket)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

export function generateSellerUpdateEmail(data: EmailTemplateData): string {
  const criteriaText = [
    data.postalCode && `Zip Code: ${data.postalCode}`,
    data.elementarySchool && `Elementary School: ${data.elementarySchool}`,
    data.propertySubType && `Property Type: ${data.propertySubType}`,
  ].filter(Boolean).join(' • ');

  const propertyCards = data.properties.map(renderPropertyCard).join('\n');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${data.updateName} - Market Update</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f3f4f6;
    }
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
      }
      .property-card {
        width: 100% !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 0 20px 32px 20px; text-align: center;">
              <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: 700; color: #1a1a1a;">Market Update</h1>
              <p style="margin: 0; font-size: 16px; color: #666666;">${data.updateName}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 0 20px 24px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <tr>
                  <td>
                    <p style="margin: 0 0 12px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">Hi ${data.recipientName},</p>
                    <p style="margin: 0 0 12px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">Here's your latest market update for properties matching your criteria:</p>
                    <p style="margin: 0; font-size: 14px; color: #666666; padding: 12px; background: #f9fafb; border-radius: 6px;">${criteriaText}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Market Summary -->
          <tr>
            <td style="padding: 0 20px;">
              ${renderMarketSummaryCard(data.marketSummary)}
            </td>
          </tr>

          <!-- Properties Header -->
          <tr>
            <td style="padding: 24px 20px 16px 20px;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: #1a1a1a;">Featured Properties</h2>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: #666666;">Showing ${data.properties.length} of ${data.totalMatches} matching properties</p>
            </td>
          </tr>

          <!-- Property Cards -->
          <tr>
            <td style="padding: 0 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${propertyCards}
              </table>
            </td>
          </tr>

          <!-- View All CTA -->
          ${data.totalMatches > data.properties.length ? `
          <tr>
            <td style="padding: 24px 20px; text-align: center;">
              <a href="#" style="display: inline-block; padding: 14px 32px; background: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">View All ${data.totalMatches} Properties</a>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 20px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #666666;">You're receiving this because you subscribed to market updates.</p>
              <p style="margin: 0; font-size: 13px; color: #666666;">
                <a href="#" style="color: #4F46E5; text-decoration: none;">Update preferences</a> | 
                <a href="#" style="color: #4F46E5; text-decoration: none;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Plain text version for email clients that don't support HTML
export function generateSellerUpdateTextEmail(data: EmailTemplateData): string {
  const criteriaText = [
    data.postalCode && `Zip Code: ${data.postalCode}`,
    data.elementarySchool && `Elementary School: ${data.elementarySchool}`,
    data.propertySubType && `Property Type: ${data.propertySubType}`,
  ].filter(Boolean).join(', ');

  let text = `${data.updateName} - Market Update\n\n`;
  text += `Hi ${data.recipientName},\n\n`;
  text += `Here's your latest market update for properties matching your criteria:\n`;
  text += `${criteriaText}\n\n`;
  
  text += `MARKET SUMMARY\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Average Price: ${formatCurrency(data.marketSummary.avgListPrice)}\n`;
  text += `Price per SqFt: ${formatCurrency(data.marketSummary.avgPricePerSqft)}\n`;
  text += `Total Listings: ${data.marketSummary.totalListings}\n`;
  text += `Avg Days on Market: ${Math.round(data.marketSummary.avgDaysOnMarket)}\n\n`;

  text += `FEATURED PROPERTIES (${data.properties.length} of ${data.totalMatches})\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  data.properties.forEach((property, index) => {
    text += `${index + 1}. ${formatCurrency(property.listPrice)}\n`;
    text += `   ${property.unparsedAddress}\n`;
    text += `   ${property.bedroomsTotal || 0} beds • ${property.bathroomsTotalInteger || 0} baths • ${property.livingArea ? formatNumber(property.livingArea) : 'N/A'} sqft\n`;
    text += `   Status: ${property.standardStatus} • ${property.daysOnMarket || 0} days on market\n\n`;
  });

  text += `\nYou're receiving this because you subscribed to market updates.\n`;
  text += `To update your preferences or unsubscribe, please contact us.\n`;

  return text;
}
