import { z } from 'zod';

// ─── AUTH SCHEMAS ───

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be at most 255 characters'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  avatar: z
    .string()
    .url('Avatar must be a valid URL')
    .optional(),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: 'Reset token is required' })
    .min(1, 'Reset token is required'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be at most 128 characters'),
});

// ─── MEETING SCHEMAS ───

export const createMeetingSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be at most 2000 characters')
    .optional(),
  scheduledAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().optional()),
  roomId: z
    .string()
    .trim()
    .max(50, 'Room ID must be at most 50 characters')
    .optional(),
});

export const updateMeetingSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['scheduled', 'ongoing', 'completed']).optional(),
});

// ─── TASK SCHEMAS ───

export const createTaskSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(300, 'Title must be at most 300 characters'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be at most 2000 characters')
    .optional(),
  status: z.enum(['Todo', 'In Progress', 'In Review', 'Done']).optional(),
  meetingId: z.string().optional(),
  dueDate: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['Todo', 'In Progress', 'In Review', 'Done']).optional(),
  assignee: z.string().optional(),
});

// ─── MESSAGE SCHEMAS ───

export const createSummarySchema = z.object({
  meetingId: z.string({ required_error: 'Meeting ID is required' }),
  summary: z.string().optional(),
  actionItems: z.array(z.object({
    id: z.number().optional(),
    task: z.string(),
    assignee: z.string().optional(),
    status: z.string().optional(),
  })).optional(),
  transcript: z.array(z.string()).optional(),
  duration: z.string().optional(),
});
