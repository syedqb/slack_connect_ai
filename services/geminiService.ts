
import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async refineMessage(message: string, tone: 'professional' | 'friendly' | 'concise' = 'professional'): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an expert communicator. Refine the following Slack message to be more ${tone}. 
      Maintain the original intent but improve clarity, grammar, and impact.
      
      Message: "${message}"
      
      Output only the refined text without any quotes or additional comments.`,
    });

    return response.text || message;
  }
}
