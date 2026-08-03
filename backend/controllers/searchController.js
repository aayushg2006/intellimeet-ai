import crypto from 'crypto';
import Meeting from '../models/Meeting.js';
import Summary from '../models/Summary.js';
import aiService from '../services/aiService.js';
import embeddingService from '../services/embeddingService.js';
import { getSearchableMeetingIds } from '../services/meetingScope.js';
import { stateStore } from '../lib/stateStore.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Extract a short excerpt around the first match, for result previews. */
const buildSnippet = (text, query, radius = 120) => {
  if (!text) return '';

  const haystack = String(text);
  const index = haystack.toLowerCase().indexOf(query.toLowerCase().split(/\s+/)[0] || '');

  if (index === -1) return haystack.slice(0, radius * 2).trim();

  const start = Math.max(0, index - radius);
  const end = Math.min(haystack.length, index + radius);

  return `${start > 0 ? '…' : ''}${haystack.slice(start, end).trim()}${end < haystack.length ? '…' : ''}`;
};

/**
 * @route GET /api/search
 * @desc  Keyword search across meetings the caller may see
 */
export const searchMeetings = async (req, res, next) => {
  try {
    const { q, organizationId, limit, offset } = req.validated.query;

    const meetingIds = await getSearchableMeetingIds(req.user._id, { organizationId });
    if (meetingIds.length === 0) {
      return res.json({ items: [], total: 0 });
    }

    // Summaries carry the transcript content; meetings cover those not yet
    // summarised, so a meeting created minutes ago is still findable by title.
    const [summaryRows, meetingRows] = await Promise.all([
      Summary.find(
        { meetingId: { $in: meetingIds }, $text: { $search: q } },
        {
          score: { $meta: 'textScore' },
          title: 1, meetingId: 1, summary: 1, conclusions: 1,
          searchBlob: 1, actionItems: 1, date: 1, createdAt: 1,
        }
      )
        .sort({ score: { $meta: 'textScore' } })
        .skip(offset)
        .limit(limit)
        .lean(),

      Meeting.find({ _id: { $in: meetingIds }, title: new RegExp(escapeRegex(q), 'i') })
        .select('_id title roomId createdAt scheduledAt status')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    const meetingById = new Map(
      (await Meeting.find({ _id: { $in: summaryRows.map((r) => r.meetingId) } })
        .select('_id title roomId createdAt status')
        .lean()).map((m) => [m._id.toString(), m])
    );

    const items = [];
    const seen = new Set();

    for (const row of summaryRows) {
      const meeting = meetingById.get(row.meetingId.toString());
      if (!meeting) continue;

      seen.add(meeting._id.toString());
      items.push({
        meetingId: meeting._id,
        roomId: meeting.roomId,
        title: row.title || meeting.title,
        date: row.date || meeting.createdAt,
        status: meeting.status,
        score: row.score,
        snippet: buildSnippet(row.summary || row.searchBlob, q),
        matchedActionItems: (row.actionItems || [])
          .filter((item) => item.task?.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 3)
          .map((item) => item.task),
        hasSummary: true,
      });
    }

    for (const meeting of meetingRows) {
      if (seen.has(meeting._id.toString())) continue;
      items.push({
        meetingId: meeting._id,
        roomId: meeting.roomId,
        title: meeting.title,
        date: meeting.scheduledAt || meeting.createdAt,
        status: meeting.status,
        score: 0,
        snippet: '',
        matchedActionItems: [],
        hasSummary: false,
      });
    }

    res.json({ items, total: items.length });
  } catch (error) {
    next(error);
  }
};

/**
 * @route POST /api/search/ask
 * @desc  Answer a natural-language question using past meeting transcripts
 */
export const askMeetings = async (req, res, next) => {
  try {
    if (!embeddingService.isSemanticSearchEnabled()) {
      return res.status(503).json({
        message: 'Semantic search is not configured on this server.',
        semanticSearchAvailable: false,
      });
    }

    const { question, organizationId } = req.body;

    const meetingIds = await getSearchableMeetingIds(req.user._id, { organizationId });
    if (meetingIds.length === 0) {
      return res.json({ answer: 'You have no meetings to search yet.', sources: [] });
    }

    // Narrow with keyword search before embedding work. This bounds the
    // fallback scorer's workload and improves precision even when Atlas vector
    // search is available.
    const candidates = await Summary.find(
      { meetingId: { $in: meetingIds }, $text: { $search: question } },
      { meetingId: 1, score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(40)
      .lean();

    // If keyword search finds nothing, fall back to the most recent meetings
    // rather than giving up — the question may be phrased very differently.
    const narrowedIds = candidates.length > 0
      ? candidates.map((c) => c.meetingId)
      : meetingIds.slice(0, 40);

    const cacheKey = `im:ask:${crypto
      .createHash('sha1')
      .update(`${question}|${organizationId || ''}|${narrowedIds.join(',')}`)
      .digest('hex')}`;

    const cached = await stateStore.get(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const startedAt = Date.now();

    const queryVector = await embeddingService.embedQuery(question);
    if (!queryVector) {
      return res.status(503).json({ message: 'Could not process that question right now.' });
    }

    const chunks = await embeddingService.searchChunks({
      queryVector,
      meetingIds: narrowedIds,
      limit: 8,
    });

    if (chunks.length === 0) {
      return res.json({
        answer: "I couldn't find anything relevant in your meeting transcripts.",
        sources: [],
      });
    }

    const { answer, usedExcerpts, confidence } = await aiService.answerQuestion(question, chunks);

    // Cite only the excerpts the model actually used, when it says.
    const cited = usedExcerpts.length > 0
      ? usedExcerpts.map((n) => chunks[n - 1]).filter(Boolean)
      : chunks.slice(0, 3);

    const payload = {
      answer,
      confidence,
      sources: cited.map((chunk) => ({
        meetingId: chunk.meetingId,
        roomId: chunk.meetingRoomId,
        title: chunk.meetingTitle,
        date: chunk.meetingDate,
        snippet: buildSnippet(chunk.text, question, 160),
        score: chunk.score,
      })),
    };

    await stateStore.set(cacheKey, payload, 300);

    console.log(
      `[Ask] user=${req.user._id} chunks=${chunks.length} latency=${Date.now() - startedAt}ms`
    );

    res.json(payload);
  } catch (error) {
    next(error);
  }
};

/**
 * @route GET /api/search/capabilities
 * @desc  Lets the UI hide features this deployment cannot provide
 */
export const getSearchCapabilities = async (req, res) => {
  res.json({
    keywordSearch: true,
    semanticSearch: embeddingService.isSemanticSearchEnabled(),
  });
};
