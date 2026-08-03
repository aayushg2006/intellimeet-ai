import mongoose from 'mongoose';

/**
 * A one-time, short-lived code handed to the frontend after Google OAuth.
 *
 * The OAuth callback used to redirect with the JWT itself in the query string,
 * which meant the token landed in browser history, the Referer header of any
 * subsequent request, and any proxy or analytics log in between. Instead we
 * redirect with an opaque code that is exchanged once, over POST, for the real
 * tokens.
 */
const authCodeSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  usedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

authCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('AuthCode', authCodeSchema);
