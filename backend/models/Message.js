import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true }, // Can be meeting ID or DM room ID
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  type: { type: String, enum: ['text', 'file', 'system'], default: 'text' },
  fileUrl: { type: String },
  fileName: { type: String },
  fileSize: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

// Every chat fetch and the end-of-meeting summary build query by roomId and
// read in chronological order; without this the query is a collection scan.
messageSchema.index({ roomId: 1, createdAt: 1 });

export default mongoose.model('Message', messageSchema);
