import crypto from 'crypto';
import Meeting from '../models/Meeting.js';
import Summary from '../models/Summary.js';
import TranscriptChunk from '../models/TranscriptChunk.js';
import aiService from './aiService.js';
import { stateStore } from '../lib/stateStore.js';

/**
 * Embedding + vector retrieval for semantic meeting search.
 *
 * Runs against Atlas `$vectorSearch` when the cluster supports it, and falls
 * back to scoring cosine similarity in Node otherwise — a free-tier cluster
 * has no vector index, and this feature must still work there.
 */

const VECTOR_INDEX_NAME = process.env.VECTOR_INDEX_NAME || 'chunk_embedding_index';
const CHUNK_MAX_CHARS = 1200;
const OVERLAP_LINES = 1;
const MAX_CHUNKS_PER_MEETING = 120;
const MIN_TRANSCRIPT_CHARS = 400;

export const isSemanticSearchEnabled = () =>
  aiService.isEnabled() && process.env.SEMANTIC_SEARCH_ENABLED !== 'false';

/**
 * Split transcript lines into overlapping chunks of roughly CHUNK_MAX_CHARS.
 * Overlap keeps a thought that straddles a boundary retrievable from both sides.
 */
export const chunkTranscript = (lines) => {
  const chunks = [];
  let current = [];
  let currentChars = 0;
  let startLine = 0;

  const flush = (endLine) => {
    if (current.length === 0) return;
    chunks.push({ text: current.join('\n'), startLine, endLine });
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '');

    if (currentChars + line.length > CHUNK_MAX_CHARS && current.length > 0) {
      flush(i - 1);
      if (chunks.length >= MAX_CHUNKS_PER_MEETING) return chunks;

      const carry = current.slice(-OVERLAP_LINES);
      current = [...carry];
      currentChars = carry.join('\n').length;
      startLine = Math.max(0, i - carry.length);
    }

    current.push(line);
    currentChars += line.length + 1;
  }

  flush(lines.length - 1);
  return chunks.slice(0, MAX_CHUNKS_PER_MEETING);
};

/**
 * Generate and store embeddings for one meeting's transcript.
 * Safe to call repeatedly — it no-ops unless the content or model changed.
 */
export const indexMeetingTranscript = async (meetingId, { force = false } = {}) => {
  if (!isSemanticSearchEnabled()) return { skipped: true, reason: 'disabled' };

  const summary = await Summary.findOne({ meetingId }).select('transcript title date').lean();
  const transcript = summary?.transcript || [];

  if (transcript.join('\n').length < MIN_TRANSCRIPT_CHARS) {
    return { skipped: true, reason: 'transcript-too-short' };
  }

  const model = aiService.embeddingModel;

  if (!force) {
    const existing = await TranscriptChunk.findOne({ meetingId }).select('embeddingModel').lean();
    if (existing && existing.embeddingModel === model) {
      return { skipped: true, reason: 'already-indexed' };
    }
  }

  const meeting = await Meeting.findById(meetingId).select('title roomId organizationId createdAt').lean();
  if (!meeting) return { skipped: true, reason: 'meeting-not-found' };

  const chunks = chunkTranscript(transcript);
  if (chunks.length === 0) return { skipped: true, reason: 'no-chunks' };

  const vectors = await aiService.embed(chunks.map((c) => c.text));

  // Replace wholesale: a re-index must not leave stale chunks behind.
  await TranscriptChunk.deleteMany({ meetingId });

  await TranscriptChunk.insertMany(
    chunks.map((chunk, index) => ({
      meetingId,
      organizationId: meeting.organizationId || null,
      meetingTitle: meeting.title,
      meetingRoomId: meeting.roomId,
      meetingDate: summary?.date || meeting.createdAt?.toISOString().split('T')[0] || '',
      chunkIndex: index,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      text: chunk.text,
      embedding: vectors[index],
      embeddingModel: model,
      dims: vectors[index]?.length || 0,
    })),
    { ordered: false }
  );

  console.log(`[Embeddings] Indexed ${chunks.length} chunks for meeting ${meetingId}`);
  return { chunks: chunks.length };
};

/**
 * Embed a search question, with a short cache so repeated queries are free.
 */
export const embedQuery = async (question) => {
  const cacheKey = `im:qvec:${crypto.createHash('sha1').update(question).digest('hex')}`;

  const cached = await stateStore.get(cacheKey);
  if (cached) return cached;

  const [vector] = await aiService.embed([question]);
  if (vector) await stateStore.set(cacheKey, vector, 600);

  return vector || null;
};

/**
 * Detect whether this cluster supports `$vectorSearch`.
 *
 * Probing is the only reliable test — the connection string doesn't tell you
 * whether the search index exists. Cached briefly so creating the index later
 * gets picked up without a redeploy.
 */
export const vectorSearchAvailable = async (dims = 768) => {
  const cached = await stateStore.get('im:vs:available');
  if (cached !== null && cached !== undefined) return cached;

  let available = false;
  try {
    await TranscriptChunk.aggregate([
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: 'embedding',
          queryVector: new Array(dims).fill(0),
          numCandidates: 1,
          limit: 1,
        },
      },
    ]);
    available = true;
  } catch (error) {
    // 40324 = unrecognised pipeline stage (not Atlas, or too old).
    // Anything else here means Atlas but no index defined.
    available = false;
    console.log(`[Embeddings] $vectorSearch unavailable (${error.codeName || error.message}); using in-process scoring`);
  }

  await stateStore.set('im:vs:available', available, 1800);
  return available;
};

const cosineSimilarity = (a, b) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
};

/**
 * Retrieve the most relevant chunks for a query vector, restricted to meetings
 * the caller may see.
 *
 * `meetingIds` is expected to be pre-narrowed (typically by keyword search) so
 * the fallback path scores hundreds of chunks rather than the whole collection.
 */
export const searchChunks = async ({ queryVector, meetingIds, limit = 8 }) => {
  if (!queryVector?.length || !meetingIds?.length) return [];

  if (await vectorSearchAvailable(queryVector.length)) {
    try {
      return await TranscriptChunk.aggregate([
        {
          $vectorSearch: {
            index: VECTOR_INDEX_NAME,
            path: 'embedding',
            queryVector,
            numCandidates: Math.max(limit * 20, 100),
            limit,
            filter: { meetingId: { $in: meetingIds } },
          },
        },
        {
          $project: {
            text: 1, meetingId: 1, meetingTitle: 1, meetingRoomId: 1,
            meetingDate: 1, chunkIndex: 1, score: { $meta: 'vectorSearchScore' },
          },
        },
      ]);
    } catch (error) {
      console.warn('[Embeddings] $vectorSearch failed, falling back:', error.message);
    }
  }

  // Fallback: score in Node. Bounded by the pre-narrowed meeting set.
  const candidates = await TranscriptChunk.find({
    meetingId: { $in: meetingIds },
    dims: queryVector.length,
  })
    .select('text meetingId meetingTitle meetingRoomId meetingDate chunkIndex embedding')
    .limit(1500)
    .lean();

  return candidates
    .map((chunk) => ({ ...chunk, embedding: undefined, score: cosineSimilarity(queryVector, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

export default {
  isSemanticSearchEnabled,
  indexMeetingTranscript,
  chunkTranscript,
  embedQuery,
  searchChunks,
  vectorSearchAvailable,
};
