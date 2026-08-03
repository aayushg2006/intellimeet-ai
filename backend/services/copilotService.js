import crypto from 'crypto';
import aiService from './aiService.js';
import { stateStore } from '../lib/stateStore.js';
import { keys, TTL } from '../lib/stateKeys.js';

/**
 * Live meeting copilot.
 *
 * Watches the transcript as it streams in and surfaces decisions, action items,
 * questions and risks while the meeting is still happening.
 *
 * Two properties matter most here:
 *
 *  1. It runs ONCE PER ROOM, server-side. The transcript already funnels through
 *     a single socket handler, so analysing there costs one LLM call per room.
 *     Doing it client-side would multiply cost by participant count and give
 *     every participant a different panel.
 *
 *  2. Every path is bounded. This is a continuous LLM cost attached to a live
 *     meeting, so runs per meeting, meeting duration, window size and global
 *     concurrency are all hard-capped.
 */

const CONFIG = {
  // Never analyse more often than this, whatever the trigger says.
  minIntervalMs: 20_000,
  // Analyse once this many new lines have accumulated...
  linesPerRun: 12,
  // ...or after this long, provided at least a few lines arrived.
  idleTriggerMs: 45_000,
  idleMinLines: 4,
  // Lines of trailing context sent to the model. Never the whole transcript.
  windowLines: 40,
  // Absolute ceilings.
  maxRunsPerMeeting: Number(process.env.COPILOT_MAX_RUNS_PER_MEETING || 40),
  maxMeetingMinutes: Number(process.env.COPILOT_MAX_MEETING_MINUTES || 120),
  maxItemsPerMeeting: 60,
  minLinesToStart: 6,
  minConfidence: 0.5,
  // Process-wide in-flight limit, protecting a single small dyno.
  maxConcurrent: 3,
};

let inFlight = 0;

export const isCopilotEnabled = () =>
  Boolean(process.env.GEMINI_API_KEY) && process.env.COPILOT_ENABLED !== 'false';

const defaultState = () => ({
  firstLineAt: Date.now(),
  lastRunAt: 0,
  runs: 0,
  linesSeen: 0,
  linesAtLastRun: 0,
  consecutiveFailures: 0,
  cooldownUntil: 0,
  status: 'idle',
});

/**
 * Normalise an insight for duplicate detection.
 * Lowercases, strips punctuation and filler words, and truncates — so
 * "We should ship on Friday." and "ship on friday" collapse together.
 */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'we', 'i', 'will', 'should', 'need', 'needs', 'is',
  'are', 'be', 'and', 'or', 'that', 'this', 'of', 'for', 'on', 'in', 'it',
]);

const normalizeText = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !STOPWORDS.has(word))
    .join(' ')
    .slice(0, 80);

const hashItem = (kind, text) =>
  crypto.createHash('sha1').update(`${kind}|${normalizeText(text)}`).digest('hex');

/** Token-set Jaccard similarity, for near-duplicates the hash misses. */
const similarity = (a, b) => {
  const setA = new Set(normalizeText(a).split(' ').filter(Boolean));
  const setB = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;

  return shared / (setA.size + setB.size - shared);
};

const shouldRun = (state) => {
  const sinceRun = Date.now() - state.lastRunAt;
  const newLines = state.linesSeen - state.linesAtLastRun;

  if (sinceRun < CONFIG.minIntervalMs) return false;

  return newLines >= CONFIG.linesPerRun || (newLines >= CONFIG.idleMinLines && sinceRun >= CONFIG.idleTriggerMs);
};

const buildPrompt = (windowLines, alreadySurfaced) => `
You are an assistant listening to a live meeting.

Return JSON only, in this exact shape:
{
  "items": [
    { "kind": "decision" | "action" | "question" | "risk",
      "text": "at most 140 characters; phrase actions as imperatives",
      "assignee": "name or null",
      "confidence": 0.0 to 1.0 }
  ]
}

Rules:
- Report only what is explicitly supported by the transcript. Never speculate.
- Do NOT repeat anything in ALREADY SURFACED, even if reworded.
- Return an empty items array if nothing new and concrete has been decided or assigned.
- At most 4 items.

ALREADY SURFACED:
${alreadySurfaced.length ? alreadySurfaced.map((t, i) => `${i + 1}. ${t.slice(0, 100)}`).join('\n') : '(nothing yet)'}

RECENT TRANSCRIPT:
"""
${windowLines.join('\n')}
"""
`;

/**
 * Called for every transcript line. Cheap in the common case — one state read
 * and an arithmetic check — and only occasionally does real work.
 */
