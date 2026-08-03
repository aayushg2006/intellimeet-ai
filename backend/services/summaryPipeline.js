import Meeting from '../models/Meeting.js';
import Message from '../models/Message.js';
import Summary from '../models/Summary.js';
import Task from '../models/Task.js';
import aiService from './aiService.js';
import copilotService from './copilotService.js';
import { notify, resolveMeetingRecipients } from './notificationService.js';
import { indexMeetingTranscript } from './embeddingService.js';
import { stateStore } from '../lib/stateStore.js';
import { keys } from '../lib/stateKeys.js';

/**
 * Generate the AI summary for a finished meeting, create tasks from its action
 * items, and notify participants.
 *
 * Extracted from the socket `end-meeting` handler so the manual
 * "regenerate summary" endpoint and the stale-job reaper run exactly the same
 * code path rather than three subtly different copies.
 *
 * Concurrency is handled with an atomic claim on the Summary document, so two
 * callers (or two server instances) can never generate the same summary twice.
 */
export const runSummaryPipeline = async ({ io, meetingId, roomId, force = false }) => {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) return { status: 'meeting-not-found' };

  const resolvedRoomId = roomId || meeting.roomId;

  // Make sure a Summary row exists before we try to claim it.
  await Summary.updateOne(
    { meetingId: meeting._id },
    {
      $setOnInsert: {
        meetingId: meeting._id,
        organizationId: meeting.organizationId,
        title: meeting.title,
        date: meeting.createdAt.toISOString().split('T')[0],
      },
    },
    { upsert: true }
  );

  // Atomic compare-and-set: only one caller transitions the row into
  // 'generating'. Works across instances without needing a distributed lock.
  const claimable = force
    ? ['pending', 'failed', 'completed', 'generating']
    : ['pending', 'failed'];

  const claimed = await Summary.findOneAndUpdate(
    { meetingId: meeting._id, generationStatus: { $in: claimable } },
    {
      $set: {
        generationStatus: 'generating',
        generationStartedAt: new Date(),
        generationError: '',
      },
      $inc: { generationAttempts: 1 },
    },
    { new: true }
  );

  if (!claimed) {
    return { status: 'already-running-or-complete' };
  }

  try {
    // Prefer the persisted transcript; fall back to whatever is still buffered.
    const buffered = await stateStore.listRange(keys.transcript(resolvedRoomId));
    const transcript = claimed.transcript?.length ? claimed.transcript : buffered || [];

    const messages = await Message.find({ roomId: resolvedRoomId }).populate('sender', 'name');
    const chatText = messages.map((m) => `${m.sender?.name || 'User'}: ${m.text}`).join('\n');
    const notesText = meeting.notes || '';

    const hasContent = Boolean(transcript.length || chatText.trim() || notesText.trim());

    if (!hasContent) {
      await Summary.updateOne(
        { _id: claimed._id },
        {
          $set: {
            generationStatus: 'failed',
            generationError: 'No transcript, chat, or notes were captured for this meeting.',
          },
        }
      );
      await cleanupRoomState(resolvedRoomId);
      return { status: 'no-content' };
    }

    // Anything the live copilot already surfaced is good grounding for the
    // final summary, and costs nothing extra to include.
    const copilotNotes = await copilotService.getInsightTexts(resolvedRoomId);

    console.log(`[AI] Generating summary for meeting ${resolvedRoomId}...`);

    const {
      summary,
      transcriptSummary,
      chatSummary,
      notesSummary,
      conclusions,
      actionItems,
    } = await aiService.generateSummary(
      transcript.join('\n'),
      chatText,
      notesText,
      { throwOnError: true, copilotNotes }
    );

    const storedActionItems = await createTasksForActionItems({
      actionItems,
      meeting,
    });

    await Summary.updateOne(
      { _id: claimed._id },
      {
        $set: {
          transcript,
          summary,
          transcriptSummary: transcriptSummary || '',
          chatSummary: chatSummary || '',
          notesSummary: notesSummary || '',
          conclusions: conclusions || '',
          generationStatus: 'completed',
          generationError: '',
          generatedAt: new Date(),
          actionItems: storedActionItems,
          searchBlob: buildSearchBlob({ meeting, summary, conclusions, storedActionItems, transcript }),
        },
      }
    );

    console.log(`[AI] Summary and tasks saved for meeting ${resolvedRoomId}.`);

    // Both of these are best-effort: neither should be able to mark a
    // successfully generated summary as failed.
    notifyParticipants({ io, meeting }).catch((err) =>
      console.error('[Summary] notify failed:', err.message)
    );
    indexMeetingTranscript(meeting._id).catch((err) =>
      console.error('[Summary] embedding index failed:', err.message)
    );

    await cleanupRoomState(resolvedRoomId);

    return { status: 'completed', summaryId: claimed._id };
  } catch (error) {
    console.error(`[AI] Summary generation failed for ${resolvedRoomId}:`, error.message);
    await Summary.updateOne(
      { _id: claimed._id },
      {
        $set: {
          generationStatus: 'failed',
          generationError: error.message || 'Failed to generate summary.',
        },
      }
    );
    return { status: 'failed', error: error.message };
  }
};

