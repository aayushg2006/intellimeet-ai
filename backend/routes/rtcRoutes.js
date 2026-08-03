import express from 'express';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Public STUN servers. These are enough to discover a peer's public address,
 * but they cannot relay media — so on symmetric NAT (most corporate networks,
 * many mobile carriers) a call between two such peers will silently fail to
 * connect. A TURN server is what fixes that.
 */
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

/**
 * @route GET /api/rtc/ice-servers
 * @desc  ICE configuration for the WebRTC peer connections
 *
 * Credentials are served from the backend rather than baked into the bundle so
 * they are not readable by anyone who opens devtools on the landing page, and
 * so they can be rotated without a frontend redeploy.
 */
router.get('/ice-servers', protect, (_req, res) => {
  const iceServers = [...STUN_SERVERS];

  const { TURN_URL, TURN_USERNAME, TURN_CREDENTIAL } = process.env;

  if (TURN_URL && TURN_USERNAME && TURN_CREDENTIAL) {
    // Comma-separated so one env var can carry both UDP and TCP/TLS endpoints.
    iceServers.push({
      urls: TURN_URL.split(',').map((url) => url.trim()).filter(Boolean),
      username: TURN_USERNAME,
      credential: TURN_CREDENTIAL,
    });
  }

  res.json({
    iceServers,
    // Lets the client warn the user that connectivity may be unreliable on
    // restrictive networks, instead of just showing a black tile.
    turnConfigured: Boolean(TURN_URL && TURN_USERNAME && TURN_CREDENTIAL),
  });
});

export default router;
