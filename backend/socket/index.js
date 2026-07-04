import Meeting from '../models/Meeting.js';
import Message from '../models/Message.js';
import Summary from '../models/Summary.js';
import mongoose from 'mongoose';
import aiService from '../services/aiService.js';
import jwt from 'jsonwebtoken';

// In-memory waiting room: roomId -> [{ socketId, userObj }]
const waitingRooms = {};

// In-memory transcripts: roomId -> [ "sentence 1", "sentence 2" ]
const roomTranscripts = {};
const notesBuffer = {};
const summaryCache = {};

const socketHandler = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // Contains id
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  // Cleanup interval every 30 minutes for abandoned meetings
  setInterval(() => {
    const allRooms = io.sockets.adapter.rooms;
    for (const roomId in roomTranscripts) {
      if (!allRooms.has(roomId)) {
        delete roomTranscripts[roomId];
        delete waitingRooms[roomId];
        delete summaryCache[roomId];
        if (notesBuffer[roomId]) {
          clearTimeout(notesBuffer[roomId]);
          delete notesBuffer[roomId];
        }
      }
    }
  }, 30 * 60 * 1000);

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ─── WORKSPACE (Team) ROOMS ───
    socket.on('join-workspace', (workspaceId) => {
      if (workspaceId) {
        socket.join(`workspace_${workspaceId}`);
        console.log(`[Socket] ${socket.id} joined workspace_${workspaceId}`);
      }
    });

    socket.on('leave-workspace', (workspaceId) => {
      if (workspaceId) {
        socket.leave(`workspace_${workspaceId}`);
        console.log(`[Socket] ${socket.id} left workspace_${workspaceId}`);
      }
    });

    socket.on('task-updated', (workspaceId) => {
      // Broadcast to everyone else in this workspace to refresh their tasks
      if (workspaceId) {
        socket.to(`workspace_${workspaceId}`).emit('refresh-tasks');
      }
    });

    // ─── JOIN ROOM ───
    socket.on('join-room', async (roomId, userObj) => {
      try {
        const meeting = await Meeting.findOne({ roomId });
        if (!meeting) {
          socket.emit('room-error', 'Meeting not found');
          return;
        }

        // Determine if this user is the host
        const isHost = !!(userObj.id && meeting.host.toString() === userObj.id);

        // Persist on socket for use in other handlers
        socket.roomId = roomId;
        socket.userObj = userObj;
        socket.isHost = isHost;

        if (isHost) {
          // Host joins the room immediately
          socket.join(roomId);
          console.log(`[Socket] HOST ${socket.id} (${userObj.name}) joined room ${roomId}`);

          // Tell the host they're in
          socket.emit('room-joined', { isHost: true, roomId });

          // Notify anyone already in the room
          socket.to(roomId).emit('user-connected', socket.id, userObj);

          // Flush any pending waiting room requests to the host
          if (waitingRooms[roomId] && waitingRooms[roomId].length > 0) {
            console.log(`[Socket] Flushing ${waitingRooms[roomId].length} waiting requests to host`);
            waitingRooms[roomId].forEach((req) => {
              socket.emit('join-request', req);
            });
          }
        } else {
          // Guest — put in a private waiting room
          socket.join(`waiting-${socket.id}`);
          console.log(`[Socket] GUEST ${socket.id} (${userObj.name}) waiting for room ${roomId}`);

          const requestData = { socketId: socket.id, userObj, roomId };

          // Store in waiting room (avoid duplicates)
          if (!waitingRooms[roomId]) waitingRooms[roomId] = [];
          if (!waitingRooms[roomId].find((r) => r.socketId === socket.id)) {
            waitingRooms[roomId].push(requestData);
          }

          // Broadcast to the room (host will pick it up)
          io.to(roomId).emit('join-request', requestData);
        }
      } catch (err) {
        console.error('[Socket] join-room error:', err);
        socket.emit('room-error', 'Server error joining room');
      }
    });

    // ─── ACCEPT JOIN ───
    socket.on('accept-join', async (guestSocketId, roomId, guestUserObj) => {
      try {
        console.log(`[Socket] Host accepted guest ${guestSocketId} into room ${roomId}`);

        // Remove from waiting list
        if (waitingRooms[roomId]) {
          waitingRooms[roomId] = waitingRooms[roomId].filter((r) => r.socketId !== guestSocketId);
        }

        // Add to meeting participants in DB
        const meeting = await Meeting.findOne({ roomId });
        if (meeting && guestUserObj && guestUserObj.id && mongoose.Types.ObjectId.isValid(guestUserObj.id)) {
          if (!meeting.participants.map(String).includes(guestUserObj.id)) {
            meeting.participants.push(guestUserObj.id);
            await meeting.save();
          }
        }

        // Tell the guest they're accepted
        io.to(`waiting-${guestSocketId}`).emit('join-accepted');

        // Move guest socket into the actual room
        const guestSocket = io.sockets.sockets.get(guestSocketId);
        if (guestSocket) {
          guestSocket.leave(`waiting-${guestSocketId}`);
          guestSocket.join(roomId);
          guestSocket.roomId = roomId;
          console.log(`[Socket] Guest ${guestSocketId} moved into room ${roomId}`);

          // Tell everyone in the room (including the host) about the new user
          guestSocket.to(roomId).emit('user-connected', guestSocketId, guestUserObj);
        }
      } catch (err) {
        console.error('[Socket] accept-join error:', err);
      }
    });

    // ─── REJECT JOIN ───
    socket.on('reject-join', (guestSocketId, roomId) => {
      console.log(`[Socket] Host rejected guest ${guestSocketId} from room ${roomId}`);
      if (waitingRooms[roomId]) {
        waitingRooms[roomId] = waitingRooms[roomId].filter((r) => r.socketId !== guestSocketId);
      }
      io.to(`waiting-${guestSocketId}`).emit('join-rejected');
    });

    // ─── WEBRTC SIGNALING ───
    socket.on('webrtc-offer', (offer, toSocketId) => {
      socket.to(toSocketId).emit('webrtc-offer', offer, socket.id, socket.userObj);
    });

    socket.on('webrtc-answer', (answer, toSocketId) => {
      socket.to(toSocketId).emit('webrtc-answer', answer, socket.id);
    });

    socket.on('ice-candidate', (candidate, toSocketId) => {
      socket.to(toSocketId).emit('ice-candidate', candidate, socket.id);
    });

    // ─── REACTIONS ───
    socket.on('send-reaction', (emoji) => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('user-reaction', {
          socketId: socket.id,
          emoji,
          name: socket.userObj?.name || 'Guest',
        });
      }
    });

    // ─── RAISE HAND ───
    socket.on('raise-hand', (raised) => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('user-hand', {
          socketId: socket.id,
          raised,
          name: socket.userObj?.name || 'Guest',
        });
      }
    });

    // ─── SCREEN SHARING NOTIFICATION ───
    socket.on('screen-share-started', () => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('user-screen-share', {
          socketId: socket.id,
          sharing: true,
          name: socket.userObj?.name || 'Guest',
        });
      }
    });

    socket.on('screen-share-stopped', () => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('user-screen-share', {
          socketId: socket.id,
          sharing: false,
          name: socket.userObj?.name || 'Guest',
        });
      }
    });

    // ─── CHAT ───
    socket.on('chat-message', async (msgData) => {
      try {
        if (!msgData.roomId || (!msgData.text && !msgData.fileUrl)) return;

        // If sender is a valid ObjectId, save to DB
        if (msgData.sender && mongoose.Types.ObjectId.isValid(msgData.sender)) {
          const message = new Message({
            roomId: msgData.roomId,
            sender: msgData.sender,
            text: msgData.text,
            type: msgData.type || 'text',
            fileUrl: msgData.fileUrl,
            fileName: msgData.fileName,
            fileSize: msgData.fileSize,
          });
          await message.save();
          const populated = await Message.findById(message._id).populate('sender', 'name avatar');
          io.to(msgData.roomId).emit('chat-message', populated);
        } else {
          // Guest without valid user ID — broadcast without DB save
          io.to(msgData.roomId).emit('chat-message', {
            _id: Date.now().toString(),
            sender: { name: socket.userObj?.name || 'Guest', _id: null },
            text: msgData.text,
            type: msgData.type || 'text',
            fileUrl: msgData.fileUrl,
            fileName: msgData.fileName,
            fileSize: msgData.fileSize,
            createdAt: new Date(),
          });
        }
      } catch (error) {
        console.error('[Socket] chat-message error:', error);
      }
    });

    // ─── SHARED NOTES ───
    socket.on('note-update', async (roomId, notes) => {
      try {
        if (!roomId) return;
        socket.to(roomId).emit('note-update', notes);

        // Throttle saving to DB to once every 3 seconds per room
        if (notesBuffer[roomId]) clearTimeout(notesBuffer[roomId]);
        notesBuffer[roomId] = setTimeout(async () => {
          await Meeting.updateOne({ roomId }, { $set: { notes } });
          delete notesBuffer[roomId];
        }, 3000);
      } catch (error) {
        console.error('[Socket] note-update error:', error);
      }
    });

    // ─── AI AUDIO TRANSCRIPTION ───
    // Receives a transcribed line of text from a user's browser
    socket.on('audio-transcription', async (roomId, text) => {
      try {
        if (!roomTranscripts[roomId]) roomTranscripts[roomId] = [];
        
        if (text && text.trim().length > 0) {
          const transcriptLine = `${socket.userObj?.name || 'Guest'}: ${text}`;
          roomTranscripts[roomId].push(transcriptLine);
          io.to(roomId).emit('transcript-update', transcriptLine);

          // Persist to MongoDB incrementally so transcripts survive server restarts
          try {
            let cache = summaryCache[roomId];
            if (!cache) {
              const meeting = await Meeting.findOne({ roomId });
              if (meeting) {
                let summaryDoc = await Summary.findOne({ meetingId: meeting._id });
                if (!summaryDoc) {
                  summaryDoc = new Summary({
                    meetingId: meeting._id,
                    organizationId: meeting.organizationId,
                    title: meeting.title,
                    date: meeting.createdAt.toISOString().split('T')[0],
                    transcript: []
                  });
                  await summaryDoc.save();
                }
                cache = { summaryDocId: summaryDoc._id };
                summaryCache[roomId] = cache;
              }
            }
            
            if (cache) {
              await Summary.updateOne(
                { _id: cache.summaryDocId },
                { $push: { transcript: transcriptLine } }
              );
            }
          } catch (dbErr) {
            console.error('[Socket] Failed to persist transcript line:', dbErr.message);
          }
        }
      } catch (err) {
        console.error('Error handling transcript chunk:', err);
      }
    });

    // ─── END MEETING ───
    socket.on('end-meeting', async (roomId) => {
      if (socket.roomId === roomId && socket.isHost) {
        try {
          const meeting = await Meeting.findOne({ roomId });
          if (meeting) {
            const wasAlreadyCompleted = meeting.status === 'completed';
            if (!wasAlreadyCompleted) {
              meeting.status = 'completed';
              meeting.endedAt = new Date();
              await meeting.save();
              console.log(`[Socket] Meeting ${roomId} ended by host`);
            }
            
            // Notify all users in the room that the meeting has ended (even if already marked completed)
            io.to(roomId).emit('meeting-ended');

            if (!wasAlreadyCompleted) {
              // --- AI Summary Generation (fire-and-forget) ---
              // Run in background so the socket handler completes immediately
              const meetingId = meeting._id;
              const meetingOrgId = meeting.organizationId;
              const meetingTitle = meeting.title;
              const meetingDate = meeting.createdAt.toISOString().split('T')[0];

              (async () => {
                try {
                  // Read transcript from DB (survives server restarts)
                  let summaryDoc = await Summary.findOne({ meetingId });
                  const transcript = summaryDoc?.transcript || roomTranscripts[roomId] || [];
                  
                  if (transcript.length > 0) {
                    const fullTranscriptText = transcript.join('\n');
                    console.log(`[AI] Generating summary for meeting ${roomId}...`);
                    
                    // Ensure summary doc exists
                    if (!summaryDoc) {
                      summaryDoc = new Summary({
                        meetingId,
                        organizationId: meetingOrgId,
                        title: meetingTitle,
                        date: meetingDate,
                        transcript: transcript
                      });
                      await summaryDoc.save();
                    }

                    // Call Ollama for summary and action items
                    const { summary, actionItems } = await aiService.generateSummary(fullTranscriptText);
                    
                    await Summary.updateOne(
                      { _id: summaryDoc._id },
                      {
                        $set: {
                          summary: summary,
                          actionItems: actionItems.map((item, index) => ({
                            id: index + 1,
                            task: item,
                            assignee: 'Unassigned',
                            status: 'pending'
                          }))
                        }
                      }
                    );
                    console.log(`[AI] Summary saved for meeting ${roomId}.`);
                  }
                  
                  // Clear in-memory copy
                  delete roomTranscripts[roomId];
                } catch (aiErr) {
                  console.error(`[AI] Background summary generation failed for ${roomId}:`, aiErr.message);
                }
              })();
            }
          }
        } catch (error) {
          console.error('[Socket] end-meeting error:', error);
        }
      }
    });

    // ─── DISCONNECT ───
    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);

      // Clean up from waiting rooms
      Object.keys(waitingRooms).forEach((roomId) => {
        waitingRooms[roomId] = waitingRooms[roomId].filter((r) => r.socketId !== socket.id);
        if (waitingRooms[roomId].length === 0) {
          delete waitingRooms[roomId];
        }
      });

      // Notify room participants
      if (socket.roomId) {
        socket.to(socket.roomId).emit('user-disconnected', socket.id);
      }
    });
  });
};

export default socketHandler;
