
import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  /**
   * Refines a message using Gemini AI.
   * Initializes the AI client locally to avoid startup crashes if process.env is unavailable.
   */
  async refineMessage(message: string, tone: 'professional' | 'friendly' | 'concise' = 'professional'): Promise<string> {
    // Safely check for process/env to prevent crashes in restricted browser environments
    const safeEnv = typeof process !== 'undefined' && process.env ? process.env : (window as any).env || {};
    const apiKey = safeEnv.API_KEY;

    if (!apiKey) {
      console.warn("Gemini Service: API_KEY is missing. Refinement disabled.");
      return message;
    }

    try {
      // Create fresh instance per request as per best practices
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are an expert communicator. Refine the following Slack message to be more ${tone}. 
        Maintain the original intent but improve clarity, grammar, and impact.
        
        Message: "${message}"
        
        Output only the refined text without any quotes or additional comments.`,
      });

      return response.text || message;
    } catch (error) {
      console.error("Gemini refinement failed:", error);
      return message;
    }
  }
}
