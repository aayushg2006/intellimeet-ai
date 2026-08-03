import express from 'express';
import {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateQuery } from '../middleware/validate.js';
import { notificationListQuerySchema } from '../validators/schemas.js';

const router = express.Router();

router.use(protect);

router.get('/', validateQuery(notificationListQuerySchema), listNotifications);
router.get('/unread-count', getUnreadCount);
// Defined before '/:id/read' so the literal path isn't captured as an id.
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

export default router;
