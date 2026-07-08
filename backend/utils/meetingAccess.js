import Team from '../models/Team.js';
import OrganizationMember from '../models/OrganizationMember.js';

export const inferMeetingAccessMode = (meeting) => {
  if (!meeting) return 'personal';
  if (meeting.accessMode) return meeting.accessMode;

  const allowedParticipants = meeting.allowedParticipants || [];
  const allowedTeams = meeting.allowedTeams || [];

  if (!meeting.organizationId) return 'personal';
  if (allowedParticipants.length > 0 && allowedTeams.length > 0) return 'mixed';
  if (allowedTeams.length > 0) return 'teams';
  if (allowedParticipants.length > 0) return 'people';
  return 'organization';
};

export const canUserCreateMeeting = async ({
  userId,
  organizationId,
  accessMode,
  allowedParticipants = [],
  allowedTeams = [],
}) => {
  if (!organizationId) {
    return true;
  }

  const membership = await OrganizationMember.findOne({
    userId,
    organizationId,
  }).select('role');

  if (!membership) {
    return false;
  }

  if (membership.role === 'OrgAdmin') {
    return true;
  }

  const normalizedMode = accessMode || inferAccessModeFromPayload(allowedParticipants, allowedTeams);

  if (normalizedMode === 'organization') {
    return true;
  }

  if (normalizedMode === 'people' || normalizedMode === 'mixed') {
    return false;
  }

  if (allowedTeams.length === 0) {
    return false;
  }

  const ownedTeams = await Team.find({
    _id: { $in: allowedTeams },
    organizationId,
    owner: userId,
  }).select('_id');

  return ownedTeams.length === allowedTeams.length;
};

export const canUserAccessMeeting = async (meeting, userId) => {
  if (!meeting || !userId) {
    return false;
  }

  const userIdStr = userId.toString();
  const hostId = meeting.host?._id ? meeting.host._id.toString() : meeting.host?.toString?.() || '';
  const participantIds = (meeting.participants || []).map((participant) =>
    participant?._id ? participant._id.toString() : participant.toString()
  );

  if (hostId === userIdStr || participantIds.includes(userIdStr)) {
    return true;
  }

  const accessMode = inferMeetingAccessMode(meeting);
  const allowedParticipantIds = (meeting.allowedParticipants || []).map((participant) =>
    participant?._id ? participant._id.toString() : participant.toString()
  );

  if (allowedParticipantIds.includes(userIdStr)) {
    return true;
  }

  if (meeting.allowedTeams && meeting.allowedTeams.length > 0) {
    const matchingTeam = await Team.findOne({
      _id: { $in: meeting.allowedTeams },
      members: userId,
    }).select('_id');

    if (matchingTeam) {
      return true;
    }
  }

  if (!meeting.organizationId) {
    return false;
  }

  if (accessMode === 'organization') {
    const membership = await OrganizationMember.findOne({
      userId,
      organizationId: meeting.organizationId,
    }).select('_id');

    return !!membership;
  }

  return false;
};

const inferAccessModeFromPayload = (allowedParticipants, allowedTeams) => {
  if (allowedParticipants.length > 0 && allowedTeams.length > 0) return 'mixed';
  if (allowedTeams.length > 0) return 'teams';
  if (allowedParticipants.length > 0) return 'people';
  return 'organization';
};
