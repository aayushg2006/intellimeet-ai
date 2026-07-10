import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { Button } from '../components/Button';
import { X, Calendar, Clock, Tag, Check, Video } from 'lucide-react';

const meetingTypeHelp = {
  internal: 'Internal Sync: internal org/team coordination.',
  external: 'External / Client: meetings with outside participants.',
  standup: 'Daily Standup: short daily status update.',
  review: 'Sprint Review: demo/review of completed work.',
  'one-on-one': '1-on-1: private meeting between two people.',
  other: 'Other: anything that does not fit the above.',
};

const buildInitialState = (activeWorkspace) => ({
  title: '',
  description: '',
  date: '',
  time: '',
  meetingType: 'internal',
  accessMode: activeWorkspace === 'personal' ? 'personal' : 'organization',
  allowedParticipants: [],
  allowedTeams: [],
});

export const ScheduleMeetingModal = ({ isOpen, onClose, onCreated, mode = 'scheduled' }) => {
  const { token, user } = useAuthStore();
  const { activeWorkspace, organizations } = useWorkspaceStore();
  const isInstant = mode === 'instant';
  const userId = user?._id || user?.id || null;
  const activeOrg = organizations.find((org) => org._id === activeWorkspace);
  const isOrgAdmin = activeOrg?.userRole === 'OrgAdmin';

  const [formData, setFormData] = useState(() => buildInitialState(activeWorkspace));
  const [loading, setLoading] = useState(false);

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', activeWorkspace],
    queryFn: async () => {
      const res = await axios.get('/api/teams', {
        headers: { Authorization: `Bearer ${token}` },
        params: { organizationId: activeWorkspace },
      });
      return res.data;
    },
    enabled: !!token && !!isOpen && activeWorkspace !== 'personal',
  });

  const { data: members = [] } = useQuery({
    queryKey: ['orgMembers', activeWorkspace],
    queryFn: async () => {
      const res = await axios.get(`/api/organizations/${activeWorkspace}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
    enabled: !!token && !!isOpen && activeWorkspace !== 'personal',
  });

  const ownedTeams = useMemo(() => {
    if (activeWorkspace === 'personal') return [];
    if (isOrgAdmin) return teams;
    return teams.filter((team) => (team.owner?._id || team.owner) === userId);
  }, [activeWorkspace, isOrgAdmin, teams, userId]);

  const canUseTeamScopes = activeWorkspace !== 'personal' && (isOrgAdmin || ownedTeams.length > 0);
  const accessOptions = useMemo(() => {
    if (activeWorkspace === 'personal') {
      return [{ value: 'personal', label: 'Personal', description: 'Private to you and invited participants.' }];
    }

    if (isOrgAdmin) {
      return [
        { value: 'organization', label: 'Org-wide', description: 'Any organization member can join directly.' },
        { value: 'teams', label: 'One or more teams', description: 'Only selected teams join directly.' },
        { value: 'people', label: 'Specific people', description: 'Only selected people join directly.' },
        { value: 'mixed', label: 'Teams + people', description: 'Combine both team and individual access.' },
      ];
    }

    if (canUseTeamScopes) {
      return [
        { value: 'organization', label: 'Org-wide', description: 'Any organization member can join directly.' },
        { value: 'teams', label: 'One or more teams', description: 'Only teams you own can be selected.' },
      ];
    }

    return [{ value: 'organization', label: 'Org-wide', description: 'Any organization member can join directly.' }];
  }, [activeWorkspace, canUseTeamScopes, isOrgAdmin]);

  const selectedTypeHelp = meetingTypeHelp[formData.meetingType] || meetingTypeHelp.other;

  const updateAccessMode = (nextMode) => {
    setFormData((prev) => ({
      ...prev,
      accessMode: nextMode,
      allowedParticipants: nextMode === 'people' || nextMode === 'mixed' ? prev.allowedParticipants : [],
      allowedTeams: nextMode === 'teams' || nextMode === 'mixed' ? prev.allowedTeams : [],
    }));
  };

  const toggleSelection = (listKey, id) => {
    setFormData((prev) => {
      const current = prev[listKey] || [];
      const exists = current.includes(id);
      return {
        ...prev,
        [listKey]: exists ? current.filter((value) => value !== id) : [...current, id],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) return;
    if (!isInstant && (!formData.date || !formData.time)) return;

    try {
      setLoading(true);
      const scheduledAt = isInstant
        ? new Date().toISOString()
        : new Date(`${formData.date}T${formData.time}`).toISOString();

      const payload = {
        title: formData.title.trim(),
        description: formData.description,
        scheduledAt,
        meetingType: formData.meetingType,
        accessMode: activeWorkspace === 'personal' ? 'personal' : (isInstant ? 'organization' : formData.accessMode),
        status: isInstant ? 'ongoing' : 'scheduled',
        organizationId: activeWorkspace === 'personal' ? null : activeWorkspace,
      };

      if (payload.accessMode === 'teams' || payload.accessMode === 'mixed') {
        payload.allowedTeams = formData.allowedTeams;
      }

      if (payload.accessMode === 'people' || payload.accessMode === 'mixed') {
        payload.allowedParticipants = formData.allowedParticipants;
      }

      const res = await axios.post('/api/meetings', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      onCreated?.(res.data);
      onClose?.();
    } catch (error) {
      console.error('Error scheduling meeting:', error);
      alert(error.response?.data?.message || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const canShowRestrictedOptions = activeWorkspace === 'personal' ? false : canUseTeamScopes || isOrgAdmin;
  const displayTeams = isOrgAdmin ? teams : ownedTeams;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#E8E4DD] bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1A1A1A]">
              {isInstant ? 'Start Instant Meeting' : 'Schedule Meeting'}
            </h2>
            <p className="mt-1 text-sm text-[#6B6560]">
              Meeting type describes the topic. Access scope controls who can join.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[#6B6560] transition hover:text-[#1A1A1A]" aria-label="Close schedule meeting modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">Meeting Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-xl border border-[#E8E4DD] bg-[#FAF9F7] px-4 py-2.5 text-sm text-[#1A1A1A] focus:border-[#7C3AED] focus:outline-none"
              placeholder="e.g. Weekly Sync"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">Meeting Type</label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6560]" size={16} />
              <select
                value={formData.meetingType}
                onChange={(e) => setFormData({ ...formData, meetingType: e.target.value })}
                className="w-full appearance-none rounded-xl border border-[#E8E4DD] bg-[#FAF9F7] py-2.5 pl-10 pr-4 text-sm text-[#1A1A1A] focus:border-[#7C3AED] focus:outline-none"
              >
                <option value="internal">Internal Sync</option>
                <option value="external">External / Client</option>
                <option value="standup">Daily Standup</option>
                <option value="review">Sprint Review</option>
                <option value="one-on-one">1-on-1</option>
                <option value="other">Other</option>
              </select>
            </div>
            <p className="mt-1.5 text-xs text-[#6B6560]">{selectedTypeHelp}</p>
          </div>

          {!isInstant && activeWorkspace !== 'personal' && canShowRestrictedOptions && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">Access Scope</label>
              <div className="grid gap-3 md:grid-cols-2">
                {accessOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateAccessMode(option.value)}
                    className={`text-left rounded-2xl border p-4 transition ${
                      formData.accessMode === option.value
                        ? 'border-[#7C3AED] bg-[#7C3AED]/5 shadow-sm'
                        : 'border-[#E8E4DD] bg-[#FAF9F7] hover:border-[#7C3AED]/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${formData.accessMode === option.value ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#C4BDB5]'}`}>
                        {formData.accessMode === option.value && <Check size={12} className="text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1A1A1A]">{option.label}</p>
                        <p className="text-xs text-[#6B6560] mt-1">{option.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isInstant && activeWorkspace !== 'personal' && !canShowRestrictedOptions && (
            <div className="p-3 bg-[#F5F2EE] rounded-xl border border-[#E8E4DD] text-sm text-[#6B6560]">
              Only organization-wide meetings are available with your current role.
            </div>
          )}

          {!isInstant && activeWorkspace !== 'personal' && (formData.accessMode === 'teams' || formData.accessMode === 'mixed') && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">Select Teams</label>
              <div className="max-h-56 overflow-y-auto border border-[#E8E4DD] rounded-2xl p-3 bg-[#FAF9F7] space-y-2">
                {displayTeams.length === 0 ? (
                  <div className="text-sm text-[#6B6560] py-4 text-center">No teams available.</div>
                ) : (
                  displayTeams.map((team) => {
                    const teamId = team._id;
                    const checked = formData.allowedTeams.includes(teamId);
                    return (
                      <button
                        key={teamId}
                        type="button"
                        onClick={() => toggleSelection('allowedTeams', teamId)}
                        className={`w-full flex items-center justify-between rounded-xl border px-3 py-2.5 transition ${
                          checked ? 'border-[#7C3AED] bg-white' : 'border-[#E8E4DD] bg-white/60 hover:border-[#7C3AED]/30'
                        }`}
                      >
                        <div className="text-left">
                          <p className="text-sm font-medium text-[#1A1A1A]">{team.name}</p>
                          <p className="text-xs text-[#6B6560]">
                            Owner: {team.owner?.name || 'Unknown'}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${checked ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#C4BDB5]'}`}>
                          {checked && <Check size={12} className="text-white" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {!isInstant && activeWorkspace !== 'personal' && (formData.accessMode === 'people' || formData.accessMode === 'mixed') && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">Select People</label>
              <div className="max-h-56 overflow-y-auto border border-[#E8E4DD] rounded-2xl p-3 bg-[#FAF9F7] space-y-2">
                {members.length === 0 ? (
                  <div className="text-sm text-[#6B6560] py-4 text-center">No organization members found.</div>
                ) : (
                  members.map((member) => {
                    const memberId = member.userId?._id;
                    const checked = formData.allowedParticipants.includes(memberId);
                    return (
                      <button
                        key={member._id}
                        type="button"
                        onClick={() => toggleSelection('allowedParticipants', memberId)}
                        className={`w-full flex items-center justify-between rounded-xl border px-3 py-2.5 transition ${
                          checked ? 'border-[#7C3AED] bg-white' : 'border-[#E8E4DD] bg-white/60 hover:border-[#7C3AED]/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 text-left">
                          <div className="w-8 h-8 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-xs font-semibold flex items-center justify-center">
                            {member.userId?.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#1A1A1A]">{member.userId?.name}</p>
                            <p className="text-xs text-[#6B6560]">{member.userId?.email}</p>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${checked ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#C4BDB5]'}`}>
                          {checked && <Check size={12} className="text-white" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="h-20 w-full resize-none rounded-xl border border-[#E8E4DD] bg-[#FAF9F7] px-4 py-2.5 text-sm text-[#1A1A1A] focus:border-[#7C3AED] focus:outline-none"
              placeholder="What is this meeting about?"
            />
          </div>

          {!isInstant && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6560]" size={16} />
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-[#FAF9F7] border border-[#E8E4DD] text-[#1A1A1A] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED]"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">Time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6560]" size={16} />
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full bg-[#FAF9F7] border border-[#E8E4DD] text-[#1A1A1A] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED]"
                  />
                </div>
              </div>
            </div>
          )}

          {isInstant && (
            <div className="rounded-xl border border-[#E8E4DD] bg-[#7C3AED]/5 p-3 text-xs text-[#6B6560]">
              Start the meeting now with the title and type above, then you’ll enter the lobby to check your camera and microphone.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              label="Cancel"
              icon={X}
              onClick={onClose}
              variant="ghost"
              iconClassName="bg-red-50"
              iconColorClassName="text-red-500"
              className="flex-1"
            />
            <Button
              type="submit"
              label={loading ? 'Saving...' : isInstant ? 'Start Meeting' : 'Schedule Meeting'}
              icon={Video}
              loading={loading}
              variant="primary"
              className="flex-1"
            />
          </div>
        </form>
      </div>
    </div>
  );
};
