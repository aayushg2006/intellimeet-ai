import mongoose from 'mongoose';

const summarySchema = new mongoose.Schema({
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true, unique: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' }, // null = personal
  title: { type: String },
  date: { type: String },
  duration: { type: String },
  participants: [{ name: String, role: String, avatar: String }],
  summary: { type: String },
  conclusions: { type: String },
  actionItems: [{
    id: Number,
    task: String,
    assignee: String,
    status: String,
    taskId: String
  }],
  transcript: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Summary', summarySchema);
