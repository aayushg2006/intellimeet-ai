import mongoose from 'mongoose';

/**
 * A single issued refresh token.
 *
 * Tokens are stored hashed — a database leak must not hand out live sessions.
 * Every refresh rotates: the presented token is revoked and a new one issued in
 * the same `family`. If a token that has already been revoked is presented
 * again, that means it leaked and was replayed, so the entire family is
 * revoked and the user is forced to log in again.
 */
const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  // Shared by every token descended from one login, so a replay can revoke the
  // whole chain rather than just the one stolen token.
  family: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  replacedByHash: { type: String, default: null },
  userAgent: { type: String, default: '' },
  ip: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

refreshTokenSchema.index({ userId: 1, createdAt: -1 });
refreshTokenSchema.index({ family: 1 });
// Let MongoDB reap expired tokens instead of accumulating them forever.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('RefreshToken', refreshTokenSchema);
