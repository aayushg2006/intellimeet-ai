import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import RefreshToken from '../models/RefreshToken.js';
import AuthCode from '../models/AuthCode.js';

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 30);
const AUTH_CODE_TTL_MS = 60 * 1000;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const randomToken = () => crypto.randomBytes(48).toString('base64url');

/**
 * Short-lived bearer token. Kept short because it is not revocable — the
 * refresh token is the revocation point.
 */
export const generateAccessToken = (userId) =>
  jwt.sign({ id: userId, type: 'access' }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

/**
 * Issue a brand-new refresh token family (i.e. a fresh login).
 */
export const issueRefreshToken = async (userId, { family, req } = {}) => {
  const token = randomToken();

  await RefreshToken.create({
    userId,
    tokenHash: sha256(token),
    family: family || crypto.randomUUID(),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
    userAgent: (req?.headers['user-agent'] || '').slice(0, 200),
    ip: req?.ip || '',
  });

  return token;
};

/**
 * Issue both tokens for a successful authentication.
 */
export const issueTokenPair = async (userId, req) => ({
  token: generateAccessToken(userId),
  refreshToken: await issueRefreshToken(userId, { req }),
  expiresIn: ACCESS_TOKEN_TTL,
});

/**
 * Exchange a refresh token for a new pair, rotating the old one out.
 *
 * @returns {Promise<{ ok: true, userId, token, refreshToken } | { ok: false, reason: string }>}
 */
export const rotateRefreshToken = async (presentedToken, req) => {
  if (!presentedToken) return { ok: false, reason: 'No refresh token provided' };

  const tokenHash = sha256(presentedToken);
  const existing = await RefreshToken.findOne({ tokenHash });

  if (!existing) return { ok: false, reason: 'Invalid refresh token' };

  if (existing.revokedAt) {
    // Replay of an already-rotated token: treat the whole family as
    // compromised rather than just refusing this one request.
    await RefreshToken.updateMany(
      { family: existing.family, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    console.warn(`[Auth] Refresh token replay detected for user ${existing.userId}; family revoked`);
    return { ok: false, reason: 'Refresh token has already been used' };
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'Refresh token expired' };
  }

  const nextToken = await issueRefreshToken(existing.userId, { family: existing.family, req });

  existing.revokedAt = new Date();
  existing.replacedByHash = sha256(nextToken);
  await existing.save();

  return {
    ok: true,
    userId: existing.userId,
    token: generateAccessToken(existing.userId),
    refreshToken: nextToken,
  };
};

/**
 * Revoke a single token (logout on this device).
 */
export const revokeRefreshToken = async (presentedToken) => {
  if (!presentedToken) return;
  await RefreshToken.updateOne(
    { tokenHash: sha256(presentedToken), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

/**
 * Revoke every active token for a user (logout everywhere / password reset).
 */
export const revokeAllForUser = async (userId) => {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
};

// ─── ONE-TIME OAUTH EXCHANGE CODES ───

export const createAuthCode = async (userId) => {
  const code = randomToken();
  await AuthCode.create({
    codeHash: sha256(code),
    userId,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
  });
  return code;
};

/**
 * Redeem an OAuth exchange code exactly once.
 *
 * The find-and-mark is a single atomic update so two concurrent redemptions
 * cannot both succeed.
 */
export const consumeAuthCode = async (code) => {
  if (!code) return null;

  const record = await AuthCode.findOneAndUpdate(
    { codeHash: sha256(code), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true }
  );

  return record?.userId || null;
};
