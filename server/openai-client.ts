import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface PropertyContext {
  listingId?: string;
  address?: string;
  city?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  status?: string;
}

export type ChatIntent = "IDX_SEARCH" | "CMA_INTAKE" | "OTHER";

export interface CmaCriteria {
  area: string;
  sqftMin?: number;
  sqftMax?: number;
  yearBuiltMin?: number;
  yearBuiltMax?: number;
  stories?: 1 | 2 | 3 | "any";
}

const SYSTEM_PROMPT = `You are a helpful real estate assistant for Spyglass Realty in Austin, Texas. You help potential home buyers find their perfect home and assist agents with CMA preparation.

INTENT DETECTION:
Determine the user's intent and set the "intent" field accordingly:
- "IDX_SEARCH": User wants to search for properties to buy (looking for homes, find listings, etc.)
- "CMA_INTAKE": User wants to create a CMA, market analysis, or run comps for a property/area
- "OTHER": General questions, neighborhood info, real estate guidance, etc.

BEHAVIOR FOR PROPERTY SEARCHES (intent: IDX_SEARCH):
1. Acknowledge their interest and ask qualifying questions
2. Ask about: bedrooms, bathrooms, minimum square footage, and price range
3. ONLY set "readyToSearch": true when you have gathered enough criteria (at least location + one other criteria)
4. Extract location info like zip codes (78704, 78701), neighborhoods (Barton Hills, Travis Heights), or cities

BEHAVIOR FOR CMA INTAKE (intent: CMA_INTAKE):
1. First, identify the area (neighborhood, zip code, subdivision, or city). This is REQUIRED.
2. If area is ambiguous (e.g., just "Austin"), ask for a more specific area like neighborhood or zip code.
3. Once you have the area, gather optional criteria in this order (ask one at a time for voice-friendliness):
   - Square footage range (sqftMin, sqftMax)
   - Year built range (yearBuiltMin, yearBuiltMax)
   - Number of stories (1, 2, 3, or "any")
4. After gathering criteria, summarize what you have and ask: "Ready to create a CMA draft with these criteria?"
5. ONLY set "readyToCreateCmaDraft": true after the user confirms they want to create the draft
6. Never auto-create without explicit user confirmation

Your capabilities:
- Helping users search for properties (IDX_SEARCH)
- Helping agents prepare CMA criteria (CMA_INTAKE)
- Answering questions about Austin neighborhoods and market trends
- Explaining property features and real estate terminology
- Providing general guidance on the home buying/selling process
- Connecting users with a Spyglass Realty agent (set suggestAgent: true)

SCOPE LIMITATIONS:
- You CANNOT schedule showings, make appointments, or book anything
- You CANNOT access or modify user accounts or saved searches
- You CANNOT provide specific property valuations - CMAs provide market data, not valuations

Guidelines:
- Be friendly, conversational, and helpful
- Keep responses concise but warm - especially for voice input
- If user provides partial info, ask for the missing pieces
- For pricing advice beyond CMA data, recommend speaking with an agent

Respond in JSON format:
{
  "intent": "IDX_SEARCH" | "CMA_INTAKE" | "OTHER",
  "message": "Your conversational response here",
  "suggestAgent": true/false,
  "readyToSearch": true/false (only for IDX_SEARCH intent),
  "searchCriteria": {
    "location": "zip code, neighborhood, or city",
    "propertyType": "Single Family, Condo, Townhouse, etc.",
    "beds": number or null,
    "baths": number or null,
    "minSqft": number or null,
    "minPrice": number or null,
    "maxPrice": number or null
  },
  "readyToCreateCmaDraft": true/false (only for CMA_INTAKE intent, only true after user confirms),
  "cmaCriteria": {
    "area": "neighborhood, zip code, or subdivision (REQUIRED)",
    "sqftMin": number or null,
    "sqftMax": number or null,
    "yearBuiltMin": number or null,
    "yearBuiltMax": number or null,
    "stories": 1 | 2 | 3 | "any" or null
  }
}`;

export interface SearchCriteria {
  location?: string;
  propertyType?: string;
  beds?: number;
  baths?: number;
  minSqft?: number;
  minPrice?: number;
  maxPrice?: number;
}

export interface ChatResponse {
  intent: ChatIntent;
  message: string;
  suggestAgent: boolean;
  readyToSearch: boolean;
  searchCriteria?: SearchCriteria;
  readyToCreateCmaDraft: boolean;
  cmaCriteria?: CmaCriteria;
}

export async function getChatResponse(
  messages: ChatMessage[],
  propertyContext?: PropertyContext
): Promise<ChatResponse> {
  let contextMessage = "";
  
  if (propertyContext) {
    contextMessage = `\n\nCurrent property context: ${JSON.stringify(propertyContext)}`;
  }

  const systemMessage = SYSTEM_PROMPT + contextMessage;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemMessage },
        ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
      ],
      response_format: { type: "json_object" },
      max_tokens: 1024,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const parsed = JSON.parse(content);
    return {
      intent: parsed.intent || "OTHER",
      message: parsed.message || "I apologize, but I couldn't process your request. Please try again.",
      suggestAgent: parsed.suggestAgent || false,
      readyToSearch: parsed.readyToSearch || false,
      searchCriteria: parsed.searchCriteria || undefined,
      readyToCreateCmaDraft: parsed.readyToCreateCmaDraft || false,
      cmaCriteria: parsed.cmaCriteria || undefined,
    };
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    throw new Error(`Failed to get AI response: ${error.message}`);
  }
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export interface CoverLetterContext {
  subjectProperty: {
    address: string;
    price: number;
    beds: number;
    baths: number;
    sqft: number;
    description?: string;
  };
  comparables: {
    count: number;
    avgPrice: number;
    medianPrice: number;
    avgPricePerSqft: number;
    priceRange: { min: number; max: number };
  };
  marketStats: {
    avgDOM: number;
    activeCount: number;
    closedCount: number;
  };
  agentInfo: {
    name: string;
    brokerage: string;
  };
  clientName?: string;
}