/**
 * Turn each AI action item into a real Task so it lands on the Kanban board.
 */
const createTasksForActionItems = async ({ actionItems, meeting }) => {
  if (!actionItems?.length) return [];

  const stored = [];

  for (let index = 0; index < actionItems.length; index += 1) {
    const item = actionItems[index];
    const taskText = item.task || '';
    if (!taskText) continue;

    const base = {
      id: index + 1,
      task: taskText,
      assignee: item.assignee || 'Unassigned',
      status: item.status || 'pending',
      meetingTitle: meeting.title,
    };

    try {
      const createdTask = await Task.create({
        title: taskText.substring(0, 50) + (taskText.length > 50 ? '...' : ''),
        description: taskText,
        status: 'Todo',
        priority: 'medium',
        meetingId: meeting._id,
        meetingTitle: meeting.title,
        organizationId: meeting.organizationId,
        assignee: null,
      });
      stored.push({ ...base, taskId: createdTask._id.toString() });
    } catch (e) {
      console.error('[AI] Failed to create task for action item:', e.message);
      // Keep the action item in the summary even if the task write failed.
      stored.push(base);
    }
  }

  return stored;
};

/**
 * Denormalised text blob backing keyword search.
 *
 * The full transcript is deliberately truncated: text-index entries are
 * generated per token, and indexing multi-hour transcripts wholesale can
 * exhaust the index budget on a small Atlas tier.
 */
const buildSearchBlob = ({ meeting, summary, conclusions, storedActionItems, transcript }) => {
  const HEAD_TAIL_LINES = 200;
  const transcriptSlice =
    transcript.length <= HEAD_TAIL_LINES * 2
      ? transcript
      : [...transcript.slice(0, HEAD_TAIL_LINES), ...transcript.slice(-HEAD_TAIL_LINES)];

  return [
    meeting.title,
    meeting.description || '',
    summary || '',
    conclusions || '',
    (storedActionItems || []).map((i) => i.task).join('\n'),
    transcriptSlice.join('\n'),
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 20000);
};

const notifyParticipants = async ({ io, meeting }) => {
  const userIds = await resolveMeetingRecipients(meeting);
  if (!userIds.length) return;

  await notify({
    io,
    userIds,
    type: 'summary_ready',
    title: 'Meeting summary ready',
    body: `The AI summary for "${meeting.title}" is available.`,
    link: `/meeting/${meeting.roomId}/summary`,
    entityKind: 'summary',
    entityId: meeting._id.toString(),
    organizationId: meeting.organizationId,
    // One notification per meeting, however many times generation is retried.
    dedupeKeyFor: (userId) => `summary_ready:${meeting._id}:${userId}`,
  });
};

const cleanupRoomState = async (roomId) => {
  await stateStore.del(keys.transcript(roomId));
  await stateStore.del(keys.summaryDoc(roomId));
  await stateStore.del(keys.waiting(roomId));
  await stateStore.del(keys.roomMeta(roomId));
  await copilotService.resetRoom(roomId);
};

export default { runSummaryPipeline };