const onTranscriptLine = async (io, roomId) => {
  if (!isCopilotEnabled()) return;

  const state = (await stateStore.get(keys.copilotState(roomId))) || defaultState();
  state.linesSeen += 1;

  if (state.status === 'disabled') {
    await stateStore.set(keys.copilotState(roomId), state, TTL.MEETING);
    return;
  }

  const meetingMinutes = (Date.now() - state.firstLineAt) / 60_000;
  const exhausted =
    state.runs >= CONFIG.maxRunsPerMeeting || meetingMinutes > CONFIG.maxMeetingMinutes;

  if (
    exhausted ||
    state.linesSeen < CONFIG.minLinesToStart ||
    Date.now() < state.cooldownUntil ||
    !shouldRun(state)
  ) {
    await stateStore.set(keys.copilotState(roomId), state, TTL.MEETING);
    return;
  }

  if (inFlight >= CONFIG.maxConcurrent) {
    // Skip this tick rather than queueing — the next line will retry.
    await stateStore.set(keys.copilotState(roomId), state, TTL.MEETING);
    return;
  }

  // Only one instance analyses a given room at a time.
  const lock = await stateStore.acquireLock(keys.copilotLock(roomId), 25_000);
  if (!lock) {
    await stateStore.set(keys.copilotState(roomId), state, TTL.MEETING);
    return;
  }

  state.lastRunAt = Date.now();
  state.linesAtLastRun = state.linesSeen;
  state.runs += 1;
  await stateStore.set(keys.copilotState(roomId), state, TTL.MEETING);

  inFlight += 1;
  io.to(roomId).emit('copilot:status', { roomId, state: 'thinking' });

  try {
    const windowLines = await stateStore.listRange(keys.transcript(roomId), -CONFIG.windowLines);
    if (!windowLines?.length) return;

    const existing = (await stateStore.get(keys.copilotItems(roomId))) || [];
    const parsed = await aiService.generateJSON({
      prompt: buildPrompt(windowLines, existing.slice(-20).map((i) => i.text)),
      temperature: 0.1,
      maxOutputTokens: 500,
    });

    if (!parsed) {
      // Unparseable output is a soft failure — skip quietly.
      io.to(roomId).emit('copilot:status', { roomId, state: 'idle' });
      return;
    }

    const fresh = await filterNewItems(roomId, parsed.items || [], existing);

    if (fresh.length > 0) {
      const updated = [...existing, ...fresh].slice(-CONFIG.maxItemsPerMeeting);
      await stateStore.set(keys.copilotItems(roomId), updated, TTL.MEETING);
      io.to(roomId).emit('copilot:insights', {
        roomId,
        generatedAt: new Date().toISOString(),
        items: fresh,
      });
    }

    // Success resets the failure streak.
    const after = (await stateStore.get(keys.copilotState(roomId))) || state;
    after.consecutiveFailures = 0;
    after.status = 'idle';
    await stateStore.set(keys.copilotState(roomId), after, TTL.MEETING);

    io.to(roomId).emit('copilot:status', { roomId, state: 'idle' });
  } catch (error) {
    await handleFailure(io, roomId, error);
  } finally {
    inFlight -= 1;
    await stateStore.releaseLock(keys.copilotLock(roomId), lock);
  }
};

/**
 * Drop anything we've already surfaced.
 *
 * The prompt asks the model not to repeat itself, but that's a hint, not a
 * guarantee — so dedupe is enforced here, twice: an exact hash for
 * reformattings, and a similarity check for rewordings.
 */
const filterNewItems = async (roomId, items, existing) => {
  const fresh = [];

  for (const item of Array.isArray(items) ? items.slice(0, 4) : []) {
    const text = String(item?.text || '').trim().slice(0, 140);
    const kind = ['decision', 'action', 'question', 'risk'].includes(item?.kind) ? item.kind : 'decision';
    const confidence = typeof item?.confidence === 'number' ? item.confidence : 0.6;

    if (!text || confidence < CONFIG.minConfidence) continue;

    const hash = hashItem(kind, text);
    if (await stateStore.sismember(keys.copilotHashes(roomId), hash)) continue;

    const isNearDuplicate = [...existing, ...fresh].some(
      (prev) => prev.kind === kind && similarity(prev.text, text) >= 0.72
    );
    if (isNearDuplicate) continue;

    await stateStore.sadd(keys.copilotHashes(roomId), hash, TTL.MEETING);

    fresh.push({
      id: hash.slice(0, 12),
      kind,
      text,
      assignee: item?.assignee && item.assignee !== 'null' ? String(item.assignee).slice(0, 60) : null,
      confidence,
    });
  }

  return fresh;
};

const handleFailure = async (io, roomId, error) => {
  console.error(`[Copilot] Analysis failed for ${roomId}:`, error.message);

  const state = (await stateStore.get(keys.copilotState(roomId))) || defaultState();
  state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;

  if (state.consecutiveFailures >= 3) {
    state.status = 'disabled';
    await stateStore.set(keys.copilotState(roomId), state, TTL.MEETING);
    io.to(roomId).emit('copilot:status', {
      roomId,
      state: 'disabled',
      reason: 'The live assistant is unavailable for this meeting.',
    });
    return;
  }

  // Back off 60s, 120s, capped at 5 minutes.
  const backoff = Math.min(60_000 * 2 ** (state.consecutiveFailures - 1), 300_000);
  state.cooldownUntil = Date.now() + backoff;
  await stateStore.set(keys.copilotState(roomId), state, TTL.MEETING);

  io.to(roomId).emit('copilot:status', { roomId, state: 'error', reason: 'temporary' });
};

/**
 * Full snapshot for a late joiner or a reconnecting client — `copilot:insights`
 * only carries the delta, so without this a rejoining user sees an empty panel.
 */
const getSnapshot = async (roomId) => {
  const [items, state] = await Promise.all([
    stateStore.get(keys.copilotItems(roomId)),
    stateStore.get(keys.copilotState(roomId)),
  ]);

  return {
    roomId,
    items: items || [],
    status: state?.status || (isCopilotEnabled() ? 'idle' : 'disabled'),
  };
};

/** Plain texts of the decisions/actions found, for the end-of-meeting summary. */
const getInsightTexts = async (roomId) => {
  const items = (await stateStore.get(keys.copilotItems(roomId))) || [];
  return items
    .filter((item) => item.kind === 'decision' || item.kind === 'action')
    .map((item) => `${item.kind}: ${item.text}${item.assignee ? ` (${item.assignee})` : ''}`);
};

const resetRoom = async (roomId) => {
  await stateStore.del(keys.copilotState(roomId));
  await stateStore.del(keys.copilotItems(roomId));
  await stateStore.del(keys.copilotHashes(roomId));
};

export default { onTranscriptLine, getSnapshot, getInsightTexts, resetRoom, isCopilotEnabled };
export { onTranscriptLine, getSnapshot, getInsightTexts, resetRoom, CONFIG, similarity, hashItem };
