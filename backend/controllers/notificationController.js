import Notification from '../models/Notification.js';
import { shapeForClient } from '../services/notificationService.js';

/**
 * Cursor format: `<createdAtISO>_<id>`.
 *
 * Keyset pagination rather than skip/limit: notifications arrive constantly, so
 * an offset-based page 2 would silently skip or repeat rows as new ones land.
 */
const parseCursor = (cursor) => {
  if (!cursor) return null;

  const separator = cursor.lastIndexOf('_');
  if (separator === -1) return null;

  const at = new Date(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);

  return Number.isNaN(at.getTime()) ? null : { at, id };
};

const buildCursor = (doc) => `${doc.createdAt.toISOString()}_${doc._id}`;

/**
 * @route GET /api/notifications
 */
export const listNotifications = async (req, res, next) => {
  try {
    const { limit, cursor, filter } = req.validated.query;

    const query = { userId: req.user._id };
    if (filter === 'unread') query.read = false;

    const position = parseCursor(cursor);
    if (position) {
      query.$or = [
        { createdAt: { $lt: position.at } },
        { createdAt: position.at, _id: { $lt: position.id } },
      ];
    }

    // Fetch one extra to detect whether another page exists.
    const rows = await Notification.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });

    res.json({
      items: items.map(shapeForClient),
      nextCursor: hasMore ? buildCursor(items[items.length - 1]) : null,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    res.json({ count: await Notification.countDocuments({ userId: req.user._id, read: false }) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route PATCH /api/notifications/:id/read
 */
export const markRead = async (req, res, next) => {
  try {
    // Scoped by userId, so an id belonging to someone else is a 404, not an edit.
    const result = await Notification.updateOne(
      { _id: req.params.id, userId: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      const exists = await Notification.exists({ _id: req.params.id, userId: req.user._id });
      if (!exists) return res.status(404).json({ message: 'Notification not found' });
    }

    const count = await Notification.countDocuments({ userId: req.user._id, read: false });

    // Keep the badge in sync across this user's other open tabs.
    req.app.get('io')?.to(`user_${req.user._id}`).emit('notification:unread', { count });

    res.json({ message: 'Marked as read', unreadCount: count });
  } catch (error) {
    next(error);
  }
};

/**
 * @route PATCH /api/notifications/read-all
 */
export const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    req.app.get('io')?.to(`user_${req.user._id}`).emit('notification:unread', { count: 0 });

    res.json({ message: 'All notifications marked as read', unreadCount: 0 });
  } catch (error) {
    next(error);
  }
};