export type CoverLetterTone = 'professional' | 'friendly' | 'confident';

function buildCoverLetterPrompt(context: CoverLetterContext, tone: CoverLetterTone): string {
  return `You are a real estate professional writing a cover letter for a Comparative Market Analysis (CMA) report.

Property Details:
- Address: ${context.subjectProperty.address}
- List Price: $${context.subjectProperty.price.toLocaleString()}
- Beds/Baths: ${context.subjectProperty.beds}/${context.subjectProperty.baths}
- Square Feet: ${context.subjectProperty.sqft.toLocaleString()}
${context.subjectProperty.description ? `- Description: ${context.subjectProperty.description}` : ''}

Market Analysis Summary:
- ${context.comparables.count} comparable properties analyzed
- Average Price: $${context.comparables.avgPrice.toLocaleString()}
- Median Price: $${context.comparables.medianPrice.toLocaleString()}
- Average Price/SqFt: $${Math.round(context.comparables.avgPricePerSqft)}
- Price Range: $${context.comparables.priceRange.min.toLocaleString()} - $${context.comparables.priceRange.max.toLocaleString()}
- Average Days on Market: ${context.marketStats.avgDOM} days
- Active Listings: ${context.marketStats.activeCount}
- Recently Sold: ${context.marketStats.closedCount}

Write a ${tone} cover letter that:
1. ${context.clientName ? `Addresses the client (${context.clientName}) by name` : 'Has a professional greeting'}
2. Introduces the CMA report and its purpose
3. Summarizes the key market findings in an accessible way
4. Provides context on current local market conditions
5. Explains how this analysis helps make informed real estate decisions
6. Offers to discuss the findings in more detail

Keep it concise (2-3 paragraphs) and ${tone}. Do not use overly formal language or industry jargon.
Sign off as: ${context.agentInfo.name}, ${context.agentInfo.brokerage}

Return ONLY the cover letter text, no additional formatting or explanation.`;
}

export async function generateCoverLetter(
  context: CoverLetterContext,
  tone: CoverLetterTone = 'professional'
): Promise<string> {
  const prompt = buildCoverLetterPrompt(context, tone);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: prompt }
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    return content.trim();
  } catch (error: any) {
    console.error("Cover letter generation error:", error);
    throw new Error(`Failed to generate cover letter: ${error.message}`);
  }
}

export interface DefaultCoverLetterContext {
  agentName: string;
  title?: string;
  company?: string;
  bio?: string;
  existingCoverLetter?: string;
}

function buildDefaultCoverLetterPrompt(context: DefaultCoverLetterContext, tone: CoverLetterTone): string {
  // If there's existing content, enhance it rather than generating from scratch
  if (context.existingCoverLetter && context.existingCoverLetter.trim().length > 20) {
    return `You are a professional editor helping a real estate agent improve their existing cover letter for Comparative Market Analysis (CMA) reports.

Agent Information:
- Name: ${context.agentName}
- Title: ${context.title || 'Real Estate Agent'}
- Company: ${context.company || 'our brokerage'}
${context.bio ? `- About: ${context.bio}` : ''}

Their EXISTING cover letter:
"""
${context.existingCoverLetter}
"""

Your task:
1. ENHANCE and IMPROVE this existing cover letter while preserving the agent's voice and key messages
2. Apply a ${tone} tone throughout
3. Improve clarity, flow, and professional polish
4. Keep any placeholders like [Client Name] intact
5. Keep it concise (2-3 paragraphs, ~150-200 words)
6. Do NOT add specific property details or market statistics

Tone guidelines:
- Professional: Formal, business-like, authoritative
- Friendly: Warm, personable, approachable  
- Confident: Bold, assertive, results-focused

Return ONLY the improved cover letter text. No commentary or explanations.`;
  }
  
  // Generate new cover letter from scratch
  return `You are writing a default cover letter TEMPLATE for a real estate agent to use in their Comparative Market Analysis (CMA) reports.

Agent Information:
- Name: ${context.agentName}
- Title: ${context.title || 'Real Estate Agent'}
- Company: ${context.company || 'our brokerage'}
${context.bio ? `- About: ${context.bio}` : ''}

Requirements:
1. Write a ${tone} cover letter template
2. Use [Client Name] as a placeholder for personalization
3. The letter should:
   - Thank the client for the opportunity
   - Briefly introduce the agent and their expertise
   - Explain the purpose of the CMA report
   - Offer to discuss the findings
4. Keep it concise (2-3 paragraphs, ~150-200 words)
5. Do NOT include specific property details or market statistics (those vary per CMA)
6. Make it a reusable template that works for any property

Tone guidelines:
- Professional: Formal, business-like, authoritative
- Friendly: Warm, personable, approachable
- Confident: Bold, assertive, results-focused

Write only the cover letter content. No additional commentary.`;
}

export async function generateDefaultCoverLetter(
  context: DefaultCoverLetterContext,
  tone: CoverLetterTone = 'professional'
): Promise<string> {
  const prompt = buildDefaultCoverLetterPrompt(context, tone);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    console.log("[AI] Generated default cover letter template");
    return content.trim();
  } catch (error: any) {
    console.error("Default cover letter generation error:", error);
    throw new Error(`Failed to generate default cover letter: ${error.message}`);
  }
}
