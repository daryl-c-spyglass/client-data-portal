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
