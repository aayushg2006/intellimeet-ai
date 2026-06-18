import Meeting from '../models/Meeting.js';
import Message from '../models/Message.js';

const socketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join meeting room
    socket.on('join-room', async (roomId, userObj) => {
      try {
        const meeting = await Meeting.findOne({ roomId });
        if (!meeting) {
          socket.emit('room-error', 'Meeting not found');
          return;
        }

        if (userObj.id && !meeting.participants.includes(userObj.id)) {
          meeting.participants.push(userObj.id);
          await meeting.save();
        }

        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
        
        // Notify others in the room
        socket.to(roomId).emit('user-connected', socket.id, userObj);

        // Handle WebRTC signaling
        socket.on('webrtc-offer', (offer, toSocketId) => {
          socket.to(toSocketId).emit('webrtc-offer', offer, socket.id, userObj);
        });

        socket.on('webrtc-answer', (answer, toSocketId) => {
          socket.to(toSocketId).emit('webrtc-answer', answer, socket.id);
        });

        socket.on('ice-candidate', (candidate, toSocketId) => {
          socket.to(toSocketId).emit('ice-candidate', candidate, socket.id);
        });

        // Handle real-time chat
        socket.on('chat-message', async (msgData) => {
          try {
            // msgData expected: { roomId, sender (userId), text }
            const message = new Message({
              roomId: msgData.roomId,
              sender: msgData.sender,
              text: msgData.text
            });
            await message.save();
            
            const populatedMessage = await Message.findById(message._id).populate('sender', 'name avatar');
            
            io.to(roomId).emit('chat-message', populatedMessage);
          } catch (error) {
            console.error('Chat message error:', error);
          }
        });

        // Disconnect
        socket.on('disconnect', () => {
          console.log(`User ${socket.id} disconnected from room: ${roomId}`);
          socket.to(roomId).emit('user-disconnected', socket.id);
        });

      } catch (err) {
        console.error('Socket join-room error:', err);
      }
    });
  });
};

export default socketHandler;
