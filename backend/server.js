import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import dns from 'dns';
import { Server } from 'socket.io';
import socketHandler from './socket/index.js';

// Load environment variables
dotenv.config();

dns.setServers([
  "8.8.8.8",
  "8.8.4.4"
]);

const app = express();
const server = http.createServer(app);

// Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // For development
    methods: ['GET', 'POST']
  }
});

// Pass io to our socket handler
socketHandler(io);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
import authRoutes from './routes/authRoutes.js';
import meetingRoutes from './routes/meetingRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import summaryRoutes from './routes/summaryRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/summaries', summaryRoutes);
app.use('/api/analytics', analyticsRoutes);

// Database Connection
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const MAX_PORT_ATTEMPTS = 10;

const startServer = (port, attempt = 1) => {
  const onError = (err) => {
    server.off('listening', onListening);

    if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      const nextPort = Number(port) + 1;
      console.warn(`Port ${port} is in use, trying ${nextPort}...`);
      startServer(nextPort, attempt + 1);
      return;
    }

    console.error('Server start error:', err);
  };

  const onListening = () => {
    server.off('error', onError);
    const address = server.address();
    const activePort = typeof address === 'object' && address ? address.port : port;
    console.log(`Server is running on port ${activePort}`);
  };

  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port);
};

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    startServer(PORT);
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
