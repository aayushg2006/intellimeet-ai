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
  // Incremented on each generation attempt so the reaper can give up on a
  // summary that keeps dying rather than retrying it forever.
  generationAttempts: { type: Number, default: 0 },
  // Denormalised, length-capped text backing keyword search. Indexing the raw
  // transcript array instead would generate an index entry per token per line.
  searchBlob: { type: String, default: '' },
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

summarySchema.index({ organizationId: 1, createdAt: -1 });
// Keyword search. MongoDB permits one text index per collection, so both
// searchable fields live in this single compound definition.
summarySchema.index(
  { title: 'text', searchBlob: 'text' },
  { name: 'summary_text_idx', weights: { title: 10, searchBlob: 1 }, default_language: 'english' }
);
// Used by the stale-generation reaper to find jobs orphaned by a restart.
summarySchema.index({ generationStatus: 1, generationStartedAt: 1 });

export default mongoose.model('Summary', summarySchema);
