/**
 * Centralised key names and TTLs for everything kept in the state store.
 *
 * All keys are namespaced under `im:` so the Redis instance can be shared with
 * something else without collision, and every key carries a TTL so abandoned
 * meetings expire on their own rather than relying on a sweeper.
 */
export const keys = {
  /** Hash of socketId -> { userObj, roomId, at } for guests awaiting admission. */
  waiting: (roomId) => `im:wait:${roomId}`,
  /** List of transcript lines for a live meeting. */
  transcript: (roomId) => `im:tr:${roomId}`,
  /** The Summary document id for a live meeting, so we don't refetch per line. */
  summaryDoc: (roomId) => `im:sumdoc:${roomId}`,
  /** Cached { meetingId, memberIds } for a room, to avoid a lookup per chat message. */
  roomMeta: (roomId) => `im:room:${roomId}`,

  /** Live copilot bookkeeping. */
  copilotState: (roomId) => `im:cp:cur:${roomId}`,
  copilotItems: (roomId) => `im:cp:items:${roomId}`,
  copilotHashes: (roomId) => `im:cp:hash:${roomId}`,
  copilotLock: (roomId) => `im:cp:lock:${roomId}`,

  /** Cached org/team membership for search scoping. */
  searchScope: (userId) => `im:scope:${userId}`,

  /** Background job locks. */
  jobLock: (name) => `im:job:${name}`,
};

export const TTL = {
  /** Meeting-scoped state: comfortably longer than any real meeting. */
  MEETING: 8 * 60 * 60,
  /** Waiting-room entries: shorter, since a stale entry shows a ghost guest. */
  WAITING: 4 * 60 * 60,
  /** Membership lookups change rarely; a short cache kills repeat queries. */
  SCOPE: 120,
};

export default keys;
