import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  scheduledAt: { type: Date },
  status: { type: String, enum: ['scheduled', 'ongoing', 'completed'], default: 'scheduled' },
  roomId: { type: String, required: true, unique: true }, // For socket.io/WebRTC
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Meeting', meetingSchema);
