import Meeting from '../models/Meeting.js';
import OrganizationMember from '../models/OrganizationMember.js';
import Team from '../models/Team.js';
import { stateStore } from '../lib/stateStore.js';
import { keys, TTL } from '../lib/stateKeys.js';

/**
 * Which meetings a user is allowed to SEARCH.
 *
 * This is deliberately stricter than `canUserAccessMeeting`, and the difference
 * matters. That function returns true for any personal (no-organization)
 * meeting, because personal meetings are shareable by link — anyone holding the
 * link may join. Reusing that rule here would let every user full-text search
 * every other user's private meeting transcripts.
 *
 * So search scope covers only meetings the user has a concrete relationship
 * with: they hosted it, attended it, were explicitly invited, or it belongs to
 * an organization/team they are a member of.
 *
 * INVARIANT: this must always be a strict subset of `canUserAccessMeeting`. It
 * may under-grant (a link-shared meeting you never joined won't be searchable);
 * it must never over-grant.
 */

// Ceiling on how many meetings a single search considers. Beyond this, only the
// most recent are searchable — an accepted limitation, documented in the README.
const DEFAULT_CAP = 2000;

const getMemberships = async (userId) => {
  const cacheKey = keys.searchScope(userId);

  const cached = await stateStore.get(cacheKey);
  if (cached) return cached;

  // Two indexed lookups, regardless of how many meetings exist.
  const [orgIds, teamIds] = await Promise.all([
    OrganizationMember.find({ userId }).distinct('organizationId'),
    Team.find({ members: userId }).distinct('_id'),
  ]);

  const memberships = {
    orgIds: orgIds.map(String),
    teamIds: teamIds.map(String),
  };

  await stateStore.set(cacheKey, memberships, TTL.SCOPE);
  return memberships;
};

/**
 * Build the Mongo filter describing every meeting this user may search.
 */
export const buildSearchableMeetingFilter = async (userId, { organizationId = null } = {}) => {
  const { orgIds, teamIds } = await getMemberships(userId);

  const clauses = [
    { host: userId },
    { participants: userId },
    { allowedParticipants: userId },
  ];

  if (teamIds.length) clauses.push({ allowedTeams: { $in: teamIds } });
  // Org-wide meetings are visible to members; team/people-scoped ones are
  // already covered by the clauses above.
  if (orgIds.length) clauses.push({ organizationId: { $in: orgIds }, accessMode: 'organization' });

  const filter = { $or: clauses };

  if (organizationId && organizationId !== 'personal') {
    // Only narrow to an org the user actually belongs to.
    if (!orgIds.includes(String(organizationId))) return null;
    filter.organizationId = organizationId;
  } else if (organizationId === 'personal') {
    filter.$and = [{ $or: [{ organizationId: null }, { organizationId: { $exists: false } }] }];
  }

  return filter;
};

/**
 * Resolve that filter to a bounded list of meeting ids.
 *
 * Three queries total (two membership lookups + one meeting query), independent
 * of result size — no N+1 and no per-document permission check.
 */
export const getSearchableMeetingIds = async (userId, { organizationId = null, cap = DEFAULT_CAP } = {}) => {
  const filter = await buildSearchableMeetingFilter(userId, { organizationId });
  if (!filter) return [];

  const meetings = await Meeting.find(filter)
    .select('_id')
    .sort({ createdAt: -1 })
    .limit(cap)
    .lean();

  return meetings.map((m) => m._id);
};

export default { buildSearchableMeetingFilter, getSearchableMeetingIds };
