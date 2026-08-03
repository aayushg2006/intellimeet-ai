import Notification from '../models/Notification.js';
import Team from '../models/Team.js';
import User from '../models/User.js';

/**
 * Hard cap on how many people a single event may notify.
 *
 * Without this, ending a meeting in a 500-person organization would write 500
 * documents and emit 500 socket events synchronously.
 */
const MAX_RECIPIENTS = 200;

const toIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

/**
 * Create notifications and push them to any connected sessions of each user.
 *
 * This never throws: a notification is a side effect of some other operation
 * (updating a task, ending a meeting), and failing to deliver one must not fail
 * the operation that triggered it. Callers still `.catch()` for safety.
 */
export const notify = async ({
  io,
  userIds,
  type,
  title,
  body = '',
  link = '',
  actor = null,
  organizationId = null,
  entityKind = null,
  entityId = '',
  dedupeKeyFor = null,
}) => {
  try {
    const actorId = toIdString(actor);

    const recipients = [...new Set((userIds || []).map(toIdString).filter(Boolean))]
      // Never notify someone about their own action.
      .filter((id) => id !== actorId);

    if (recipients.length === 0) return [];

    if (recipients.length > MAX_RECIPIENTS) {
      console.warn(
        `[Notify] ${type} fan-out of ${recipients.length} truncated to ${MAX_RECIPIENTS}`
      );
      recipients.length = MAX_RECIPIENTS;
    }

    const docs = recipients.map((userId) => ({
      userId,
      type,
      title,
      body,
      link,
      actorId: actorId || undefined,
      actorName: actor?.name || '',
      organizationId,
      entityKind,
      entityId: entityId ? String(entityId) : '',
      ...(dedupeKeyFor ? { dedupeKey: dedupeKeyFor(userId) } : {}),
    }));

    let created = [];
    try {
      // `ordered: false` keeps going past duplicates rather than aborting the
      // batch on the first one.
      created = await Notification.insertMany(docs, { ordered: false });
    } catch (error) {
      if (error.code === 11000 || error.writeErrors) {
        // Some were duplicates (already notified) — keep whatever inserted.
        created = error.insertedDocs || [];
      } else {
        throw error;
      }
    }

    if (io) {
      for (const doc of created) {
        io.to(`user_${doc.userId}`).emit('notification:new', shapeForClient(doc));
      }
    }

    return created;
  } catch (error) {
    console.error('[Notify] Failed to create notifications:', error.message);
    return [];
  }
};

export const shapeForClient = (doc) => ({
  _id: doc._id,
  type: doc.type,
  title: doc.title,
  body: doc.body,
  link: doc.link,
  read: doc.read,
  actorName: doc.actorName,
  entityKind: doc.entityKind,
  entityId: doc.entityId,
  createdAt: doc.createdAt,
});

/**
 * Who should hear about something that happened in a meeting.
 *
 * Deliberately excludes whole-organization meetings: those are visible on
 * everyone's dashboard already, and notifying an entire org per meeting is
 * noise, not signal.
 */
export const resolveMeetingRecipients = async (meeting) => {
  const ids = new Set();

  for (const value of [meeting.host, ...(meeting.participants || []), ...(meeting.allowedParticipants || [])]) {
    const id = toIdString(value);
    if (id) ids.add(id);
  }

  if (meeting.allowedTeams?.length) {
    const teams = await Team.find({ _id: { $in: meeting.allowedTeams } }).select('members').lean();
    for (const team of teams) {
      for (const member of team.members || []) {
        const id = toIdString(member);
        if (id) ids.add(id);
      }
    }
  }

  return [...ids];
};

/**
 * Resolve `@name` mentions in a chat message to user ids.
 *
 * Resolution is restricted to people already in the meeting. Matching against
 * the whole User collection would turn the chat box into an oracle for
 * enumerating registered users.
 */
export const resolveMentions = async (text, meeting) => {
  const handles = [
    ...new Set(
      (String(text || '').match(/@([\w.\-]{2,40})/g) || [])
        .map((h) => h.slice(1).toLowerCase())
        .slice(0, 10)
    ),
  ];

  if (handles.length === 0) return [];

  const candidateIds = await resolveMeetingRecipients(meeting);
  if (candidateIds.length === 0) return [];

  const candidates = await User.find({ _id: { $in: candidateIds } }).select('name').lean();

  const normalize = (name) => String(name || '').toLowerCase().replace(/\s+/g, '');

  return candidates
    .filter((user) => {
      const normalized = normalize(user.name);
      const firstName = normalize(user.name).split(/[^a-z0-9]/)[0];
      return handles.some((handle) => normalized === handle || firstName === handle);
    })
    .map((user) => user._id.toString());
};

export default { notify, resolveMeetingRecipients, resolveMentions, shapeForClient };
