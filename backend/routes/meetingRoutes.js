import express from 'express';
import { getMeetings, getMeetingById, createMeeting, updateMeeting, getMeetingByRoomId } from '../controllers/meetingController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').get(protect, getMeetings).post(protect, createMeeting);
router.route('/room/:roomId').get(getMeetingByRoomId); // Make this public for guests
router.route('/:id').get(protect, getMeetingById).put(protect, updateMeeting);

export default router;
