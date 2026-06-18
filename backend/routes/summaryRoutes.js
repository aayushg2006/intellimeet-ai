import express from 'express';
import { getSummaryByMeeting, createSummary } from '../controllers/summaryController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, createSummary);
router.route('/:meetingId').get(protect, getSummaryByMeeting);

export default router;
