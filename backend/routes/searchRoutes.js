import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
  searchMeetings,
  askMeetings,
  getSearchCapabilities,
} from '../controllers/searchController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { searchQuerySchema, askQuestionSchema } from '../validators/schemas.js';

const router = express.Router();

router.use(protect);

// Keyword search is cheap; this only stops runaway clients.
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many searches, please slow down.' },
});

// Each "ask" is an embedding call plus a generation call, so it is metered far
// more tightly — this is the only endpoint that costs real money per request.
const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Meter per user, not per IP — a shared office NAT would otherwise let one
  // person exhaust everyone's budget. `ipKeyGenerator` normalises IPv6 so a
  // client can't evade the limit by rotating within its /64.
  keyGenerator: (req) => (req.user?._id ? `user:${req.user._id}` : ipKeyGenerator(req)),
  message: { message: 'Too many questions in a short time. Please wait a moment.' },
});

router.get('/capabilities', getSearchCapabilities);
router.get('/', searchLimiter, validateQuery(searchQuerySchema), searchMeetings);
router.post('/ask', askLimiter, validate(askQuestionSchema), askMeetings);

export default router;
