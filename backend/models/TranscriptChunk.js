import mongoose from 'mongoose';

/**
 * A chunk of meeting transcript with its embedding vector, backing semantic
 * "ask across my meetings" search.
 */
const transcriptChunkSchema = new mongoose.Schema({
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
  // Denormalised so search results can be rendered without a join.
  meetingTitle: { type: String, default: '' },
  meetingRoomId: { type: String, default: '' },
  meetingDate: { type: String, default: '' },
  chunkIndex: { type: Number, required: true },
  startLine: { type: Number, default: 0 },
  endLine: { type: Number, default: 0 },
  text: { type: String, required: true },
  // Deliberately not covered by any b-tree index — a 768-float array would
  // blow one up. Vector search uses an Atlas search index if available, and
  // otherwise we score in Node.
  embedding: { type: [Number], default: undefined },
  // Stored so a model change is detectable and triggers a re-index.
  embeddingModel: { type: String, default: '' },
  dims: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

transcriptChunkSchema.index({ meetingId: 1, chunkIndex: 1 }, { unique: true });
transcriptChunkSchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model('TranscriptChunk', transcriptChunkSchema);
