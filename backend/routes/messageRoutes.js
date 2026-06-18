import express from 'express';
import { getMessagesByRoom } from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/:roomId').get(protect, getMessagesByRoom);

export default router;
