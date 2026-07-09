import mongoose from 'mongoose';

const summarySchema = new mongoose.Schema({
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true, unique: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' }, // null = personal
  title: { type: String },
  date: { type: String },
  duration: { type: String },
  participants: [{ name: String, role: String, avatar: String }],
  summary: { type: String },
  transcriptSummary: { type: String },
  chatSummary: { type: String },
  notesSummary: { type: String },
  conclusions: { type: String },
  generationStatus: { type: String, enum: ['pending', 'generating', 'completed', 'failed'], default: 'pending' },
  generationError: { type: String, default: '' },
  generationStartedAt: { type: Date },
  generatedAt: { type: Date },
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
