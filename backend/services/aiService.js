import { GoogleGenAI } from '@google/genai';

const DEFAULT_EMPTY_SUMMARY = {
  summary: 'No meaningful conversation, chat, or notes were recorded during this meeting.',
  transcriptSummary: '',
  chatSummary: '',
  notesSummary: '',
  conclusions: '',
  actionItems: []
}

const stripMarkdownNoise = (value = '') =>
  String(value)
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^(\*|-|\+|\d+[.)])\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const splitOutConclusions = (value = '') => {
  const text = String(value || '').replace(/\r\n/g, '\n').trim()
  if (!text) {
    return { body: '', conclusions: '' }
  }

  const match = text.match(/(?:^|\n)\s*(CONCLUSIONS?(?:\s*\/\s*DECISIONS?)?|DECISIONS?)\s*:\s*([\s\S]*)/i)
  if (!match) {
    return { body: stripMarkdownNoise(text), conclusions: '' }
  }

  const headingIndex = text.search(/(?:^|\n)\s*(CONCLUSIONS?(?:\s*\/\s*DECISIONS?)?|DECISIONS?)\s*:\s*/i)
  const body = headingIndex > 0 ? text.slice(0, headingIndex).trim() : ''
  const conclusions = match[2] ? match[2].trim() : ''

  return {
    body: stripMarkdownNoise(body),
    conclusions: stripMarkdownNoise(conclusions)
  }
}

const extractJsonObject = (text = '') => {
  const trimmed = String(text).trim()
  if (!trimmed) return null

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fencedMatch?.[1]?.trim() || trimmed

  const firstBrace = candidate.indexOf('{')
  const lastBrace = candidate.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null
  }

  const jsonText = candidate.slice(firstBrace, lastBrace + 1)
  try {
    return JSON.parse(jsonText)
  } catch (error) {
    return null
  }
}

const normalizeActionItems = (items) => {
  if (!Array.isArray(items)) return []

  return items
    .map((item) => {
      if (typeof item === 'string') {
        return {
          task: stripMarkdownNoise(item),
          assignee: 'Unassigned',
          status: 'pending'
        }
      }

      if (!item || typeof item !== 'object') return null

      const task = stripMarkdownNoise(item.task || item.text || item.title || '')
      if (!task) return null

      return {
        task,
        assignee: item.assignee ? stripMarkdownNoise(item.assignee) : 'Unassigned',
        status: item.status ? stripMarkdownNoise(item.status) : 'pending'
      }
    })
    .filter(Boolean)
}

class AIService {
  constructor() {
    this.modelName = 'gemini-2.5-flash'
  }

  /**
   * Generates a meeting summary using Google Gemini API
   * @param {String} transcript - The full text transcript of the meeting
   * @returns {Object} structured summary data
   */
  async generateSummary(transcript, chat = '', notes = '') {
    if (!transcript && !chat && !notes) {
      return DEFAULT_EMPTY_SUMMARY
    }

    const prompt = `
You are an expert AI meeting assistant.
Analyze the meeting transcript, chat history, and shared notes together.

Return JSON only with this exact shape:
{
  "transcriptSummary": "1-2 paragraphs about the spoken discussion",
  "chatSummary": "1 paragraph about important chat context",
  "notesSummary": "1 paragraph about important notes",
  "conclusions": "short paragraphs or bullet-style lines about decisions and conclusions",
  "actionItems": [
    { "task": "clear action item text", "assignee": "name or Unassigned", "status": "pending" }
  ]
}

Rules:
- Do not wrap the response in markdown fences.
- Do not include headings like ### or labels inside the values.
- Keep the writing concise and specific.
- If a section has nothing useful, use an empty string.

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
`

    try {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
        throw new Error('GEMINI_API_KEY is missing or invalid in .env file')
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
      console.log(`Generating AI summary with Google Gemini (${this.modelName})...`)

      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        }
      })

      const resultText = response.text || ''
      const parsed = extractJsonObject(resultText)

      const transcriptSummary = stripMarkdownNoise(parsed?.transcriptSummary || '')
      const chatSummary = stripMarkdownNoise(parsed?.chatSummary || '')
      const notesSplit = splitOutConclusions(parsed?.notesSummary || '')
      const notesSummary = notesSplit.body
      const conclusions = stripMarkdownNoise(parsed?.conclusions || notesSplit.conclusions || '')
      const actionItems = normalizeActionItems(parsed?.actionItems || [])

      const summaryParts = [
        transcriptSummary ? `Transcript Summary:\n${transcriptSummary}` : '',
        chatSummary ? `Chat Summary:\n${chatSummary}` : '',
        notesSummary ? `Notes Summary:\n${notesSummary}` : '',
      ].filter(Boolean)

      const summary = summaryParts.join('\n\n').trim() || stripMarkdownNoise(resultText)

      return {
        summary,
        transcriptSummary,
        chatSummary,
        notesSummary,
        conclusions,
        actionItems
      }
    } catch (error) {
      console.error('Gemini API generation error:', error.message)
      return {
        ...DEFAULT_EMPTY_SUMMARY,
        summary: 'Failed to generate summary. Please check your Gemini API Key configuration.'
      }
    }
  }
}

export default new AIService()
