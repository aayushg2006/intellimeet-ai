import Meeting from '../models/Meeting.js';
import Message from '../models/Message.js';
import mongoose from 'mongoose';

// In-memory waiting room: roomId -> [{ socketId, userObj }]
const waitingRooms = {};

const socketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

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
        if (!msgData.roomId || !msgData.text) return;

        // If sender is a valid ObjectId, save to DB
        if (msgData.sender && mongoose.Types.ObjectId.isValid(msgData.sender)) {
          const message = new Message({
            roomId: msgData.roomId,
            sender: msgData.sender,
            text: msgData.text,
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
            createdAt: new Date(),
          });
        }
      } catch (error) {
        console.error('[Socket] chat-message error:', error);
      }
    });

    // ─── END MEETING ───
    socket.on('end-meeting', async (roomId) => {
      if (socket.roomId === roomId && socket.isHost) {
        try {
          const meeting = await Meeting.findOne({ roomId });
          if (meeting && meeting.status !== 'completed') {
            meeting.status = 'completed';
            meeting.endedAt = new Date();
            await meeting.save();
            console.log(`[Socket] Meeting ${roomId} ended by host`);
            // Notify all users in the room that the meeting has ended
            io.to(roomId).emit('meeting-ended');
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
