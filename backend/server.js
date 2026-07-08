import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import http from 'http';
import dns from 'dns';
import helmet from 'helmet';
import passport from 'passport';
import { Server } from 'socket.io';
import socketHandler from './socket/index.js';
import configurePassport from './config/passport.js';
import './config/redis.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Triggering server restart to load latest .env variables
// Environment variables are loaded automatically via import 'dotenv/config'

// ─── PROCESS ERROR HANDLERS ───
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fatal] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Fatal] Uncaught Exception:', err);
});

dns.setServers([
  "8.8.8.8",
  "8.8.4.4"
]);

const app = express();
const server = http.createServer(app);

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
    origin: process.env.NODE_ENV !== 'production' ? true : allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

// Pass io to our socket handler
socketHandler(io);

// ─── SECURITY MIDDLEWARE ───
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Relaxed for dev; tighten in production
}));

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins (useful for local network testing)
    if (process.env.NODE_ENV !== 'production') {
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

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/summaries', summaryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/uploads', uploadRoutes);

// ─── ERROR HANDLING (must be after all routes) ───
app.use(notFound);
app.use(errorHandler);

// ─── DATABASE & SERVER ───
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
