import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import http from 'http';
import dns from 'dns';
import helmet from 'helmet';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import { sanitizeRequest } from './middleware/sanitize.js';
import socketHandler from './socket/index.js';
import configurePassport from './config/passport.js';
import { bootstrapState } from './lib/bootstrapState.js';
import { startStaleSummaryReaper } from './jobs/staleSummaryReaper.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Triggering server restart to load latest .env variables
// Environment variables are loaded automatically via import 'dotenv/config'

// ─── PROCESS ERROR HANDLERS ───
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fatal] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  // Continuing after an uncaught exception leaves the process in an undefined
  // state — half-applied writes, leaked handles. Log, then let the platform
  // restart us cleanly.
  console.error('[Fatal] Uncaught Exception:', err);
  shutdown('uncaughtException', 1);
});

dns.setServers([
  "8.8.8.8",
  "8.8.4.4"
]);

const isDevelopment = process.env.NODE_ENV === 'development';

const app = express();
const server = http.createServer(app);

// Render terminates TLS upstream; without this express-rate-limit sees every
// request as coming from the proxy's IP and rate-limits all users as one.
app.set('trust proxy', 1);

// ─── ALLOWED ORIGINS ───
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

// Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: isDevelopment ? true : allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

// Pass io to our socket handler
socketHandler(io);

// Make io reachable from controllers (req.app.get('io')) so they can push
// notifications. Set on the app rather than exported to avoid a circular
// import between server.js and the route modules it loads.
app.set('io', io);

// ─── SECURITY MIDDLEWARE ───
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // This is a JSON API — it serves no HTML of its own, so a restrictive policy
  // costs nothing. It previously ran with CSP disabled entirely.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
}));

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Only relax the origin check when explicitly running in development.
    // The previous `!== 'production'` check meant any deployment that forgot to
    // set NODE_ENV accepted requests from every origin on the internet.
    if (isDevelopment) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(sanitizeRequest);

// Baseline abuse protection across the whole API. Auth and password-reset
// routes keep their own tighter limits on top of this.
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PER_MINUTE || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down.' },
  // The health check is polled by Render's monitor.
  skip: (req) => req.path === '/health',
}));

// ─── PASSPORT ───
configurePassport();
app.use(passport.initialize());

// ─── HEALTH CHECK ───
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Render ping route
app.get('/', (_req, res) => {
  res.send('IntellMeet API is running');
});

// ─── ROUTES ───
import authRoutes from './routes/authRoutes.js';
import meetingRoutes from './routes/meetingRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import summaryRoutes from './routes/summaryRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import rtcRoutes from './routes/rtcRoutes.js';

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/summaries', summaryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
// Mounted separately rather than under /api/summaries, whose greedy
// `/:meetingId` route would otherwise swallow these paths.
app.use('/api/search', searchRoutes);
app.use('/api/rtc', rtcRoutes);

// ─── ERROR HANDLING (must be after all routes) ───
app.use(notFound);
app.use(errorHandler);

// ─── DATABASE & SERVER ───
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');

    // Attach Redis-backed shared state and the socket adapter when available.
    // Never throws: with no Redis this simply reports the in-memory driver.
    await bootstrapState(io);

    // Recover summaries left mid-generation by a previous restart.
    startStaleSummaryReaper();

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    // Without a live database the process can serve nothing useful. Exiting
    // lets the platform restart and retry instead of sitting up but broken.
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// ─── GRACEFUL SHUTDOWN ───
let shuttingDown = false;

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Shutdown] Received ${signal}, closing gracefully...`);

  // Force-exit if something hangs; Render sends SIGKILL after 30s anyway.
  const forceExit = setTimeout(() => {
    console.error('[Shutdown] Graceful close timed out, forcing exit.');
    process.exit(exitCode || 1);
  }, 10000);
  forceExit.unref();

  try {
    io.close();
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.close(false);
    console.log('[Shutdown] Closed cleanly.');
  } catch (err) {
    console.error('[Shutdown] Error while closing:', err);
    exitCode = exitCode || 1;
  }

  clearTimeout(forceExit);
  process.exit(exitCode);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
