import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['task_assigned', 'meeting_invite', 'summary_ready', 'mention'],
    required: true,
  },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  /** In-app route to open when the notification is clicked. */
  link: { type: String, default: '' },
  read: { type: Boolean, default: false },
  readAt: { type: Date },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorName: { type: String, default: '' },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
  entityKind: { type: String, enum: ['task', 'meeting', 'summary', 'message', null], default: null },
  entityId: { type: String, default: '' },
  /**
   * Optional idempotency key. Emitting the same logical notification twice
   * (a retry, a regenerated summary, a restart) writes only one row.
   */
  dedupeKey: { type: String },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
  createdAt: { type: Date, default: Date.now },
});

// The notification list, and its unread-only variant.
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
// Sparse so notifications without a dedupe key are unconstrained.
notificationSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true, sparse: true });
// 90-day retention, handled by MongoDB rather than a cron job.
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Notification', notificationSchema);
