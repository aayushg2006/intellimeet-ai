const getName = (item) => {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return item.name || item.title || item.userId?.name || item.userId?.email || item.email || '';
};

export const getMeetingTypeLabel = (meetingType) => {
  const labels = {
    internal: 'Internal Sync',
    external: 'External / Client',
    standup: 'Daily Standup',
    review: 'Sprint Review',
    'one-on-one': '1-on-1',
    other: 'Other',
  };

  return labels[meetingType] || 'Other';
};

export const getMeetingAccessLabel = (meeting) => {
  if (!meeting) return 'Personal';

  const accessMode = meeting.accessMode || (
    meeting.organizationId
      ? ((meeting.allowedParticipants?.length || 0) > 0 && (meeting.allowedTeams?.length || 0) > 0
        ? 'mixed'
        : (meeting.allowedTeams?.length || 0) > 0
          ? 'teams'
          : (meeting.allowedParticipants?.length || 0) > 0
            ? 'people'
            : 'organization')
      : 'personal'
  );

  if (accessMode === 'personal') return 'Personal';
  if (accessMode === 'organization') return 'Org-wide';
  if (accessMode === 'teams') return 'Team access';
  if (accessMode === 'people') return 'People only';
  return 'Mixed access';
};

export const getMeetingAccessDetails = (meeting) => {
  const teams = (meeting?.allowedTeams || []).map(getName).filter(Boolean);
  const people = (meeting?.allowedParticipants || []).map(getName).filter(Boolean);

  return { teams, people };
};
