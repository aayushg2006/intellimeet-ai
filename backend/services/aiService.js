import axios from 'axios';

class AIService {
  constructor() {
    this.ollamaUrl = 'http://localhost:11434/api/generate';
    this.modelName = 'qwen2.5:3b';
  }

  /**
   * Generates a meeting summary using local Ollama and Qwen
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
      console.log('Generating AI summary with local Ollama (qwen2.5:3b)...');
      const response = await axios.post(this.ollamaUrl, {
        model: this.modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
        }
      }, {
        timeout: 120000 // 2 minute timeout — Ollama on CPU can be slow
      });

      const resultText = response.data.response || '';
      
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
      if (error.code === 'ECONNABORTED') {
        console.error('Ollama timed out after 2 minutes.');
      } else {
        console.error('Ollama generation error:', error.message);
      }
      return {
        summary: "Failed to generate summary. Is Ollama running locally?",
        actionItems: []
      };
    }
  }
}

export default new AIService();
