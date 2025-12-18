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

const SYSTEM_PROMPT = `You are a helpful real estate assistant for Spyglass Realty in Austin, Texas. You help potential home buyers and sellers with property inquiries, market information, and connecting with agents.

Your capabilities include:
- Answering questions about properties and listings
- Providing general real estate market insights for Austin and surrounding areas
- Helping users understand property features and neighborhoods
- Guiding users on the home buying/selling process
- Connecting users with a Spyglass Realty agent for personalized assistance

Guidelines:
- Be friendly, professional, and concise
- If asked about specific property details you don't have, suggest they use the search feature or speak with an agent
- For pricing advice or specific valuations, recommend speaking with an agent
- Always be helpful but never make promises about prices or market predictions
- If a user seems ready to buy/sell, offer to connect them with a Spyglass agent

Respond in JSON format with the following structure:
{
  "message": "Your response text here",
  "suggestAgent": true/false (whether to suggest connecting with an agent),
  "searchQuery": null or { city, beds, baths, minPrice, maxPrice, status } (if user is asking about properties to search)
}`;

export async function getChatResponse(
  messages: ChatMessage[],
  propertyContext?: PropertyContext
): Promise<{
  message: string;
  suggestAgent: boolean;
  searchQuery?: {
    city?: string;
    beds?: number;
    baths?: number;
    minPrice?: number;
    maxPrice?: number;
    status?: string;
  };
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
      searchQuery: parsed.searchQuery || undefined,
    };
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    throw new Error(`Failed to get AI response: ${error.message}`);
  }
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
