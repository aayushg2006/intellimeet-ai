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
  async generateSummary(transcript, chat = '', notes = '') {
    if (!transcript && !chat && !notes) {
      return {
        summary: "No meaningful conversation, chat, or notes were recorded during this meeting.",
        actionItems: []
      };
    }

    const prompt = `
You are an expert AI meeting assistant. Below is the transcript, chat history, and shared notes of a meeting. 
Please analyze all sources and provide a clean, precisely explained summary so that anyone can understand it, and a list of action items.

Format your response exactly like this, using exactly these headers:
TRANSCRIPT SUMMARY:
(1-2 paragraphs summarizing the spoken transcript)

CHAT SUMMARY:
(1-2 paragraphs summarizing the chat messages)

NOTES SUMMARY:
(1-2 paragraphs summarizing the shared notes)

ACTION ITEMS:
- [Assignee Name if any] Action item description
- [Assignee Name if any] Action item description

Meeting Transcript:
"""
${transcript || '(No transcript)'}
"""

Chat Messages:
"""
${chat || '(No chat messages)'}
"""

Shared Notes:
"""
${notes || '(No shared notes)'}
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
      let transcriptSummary = '';
      let chatSummary = '';
      let notesSummary = '';
      let actionItems = [];

      const tMatch = resultText.match(/TRANSCRIPT SUMMARY:\s*([\s\S]*?)(?=CHAT SUMMARY:|$)/i);
      if (tMatch && tMatch[1]) transcriptSummary = tMatch[1].trim();

      const cMatch = resultText.match(/CHAT SUMMARY:\s*([\s\S]*?)(?=NOTES SUMMARY:|$)/i);
      if (cMatch && cMatch[1]) chatSummary = cMatch[1].trim();

      const nMatch = resultText.match(/NOTES SUMMARY:\s*([\s\S]*?)(?=ACTION ITEMS:|$)/i);
      if (nMatch && nMatch[1]) notesSummary = nMatch[1].trim();

      const actionItemsMatch = resultText.match(/ACTION ITEMS:\s*([\s\S]*)/i);
      if (actionItemsMatch && actionItemsMatch[1]) {
        const items = actionItemsMatch[1].split('\n').map(line => line.trim()).filter(line => line.startsWith('-'));
        actionItems = items.map(item => item.replace(/^-?\s*/, ''));
      }

      let summary = '';
      if (transcriptSummary) summary += `### Transcript Summary\n${transcriptSummary}\n\n`;
      if (chatSummary) summary += `### Chat Summary\n${chatSummary}\n\n`;
      if (notesSummary) summary += `### Notes Summary\n${notesSummary}\n\n`;

      // Fallback if parsing fails
      if (!summary.trim() && !actionItems.length) {
        summary = resultText;
      }

      return { summary: summary.trim(), actionItems };
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
