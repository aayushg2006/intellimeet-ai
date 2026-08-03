import { z } from 'zod';

// ─── AUTH SCHEMAS ───

export const registerSchema = z.object({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be at most 255 characters'),
  password: z
    .string({ error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export const loginSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .email('Invalid email address'),
  password: z
    .string({ error: 'Password is required' })
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
    .optional(),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ error: 'Reset token is required' })
    .min(1, 'Reset token is required'),
  password: z
    .string({ error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export const refreshSchema = z.object({
  refreshToken: z.string({ error: 'Refresh token is required' }).min(1, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
  allDevices: z.boolean().optional(),
});

export const authCodeSchema = z.object({
  code: z.string({ error: 'Sign-in code is required' }).min(1, 'Sign-in code is required'),
});

// ─── NOTIFICATION & SEARCH SCHEMAS ───

export const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(120).optional(),
  filter: z.enum(['all', 'unread']).default('all'),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Enter at least 2 characters').max(200),
  organizationId: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(500).default(0),
});

export const askQuestionSchema = z.object({
  question: z
    .string({ error: 'A question is required' })
    .trim()
    .min(5, 'Please ask a longer question')
    .max(500, 'Question must be at most 500 characters'),
  organizationId: z.string().max(50).nullable().optional(),
});

// ─── MEETING SCHEMAS ───

export const createMeetingSchema = z.object({
  title: z
    .string({ error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters'),
  meetingType: z.enum(['internal', 'external', 'standup', 'review', 'one-on-one', 'other']),
  accessMode: z.enum(['personal', 'organization', 'teams', 'people', 'mixed']).optional(),
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
  status: z.enum(['scheduled', 'ongoing', 'completed']).optional(),
  organizationId: z.string().nullable().optional(),
  allowedParticipants: z.array(z.string()).optional(),
  allowedTeams: z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
  const allowedParticipants = data.allowedParticipants || [];
  const allowedTeams = data.allowedTeams || [];
  const accessMode = data.accessMode;

  if (accessMode && accessMode !== 'personal' && !data.organizationId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['organizationId'],
      message: 'organizationId is required for organization meetings',
    });
  }

  if (accessMode === 'teams' && allowedTeams.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['allowedTeams'],
      message: 'Select at least one team',
    });
  }

  if (accessMode === 'people' && allowedParticipants.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['allowedParticipants'],
      message: 'Select at least one person',
    });
  }

  if (accessMode === 'mixed' && allowedParticipants.length === 0 && allowedTeams.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['allowedParticipants'],
      message: 'Select at least one person or one team',
    });
  }
});

export const updateMeetingSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['scheduled', 'ongoing', 'completed']).optional(),
  accessMode: z.enum(['personal', 'organization', 'teams', 'people', 'mixed']).optional(),
});

// ─── TASK SCHEMAS ───

export const createTaskSchema = z.object({
  title: z
    .string({ error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(300, 'Title must be at most 300 characters'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be at most 2000 characters')
    .optional(),
  status: z.enum(['Todo', 'In Progress', 'In Review', 'Done']).optional(),
  meetingId: z.string().nullable().optional(),
  meetingTitle: z.string().max(200).optional(),
  dueDate: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  tags: z.array(z.string()).optional(),
  assignee: z.string().nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['Todo', 'In Progress', 'In Review', 'Done']).optional(),
  assignee: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  meetingTitle: z.string().max(200).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  tags: z.array(z.string()).optional(),
});

// ─── MESSAGE SCHEMAS ───

export const createSummarySchema = z.object({
  meetingId: z.string({ error: 'Meeting ID is required' }),
  summary: z.string().optional(),
  transcriptSummary: z.string().optional(),
  chatSummary: z.string().optional(),
  notesSummary: z.string().optional(),
  conclusions: z.string().optional(),
  generationStatus: z.enum(['pending', 'generating', 'completed', 'failed']).optional(),
  generationError: z.string().optional(),
  actionItems: z.array(z.object({
    id: z.number().optional(),
    task: z.string(),
    assignee: z.string().optional(),
    status: z.string().optional(),
    taskId: z.string().optional(),
  })).optional(),
  transcript: z.array(z.string()).optional(),
  duration: z.string().optional(),
});
