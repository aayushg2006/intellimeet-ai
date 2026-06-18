import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional, can be system-wide
  totalMeetings: { type: Number, default: 0 },
  totalHours: { type: Number, default: 0 },
  totalParticipants: { type: Number, default: 0 },
  avgDuration: { type: Number, default: 0 },
  meetingsThisWeek: [{ day: String, count: Number }],
  meetingsByType: [{ name: String, value: Number }],
  topParticipants: [{ name: String, meetings: Number, role: String }],
  recentActivity: [{ action: String, target: String, time: String }],
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Analytics', analyticsSchema);
