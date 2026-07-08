import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Building, Link2, Copy, CheckCircle2, Trash2, User as UserIcon, Camera, Loader, Users, Check, PencilLine } from 'lucide-react';
import { useSignedUrl } from '../hooks/useSignedUrl';

const OrganizationLogo = ({ org, isAdmin }) => {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const { url: resolvedLogoUrl } = useSignedUrl(org.logo)
  const initials = org.name?.charAt(0).toUpperCase() || 'O'

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, GIF, or WebP)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('organizationId', org._id)

      await axios.post('/api/uploads/org-logo', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      })
      
      queryClient.invalidateQueries(['organizations'])
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to upload logo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="relative group">
        {resolvedLogoUrl ? (
          <img
            src={resolvedLogoUrl}
            alt={org.name}
            className="w-14 h-14 rounded-xl object-cover border-2 border-[#E8E4DD]"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-[#059669] text-white text-xl font-semibold flex items-center justify-center">
            {initials}
          </div>
        )}
        
        {isAdmin && (
          <>
            <label className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
              {uploading ? (
                <Loader size={16} className="text-white animate-spin" />
              ) : (
                <Camera size={16} className="text-white" />
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleLogoChange}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-lg">{org.name}</h3>
        {isAdmin && (
          <span className="text-xs bg-[#7C3AED]/10 text-[#7C3AED] px-2 py-0.5 rounded-md font-medium inline-block mt-0.5">
            Admin
          </span>
        )}
      </div>
    </div>
  )
}

const OrganizationMembersList = ({ orgId, isAdmin }) => {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['orgMembers', orgId],
    queryFn: async () => {
      const res = await axios.get(`/api/organizations/${orgId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    enabled: !!token && !!orgId
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }) => {
      const res = await axios.put(`/api/organizations/${orgId}/members/${memberId}/role`, { role }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries(['orgMembers', orgId]),
    onError: (err) => alert(err.response?.data?.message || 'Failed to update role')
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId) => {
      const res = await axios.delete(`/api/organizations/${orgId}/members/${memberId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries(['orgMembers', orgId]),
    onError: (err) => alert(err.response?.data?.message || 'Failed to remove member')
  });

  if (isLoading) return <div className="text-xs text-[#6B6560] py-2">Loading members...</div>;

  return (
    <div className="mt-4 pt-4 border-t border-[#E8E4DD]">
      <p className="text-xs text-[#6B6560] mb-3 uppercase tracking-wider font-semibold flex items-center gap-2">
        <UserIcon size={14} /> Organization Members ({members.length})
      </p>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {members.map(member => (
          <div key={member._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#FAF9F7] border border-transparent hover:border-[#E8E4DD] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-xs font-semibold flex items-center justify-center">
                {member.userId?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-sm font-medium text-[#1A1A1A]">{member.userId?.name}</p>
                <p className="text-xs text-[#6B6560]">{member.userId?.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <select
                  value={member.role}
                  onChange={(e) => updateRoleMutation.mutate({ memberId: member.userId._id, role: e.target.value })}
                  className="text-xs bg-white border border-[#E8E4DD] rounded px-2 py-1 focus:outline-none focus:border-[#7C3AED]"
                  disabled={updateRoleMutation.isLoading || removeMemberMutation.isLoading}
                >
                  <option value="OrgAdmin">Admin</option>
                  <option value="OrgMember">Member</option>
                </select>
              ) : (
                <span className={`text-xs px-2 py-1 rounded-md font-medium ${member.role === 'OrgAdmin' ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'bg-[#E8E4DD] text-[#6B6560]'}`}>
                  {member.role === 'OrgAdmin' ? 'Admin' : 'Member'}
                </span>
              )}

              {isAdmin && (
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to remove ${member.userId?.name}?`)) {
                      removeMemberMutation.mutate(member.userId._id);
                    }
                  }}
                  disabled={updateRoleMutation.isLoading || removeMemberMutation.isLoading}
                  className="p-1 text-[#6B6560] hover:text-red-500 hover:bg-red-50 rounded transition disabled:opacity-50"
                  title="Remove Member"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const OrganizationTeamsSection = ({ orgId, isAdmin }) => {
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showEditTeam, setShowEditTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState('');
  const [editingTeam, setEditingTeam] = useState(null);

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['teams', orgId],
    queryFn: async () => {
      const res = await axios.get('/api/teams', {
        headers: { Authorization: `Bearer ${token}` },
        params: { organizationId: orgId }
      });
      return res.data;
    },
    enabled: !!token && !!orgId,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['orgMembers', orgId, 'team-picker'],
    queryFn: async () => {
      const res = await axios.get(`/api/organizations/${orgId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    enabled: !!token && !!orgId && (showCreateTeam || showEditTeam),
  });

  const createTeamMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post('/api/teams', {
        name: teamName,
        organizationId: orgId,
        members: selectedMembers,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['teams', orgId]);
      setTeamName('');
      setSelectedMembers([]);
      setShowCreateTeam(false);
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to create team')
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId) => {
      const res = await axios.delete(`/api/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries(['teams', orgId]),
    onError: (err) => alert(err.response?.data?.message || 'Failed to delete team')
  });

  const toggleMember = (memberId) => {
    setSelectedMembers((prev) => (
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    ));
  };

  const openEditModal = (team) => {
    setShowCreateTeam(false);
    setEditingTeam(team);
    setTeamName(team.name || '');
    setSelectedOwner(team.owner?._id || team.owner || '');
    const memberIds = (team.members || []).map((member) => member?._id || member).filter(Boolean);
    setSelectedMembers(memberIds);
    setShowEditTeam(true);
  };

  const closeTeamModal = () => {
    setShowCreateTeam(false);
    setShowEditTeam(false);
    setEditingTeam(null);
    setTeamName('');
    setSelectedOwner('');
    setSelectedMembers([]);
  };

  const saveTeamMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: teamName,
        members: selectedMembers,
      };

      if (selectedOwner) {
        payload.owner = selectedOwner;
      }

      const res = await axios.put(`/api/teams/${editingTeam._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['teams', orgId]);
      closeTeamModal();
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to update team')
  });

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-[#E8E4DD]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs text-[#6B6560] uppercase tracking-wider font-semibold flex items-center gap-2">
          <Users size={14} /> Teams ({teams.length})
        </p>
        <button
          type="button"
          onClick={() => {
            setEditingTeam(null);
            setTeamName('');
            setSelectedOwner('');
            setSelectedMembers([]);
            setShowCreateTeam(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7C3AED] text-white text-xs font-medium hover:bg-[#6D28D9] transition"
        >
          <Plus size={14} />
          Create Team
        </button>
      </div>

      {teamsLoading ? (
        <div className="text-xs text-[#6B6560] py-2">Loading teams...</div>
      ) : teams.length === 0 ? (
        <div className="text-sm text-[#6B6560] bg-[#FAF9F7] border border-dashed border-[#E8E4DD] rounded-xl p-4">
          No teams yet. Create your first team to group members for meetings and workspace access.
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map((team) => {
            const isOwner = (team.owner?._id || team.owner) === (user?._id || user?.id);
            return (
              <div key={team._id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-[#E8E4DD] bg-[#FAF9F7]">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#1A1A1A]">{team.name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#4338CA]">
                      {team.members?.length || 0} members
                    </span>
                  </div>
                  <p className="text-xs text-[#6B6560] mt-1">
                    Owner: {team.owner?.name || 'Unknown'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {(isOwner || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => openEditModal(team)}
                      className="p-2 rounded-lg text-[#6B6560] hover:text-[#7C3AED] hover:bg-[#7C3AED]/5 transition"
                      title="Edit Team"
                    >
                      <PencilLine size={14} />
                    </button>
                  )}
                  {(isOwner || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete team "${team.name}"?`)) {
                          deleteTeamMutation.mutate(team._id);
                        }
                      }}
                      className="p-2 rounded-lg text-[#6B6560] hover:text-red-500 hover:bg-red-50 transition"
                      title="Delete Team"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateTeam && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E4DD] shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[#1A1A1A]">Create Team</h3>
                <p className="text-sm text-[#6B6560] mt-1">Teams help you scope meetings and group work for the right people.</p>
              </div>
              <button onClick={closeTeamModal} className="text-[#6B6560] hover:text-[#1A1A1A]">
                <CheckCircle2 size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Team Name</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full bg-[#FAF9F7] border border-[#E8E4DD] rounded-xl px-4 py-2.5 text-sm focus:border-[#7C3AED] focus:outline-none"
                  placeholder="e.g. Product Team"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Select Members</label>
                {membersLoading ? (
                  <div className="text-sm text-[#6B6560]">Loading members...</div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 max-h-72 overflow-y-auto pr-1">
                    {members.map((member) => {
                      const memberId = member.userId?._id;
                      const checked = selectedMembers.includes(memberId);
                      return (
                        <button
                          type="button"
                          key={member._id}
                          onClick={() => toggleMember(memberId)}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                            checked ? 'border-[#7C3AED] bg-[#7C3AED]/5' : 'border-[#E8E4DD] bg-[#FAF9F7] hover:border-[#7C3AED]/30'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-xs font-semibold flex items-center justify-center flex-shrink-0">
                              {member.userId?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#1A1A1A] truncate">{member.userId?.name}</p>
                              <p className="text-xs text-[#6B6560] truncate">{member.userId?.email}</p>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${checked ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#C4BDB5]'}`}>
                            {checked && <Check size={12} className="text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeTeamModal}
                  className="px-4 py-2 rounded-xl border border-[#E8E4DD] text-[#6B6560] hover:bg-[#F5F2EE] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!teamName.trim()) return alert('Please enter a team name')
                    createTeamMutation.mutate()
                  }}
                  disabled={createTeamMutation.isLoading}
                  className="px-4 py-2 rounded-xl bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition disabled:opacity-60"
                >
                  {createTeamMutation.isLoading ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditTeam && editingTeam && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E4DD] shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[#1A1A1A]">Edit Team</h3>
                <p className="text-sm text-[#6B6560] mt-1">Update the team name, owner, and members.</p>
              </div>
              <button onClick={closeTeamModal} className="text-[#6B6560] hover:text-[#1A1A1A]">
                <CheckCircle2 size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Team Name</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full bg-[#FAF9F7] border border-[#E8E4DD] rounded-xl px-4 py-2.5 text-sm focus:border-[#7C3AED] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Owner</label>
                <select
                  value={selectedOwner}
                  onChange={(e) => {
                    const nextOwner = e.target.value;
                    setSelectedOwner(nextOwner);
                    setSelectedMembers((prev) => (
                      prev.includes(nextOwner) ? prev : [...prev, nextOwner]
                    ));
                  }}
                  className="w-full bg-[#FAF9F7] border border-[#E8E4DD] rounded-xl px-4 py-2.5 text-sm focus:border-[#7C3AED] focus:outline-none"
                >
                  {members.map((member) => (
                    <option key={member.userId?._id} value={member.userId?._id}>
                      {member.userId?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Team Members</label>
                {membersLoading ? (
                  <div className="text-sm text-[#6B6560]">Loading members...</div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 max-h-72 overflow-y-auto pr-1">
                    {members.map((member) => {
                      const memberId = member.userId?._id;
                      const checked = selectedMembers.includes(memberId);
                      const isOwner = selectedOwner === memberId;
                      return (
                        <button
                          type="button"
                          key={member._id}
                          onClick={() => {
                            if (isOwner) return;
                            toggleMember(memberId);
                          }}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                            checked ? 'border-[#7C3AED] bg-[#7C3AED]/5' : 'border-[#E8E4DD] bg-[#FAF9F7] hover:border-[#7C3AED]/30'
                          } ${isOwner ? 'opacity-80' : ''}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-xs font-semibold flex items-center justify-center flex-shrink-0">
                              {member.userId?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#1A1A1A] truncate">
                                {member.userId?.name}
                                {isOwner && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#4338CA]">Owner</span>}
                              </p>
                              <p className="text-xs text-[#6B6560] truncate">{member.userId?.email}</p>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${checked ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#C4BDB5]'}`}>
                            {checked && <Check size={12} className="text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeTeamModal}
                  className="px-4 py-2 rounded-xl border border-[#E8E4DD] text-[#6B6560] hover:bg-[#F5F2EE] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!teamName.trim()) return alert('Please enter a team name')
                    if (!selectedOwner) return alert('Please select an owner')
                    saveTeamMutation.mutate()
                  }}
                  disabled={saveTeamMutation.isLoading}
                  className="px-4 py-2 rounded-xl bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition disabled:opacity-60"
                >
                  {saveTeamMutation.isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const OrganizationSettings = () => {
  const { token } = useAuthStore();
  const { activeWorkspace, setActiveWorkspace, setOrganizations } = useWorkspaceStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDomain, setNewOrgDomain] = useState('');
  const [joinToken, setJoinToken] = useState('');
  const [copied, setCopied] = useState(false);

  // Re-fetch to ensure fresh data
  const { data: orgsData = [], isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await axios.get('/api/organizations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (orgsData.length > 0) {
      setOrganizations(orgsData);
    }
  }, [orgsData, setOrganizations]);

  const createOrgMutation = useMutation({
    mutationFn: async (newOrg) => {
      const res = await axios.post('/api/organizations', newOrg, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['organizations']);
      setActiveWorkspace(data._id);
      setNewOrgName('');
      setNewOrgDomain('');
    }
  });

  const joinOrgMutation = useMutation({
    mutationFn: async (tokenValue) => {
      const res = await axios.post(`/api/organizations/join/${tokenValue}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['organizations']);
      if (data.organizationId) {
        setActiveWorkspace(data.organizationId);
      }
      setJoinToken('');
    }
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (newOrgName.trim()) {
      createOrgMutation.mutate({ name: newOrgName, domain: newOrgDomain });
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (joinToken.trim()) {
      joinOrgMutation.mutate(joinToken);
    }
  };

  const copyInviteLink = (tokenValue) => {
    const inviteLink = `${window.location.origin}/join/${tokenValue}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(tokenValue);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-[#1A1A1A]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-sm text-[#6B6560] hover:text-[#1A1A1A] transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-semibold mb-8 text-[#1A1A1A]">Organization Settings</h1>

        <div className="grid md:grid-cols-2 gap-8">
          
          <div className="space-y-8">
            <section className="bg-white p-6 rounded-2xl border border-[#E8E4DD] shadow-sm">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Plus size={20} className="text-[#7C3AED]" />
                Create Organization
              </h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm text-[#6B6560] mb-1">Organization Name *</label>
                  <input
                    type="text"
                    required
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    className="w-full bg-[#FAF9F7] border border-[#E8E4DD] rounded-xl px-4 py-2 text-sm focus:border-[#7C3AED] focus:outline-none"
                    placeholder="e.g., Zidio Development"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#6B6560] mb-1">Email Domain (Optional)</label>
                  <input
                    type="text"
                    value={newOrgDomain}
                    onChange={(e) => setNewOrgDomain(e.target.value)}
                    className="w-full bg-[#FAF9F7] border border-[#E8E4DD] rounded-xl px-4 py-2 text-sm focus:border-[#7C3AED] focus:outline-none"
                    placeholder="e.g., zidio.in"
                  />
                  <p className="text-xs text-[#6B6560] mt-1">Users signing up with this domain will auto-join.</p>
                </div>
                <button
                  type="submit"
                  disabled={createOrgMutation.isLoading}
                  className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
                >
                  {createOrgMutation.isLoading ? 'Creating...' : 'Create Organization'}
                </button>
              </form>
            </section>

            <section className="bg-white p-6 rounded-2xl border border-[#E8E4DD] shadow-sm">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Link2 size={20} className="text-[#2563EB]" />
                Join via Token
              </h2>
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="block text-sm text-[#6B6560] mb-1">Invite Token</label>
                  <input
                    type="text"
                    required
                    value={joinToken}
                    onChange={(e) => setJoinToken(e.target.value)}
                    className="w-full bg-[#FAF9F7] border border-[#E8E4DD] rounded-xl px-4 py-2 text-sm focus:border-[#2563EB] focus:outline-none"
                    placeholder="Paste token here"
                  />
                </div>
                <button
                  type="submit"
                  disabled={joinOrgMutation.isLoading}
                  className="w-full bg-white border border-[#E8E4DD] hover:bg-[#F5F2EE] text-[#1A1A1A] py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
                >
                  {joinOrgMutation.isLoading ? 'Joining...' : 'Join Organization'}
                </button>
              </form>
            </section>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-[#1A1A1A]">
              <Building size={20} className="text-[#059669]" />
              Your Organizations
            </h2>
            {isLoading ? (
              <p className="text-sm text-[#6B6560]">Loading...</p>
            ) : orgsData.length === 0 ? (
              <p className="text-sm text-[#6B6560]">You are not part of any organizations yet.</p>
            ) : (
              orgsData.map((org) => (
                <div
                  key={org._id}
                  className={`bg-white p-5 rounded-2xl border ${
                    activeWorkspace === org._id ? 'border-[#7C3AED] shadow-sm' : 'border-[#E8E4DD]'
                  }`}
                >
                  <OrganizationLogo org={org} isAdmin={org.userRole === 'OrgAdmin'} />
                  {org.domain && (
                    <p className="text-sm text-[#6B6560] mb-3">Domain: <span className="font-medium text-[#1A1A1A]">{org.domain}</span></p>
                  )}
                  
                  {org.userRole === 'OrgAdmin' && (
                    <div className="mt-4 pt-4 border-t border-[#E8E4DD]">
                      <p className="text-xs text-[#6B6560] mb-2 uppercase tracking-wider font-semibold">Invite Link</p>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          readOnly 
                          value={`${window.location.origin}/join/${org.customUrlToken}`}
                          className="flex-1 bg-[#FAF9F7] text-xs text-[#6B6560] p-2 rounded-lg border border-[#E8E4DD] focus:outline-none"
                        />
                        <button
                          onClick={() => copyInviteLink(org.customUrlToken)}
                          className="p-2 bg-[#F5F2EE] hover:bg-[#E8E4DD] text-[#1A1A1A] rounded-lg transition"
                          title="Copy Link"
                        >
                          {copied === org.customUrlToken ? <CheckCircle2 size={16} className="text-[#059669]" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  )}

                  <OrganizationMembersList orgId={org._id} isAdmin={org.userRole === 'OrgAdmin'} />
                  <OrganizationTeamsSection orgId={org._id} isAdmin={org.userRole === 'OrgAdmin'} />

                  {activeWorkspace !== org._id && (
                    <button
                      onClick={() => setActiveWorkspace(org._id)}
                      className="mt-4 w-full text-center text-sm font-medium text-[#7C3AED] bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 py-1.5 rounded-lg transition"
                    >
                      Switch to Workspace
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
};
