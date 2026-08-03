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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Retry only on transient conditions — never on a bad request or bad key. */
const isRetryable = (error) => {
  const status = error?.status || error?.response?.status
  if (status) return status === 429 || status >= 500
  return /network|timeout|ECONNRESET|ETIMEDOUT|fetch failed/i.test(error?.message || '')
}

class AIService {
  constructor() {
    this.modelName = 'gemini-2.5-flash'
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-004'
  }

  isEnabled() {
    const key = process.env.GEMINI_API_KEY
    return Boolean(key) && key !== 'your_gemini_api_key_here'
  }

  client() {
    if (!this.isEnabled()) {
      throw new Error('GEMINI_API_KEY is missing or invalid')
    }
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }

  /**
   * Run a prompt that must return JSON, with bounded retries.
   * Returns the parsed object, or null when the model produced nothing usable.
   */
  async generateJSON({ prompt, temperature = 0.2, maxOutputTokens, model, attempts = 3 }) {
    let lastError

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await this.client().models.generateContent({
          model: model || this.modelName,
          contents: prompt,
          config: {
            temperature,
            responseMimeType: 'application/json',
            ...(maxOutputTokens ? { maxOutputTokens } : {}),
          },
        })
        return extractJsonObject(response.text || '')
      } catch (error) {
        lastError = error
        if (attempt === attempts || !isRetryable(error)) break
        await sleep(attempt * 1000)
      }
    }

    throw lastError || new Error('AI request failed')
  }

  /**
   * Embed a batch of texts. Returns one vector per input, in the same order.
   */
  async embed(texts) {
    if (!Array.isArray(texts) || texts.length === 0) return []

    const response = await this.client().models.embedContent({
      model: this.embeddingModel,
      contents: texts,
    })

    return (response.embeddings || []).map((e) => e.values || e)
  }

  /**
   * Answer a question using only the supplied meeting excerpts.
   */
  async answerQuestion(question, chunks) {
    const context = chunks
      .map(
        (chunk, index) =>
          `[${index + 1}] Meeting: ${chunk.meetingTitle || 'Untitled'} (${chunk.meetingDate || 'unknown date'})\n${chunk.text}`
      )
      .join('\n\n')

    const parsed = await this.generateJSON({
      prompt: `
You are answering a question using excerpts from the user's past meetings.

Return JSON only:
{ "answer": "a direct answer in 1-3 short paragraphs",
  "usedExcerpts": [1, 2],
  "confidence": 0.0 to 1.0 }

Rules:
- Use ONLY the excerpts below. Do not use outside knowledge.
- If they do not contain the answer, say so plainly in "answer" and return an empty usedExcerpts array.
- Refer to meetings by name, not by excerpt number, in the answer text.

QUESTION: ${question}

EXCERPTS:
${context}
`,
      temperature: 0.2,
      maxOutputTokens: 700,
    })

    return {
      answer: parsed?.answer || 'I could not find an answer to that in your meetings.',
      usedExcerpts: Array.isArray(parsed?.usedExcerpts) ? parsed.usedExcerpts : [],
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0,
    }
  }

  /**
   * Generates a meeting summary using Google Gemini API
   * @param {String} transcript - The full text transcript of the meeting
   * @returns {Object} structured summary data
   */
  async generateSummary(transcript, chat = '', notes = '', { throwOnError = false, copilotNotes = [] } = {}) {
    if (!transcript && !chat && !notes) {
      return DEFAULT_EMPTY_SUMMARY
    }

    // Decisions the live copilot already identified are strong grounding for
    // the final summary and cost nothing extra to include.
    const copilotBlock = copilotNotes?.length
      ? `\nObservations captured live during the meeting:\n"""\n${copilotNotes.join('\n')}\n"""\n`
      : ''

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
${copilotBlock}`

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
      // Swallowing the error here meant callers persisted a placeholder string
      // as a *successful* summary, so `generationStatus: 'failed'` was
      // unreachable and users had no way to tell a real summary from a broken
      // one. Callers that track generation status pass `throwOnError: true`.
      if (throwOnError) throw error
      return {
        ...DEFAULT_EMPTY_SUMMARY,
        summary: 'Failed to generate summary. Please check your Gemini API Key configuration.'
      }
    }
  }
}

export default new AIService()
