import express from 'express';
import { getTasks, createTask, updateTask } from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { createTaskSchema, updateTaskSchema } from '../validators/schemas.js';

const router = express.Router();

router.route('/').get(protect, getTasks).post(protect, validate(createTaskSchema), createTask);
router.route('/:id').put(protect, validate(updateTaskSchema), updateTask);

export default router;
