import express from 'express';
import { getSummaryByMeeting, createSummary } from '../controllers/summaryController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { createSummarySchema } from '../validators/schemas.js';

const router = express.Router();

router.route('/').post(protect, validate(createSummarySchema), createSummary);
router.route('/:meetingId').get(protect, getSummaryByMeeting);

export default router;
