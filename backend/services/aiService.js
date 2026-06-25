import { pipeline, env } from '@xenova/transformers';
import axios from 'axios';

// Disable downloading models from remote if we want to strictly use local?
// By default, Transformers.js will download the model to the local cache on the first run.
// We'll use 'Xenova/whisper-tiny.en' which is very fast and small (good for real-time).
env.allowLocalModels = true;

class AIService {
  constructor() {
    this.transcriber = null;
    this.ollamaUrl = 'http://localhost:11434/api/generate';
    this.modelName = 'qwen2.5:3b'; // Updated as per user instruction
  }

  /**
   * Initializes the Whisper model (loads it into memory)
   */
  async initTranscriber() {
    if (!this.transcriber) {
      console.log('Initializing local Whisper model...');
      this.transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
      console.log('Whisper model loaded successfully.');
    }
  }

  /**
   * Transcribes a raw 16kHz PCM audio buffer (Float32Array)
   * @param {Float32Array} audioData - The 16kHz audio data
   * @returns {String} The transcribed text
   */
  async transcribeAudio(audioData) {
    if (!this.transcriber) {
      await this.initTranscriber();
    }
    try {
      const result = await this.transcriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: 'english',
        task: 'transcribe',
      });
      return result.text.trim();
    } catch (error) {
      console.error('Transcription error:', error);
      return '';
    }
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
          temperature: 0.3, // Keep it factual
        }
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
      console.error('Ollama generation error:', error.message);
      return {
        summary: "Failed to generate summary. Is Ollama running locally?",
        actionItems: []
      };
    }
  }
}

export default new AIService();
