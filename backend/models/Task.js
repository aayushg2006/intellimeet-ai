import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['Todo', 'In Progress', 'In Review', 'Done'], default: 'Todo' },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' }, // null = personal
  dueDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Task', taskSchema);
