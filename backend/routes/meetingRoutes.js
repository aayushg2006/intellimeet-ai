import express from 'express';
import { getMeetings, getMeetingById, createMeeting, updateMeeting, getMeetingByRoomId } from '../controllers/meetingController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { createMeetingSchema, updateMeetingSchema } from '../validators/schemas.js';

const router = express.Router();

router.route('/').get(protect, getMeetings).post(protect, validate(createMeetingSchema), createMeeting);
router.route('/room/:roomId').get(getMeetingByRoomId); // Public for guests
router.route('/:id').get(protect, getMeetingById).put(protect, validate(updateMeetingSchema), updateMeeting);

export default router;
