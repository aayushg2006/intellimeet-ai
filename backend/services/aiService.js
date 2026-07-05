import { GoogleGenAI } from '@google/genai';

class AIService {
  constructor() {
    this.modelName = 'gemini-2.5-flash'; // Fast, cost-effective model, great for free tier
  }

  /**
   * Generates a meeting summary using Google Gemini API
   * @param {String} transcript - The full text transcript of the meeting
   * @returns {Object} { summary, actionItems }
   */
  async generateSummary(transcript) {
    if (!transcript || transcript.trim().length === 0) {
      return {
        summary: "No meaningful conversation was transcribed during this meeting.",
        actionItems: []
      };
    }

    const prompt = `
You are an expert AI meeting assistant. Below is the transcript of a meeting. 
Please analyze the transcript and provide a concise summary and a list of action items.

Format your response exactly like this, using exactly these headers:
SUMMARY:
(2-3 paragraphs summarizing the key points of the meeting)

ACTION ITEMS:
- [Assignee Name if any] Action item description
- [Assignee Name if any] Action item description

Meeting Transcript:
"""
${transcript}
"""
`;

    try {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
        throw new Error("GEMINI_API_KEY is missing or invalid in .env file");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      console.log(`Generating AI summary with Google Gemini (${this.modelName})...`);
      
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          temperature: 0.3,
        }
      });

      const resultText = response.text || '';
      
      // Parse the result
      let summary = '';
      let actionItems = [];

      const summaryMatch = resultText.match(/SUMMARY:\s*([\s\S]*?)(?=ACTION ITEMS:|$)/i);
      if (summaryMatch && summaryMatch[1]) {
        summary = summaryMatch[1].trim();
      }

      const actionItemsMatch = resultText.match(/ACTION ITEMS:\s*([\s\S]*)/i);
      if (actionItemsMatch && actionItemsMatch[1]) {
        const items = actionItemsMatch[1].split('\n').map(line => line.trim()).filter(line => line.startsWith('-'));
        actionItems = items.map(item => item.replace(/^-?\s*/, ''));
      }

      // Fallback if parsing fails
      if (!summary && !actionItems.length) {
        summary = resultText;
      }

      return { summary, actionItems };
    } catch (error) {
      console.error('Gemini API generation error:', error.message);
      return {
        summary: "Failed to generate summary. Please check your Gemini API Key configuration.",
        actionItems: []
      };
    }
  }
}

export default new AIService();
