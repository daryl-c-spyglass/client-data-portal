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

const SYSTEM_PROMPT = `You are a helpful real estate assistant for Spyglass Realty in Austin, Texas. You help potential home buyers find their perfect home through a conversational search experience.

IMPORTANT BEHAVIOR FOR PROPERTY SEARCHES:
When a user wants to search for properties (mentions searching, looking for homes, wants to find listings, etc.):
1. FIRST, acknowledge their interest and ask qualifying questions to refine their search
2. Ask about: bedrooms, bathrooms, minimum square footage, and price range
3. You can ask multiple questions at once to be efficient, e.g. "Great! To help you find the perfect home, could you tell me:
   - How many bedrooms and bathrooms do you need?
   - What's your minimum square footage preference?
   - What price range are you considering?"
4. ONLY set "readyToSearch": true when you have gathered enough criteria (at least location + one other criteria like beds, price, or sqft)
5. Extract any location info like zip codes (78704, 78701, etc.), neighborhoods (Barton Hills, Travis Heights, etc.), or cities

Your other capabilities:
- Answering questions about Austin neighborhoods and market trends
- Explaining property features and real estate terminology
- Guiding users on the home buying/selling process
- Connecting users with a Spyglass Realty agent

Guidelines:
- Be friendly, conversational, and helpful
- Keep responses concise but warm
- If user provides partial info, ask for the missing pieces before searching
- For pricing advice or valuations, recommend speaking with an agent

Respond in JSON format:
{
  "message": "Your conversational response here",
  "suggestAgent": true/false,
  "readyToSearch": true/false (only true when you have enough search criteria),
  "searchCriteria": {
    "location": "zip code, neighborhood, or city mentioned",
    "propertyType": "Single Family, Condo, Townhouse, etc. if mentioned",
    "beds": number or null,
    "baths": number or null,
    "minSqft": number or null,
    "minPrice": number or null,
    "maxPrice": number or null
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

export async function getChatResponse(
  messages: ChatMessage[],
  propertyContext?: PropertyContext
): Promise<{
  message: string;
  suggestAgent: boolean;
  readyToSearch: boolean;
  searchCriteria?: SearchCriteria;
}> {
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
      message: parsed.message || "I apologize, but I couldn't process your request. Please try again.",
      suggestAgent: parsed.suggestAgent || false,
      readyToSearch: parsed.readyToSearch || false,
      searchCriteria: parsed.searchCriteria || undefined,
    };
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    throw new Error(`Failed to get AI response: ${error.message}`);
  }
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
