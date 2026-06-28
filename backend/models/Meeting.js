import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  scheduledAt: { type: Date },
  endedAt: { type: Date },
  meetingType: { type: String, enum: ['internal', 'external', 'standup', 'review', 'one-on-one', 'other'], default: 'other' },
  status: { type: String, enum: ['scheduled', 'ongoing', 'completed'], default: 'scheduled' },
  roomId: { type: String, required: true, unique: true }, // For socket.io/WebRTC
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' }, // null = personal
  allowedParticipants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // empty means all organization members
  allowedTeams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
  recordingKey: { type: String, default: '' }, // S3 key for the meeting recording
  attachments: [{
    fileName: { type: String },
    s3Key: { type: String },
    fileSize: { type: Number },
    fileType: { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Meeting', meetingSchema);
