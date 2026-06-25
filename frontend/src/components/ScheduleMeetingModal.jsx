import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { X, Calendar, Clock, Users, Tag } from 'lucide-react';

export const ScheduleMeetingModal = ({ isOpen, onClose, onSchedule }) => {
  const { token } = useAuthStore();
  const { activeWorkspace } = useWorkspaceStore();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    meetingType: 'internal',
    audience: 'all', // 'all', 'specific'
    allowedParticipants: [],
    allowedTeams: []
  });
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loadingContext, setLoadingContext] = useState(false);

  useEffect(() => {
    if (isOpen && activeWorkspace !== 'personal') {
      fetchWorkspaceContext();
    }
  }, [isOpen, activeWorkspace]);

  const fetchWorkspaceContext = async () => {
    try {
      setLoadingContext(true);
      // We assume /api/organizations/:id/members exists or we can get users.
      // For now, let's just leave members empty if not implemented yet.
      // We will implement them soon.
    } catch (error) {
      console.error('Failed to load workspace context', error);
    } finally {
      setLoadingContext(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.time) return;

    try {
      const scheduledAt = new Date(`${formData.date}T${formData.time}`);
      const newMeetingId = Math.random().toString(36).substring(2, 9).toUpperCase();
      
      const payload = {
        title: formData.title,
        description: formData.description,
        roomId: newMeetingId,
        scheduledAt,
        meetingType: formData.meetingType,
        organizationId: activeWorkspace === 'personal' ? null : activeWorkspace,
      };

      if (formData.audience === 'specific') {
        payload.allowedParticipants = formData.allowedParticipants;
        payload.allowedTeams = formData.allowedTeams;
      }

      await axios.post('/api/meetings', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      onSchedule(newMeetingId);
    } catch (error) {
      console.error('Error scheduling meeting:', error);
      alert('Failed to schedule meeting');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#E8E4DD] rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-semibold text-[#1A1A1A]">Schedule Meeting</h2>
          <button onClick={onClose} className="text-[#6B6560] hover:text-[#1A1A1A]">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Meeting Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-[#FAF9F7] border border-[#E8E4DD] text-[#1A1A1A] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED]"
              placeholder="e.g. Weekly Sync"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-[#FAF9F7] border border-[#E8E4DD] text-[#1A1A1A] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED] resize-none h-20"
              placeholder="What is this meeting about?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Date</label>
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
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Time</label>
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

          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Meeting Type</label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6560]" size={16} />
              <select
                value={formData.meetingType}
                onChange={(e) => setFormData({ ...formData, meetingType: e.target.value })}
                className="w-full bg-[#FAF9F7] border border-[#E8E4DD] text-[#1A1A1A] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED] appearance-none"
              >
                <option value="internal">Internal Sync</option>
                <option value="external">External / Client</option>
                <option value="standup">Daily Standup</option>
                <option value="review">Sprint Review</option>
                <option value="one-on-one">1-on-1</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {activeWorkspace !== 'personal' && (
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Audience</label>
              <div className="relative mb-3">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6560]" size={16} />
                <select
                  value={formData.audience}
                  onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                  className="w-full bg-[#FAF9F7] border border-[#E8E4DD] text-[#1A1A1A] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED] appearance-none"
                >
                  <option value="all">All Organization Members</option>
                  <option value="specific">Specific People / Teams (Restricted)</option>
                </select>
              </div>
              
              {formData.audience === 'specific' && (
                <div className="p-3 bg-[#F5F2EE] rounded-xl border border-[#E8E4DD] text-sm text-[#6B6560]">
                  <p>Restricted access functionality will be fully enabled once teams are set up. For now, the meeting will be restricted to the creator.</p>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-[#E8E4DD] text-[#6B6560] hover:bg-[#F5F2EE] rounded-xl py-2.5 text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl py-2.5 text-sm font-medium transition"
            >
              Schedule Meeting
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
