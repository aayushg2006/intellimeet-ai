import Meeting from '../models/Meeting.js';
import Message from '../models/Message.js';
import Summary from '../models/Summary.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { runSummaryPipeline } from '../services/summaryPipeline.js';
import copilotService from '../services/copilotService.js';
import { notify, resolveMentions } from '../services/notificationService.js';
import { canUserAccessMeeting } from '../utils/meetingAccess.js';
import { getOrgMembership } from '../utils/orgUtils.js';
import { stateStore } from '../lib/stateStore.js';
import { keys, TTL } from '../lib/stateKeys.js';

// Pending debounced note flushes: roomId -> setTimeout handle.
// This one stays in local memory deliberately — a timer handle is not
// serialisable, and a duplicate flush from another instance is harmless
// because notes are written last-write-wins.
const notesFlushTimers = new Map();

/**
 * Notify anyone @mentioned in a chat message.
 * Mention resolution is scoped to meeting members inside the service.
 */
const notifyMentions = async ({ io, socket, roomId, text }) => {
  const meeting = await Meeting.findOne({ roomId }).select(
    'title roomId host participants allowedParticipants allowedTeams organizationId'
  );
  if (!meeting) return;

  const mentionedIds = await resolveMentions(text, meeting);
  if (mentionedIds.length === 0) return;

  await notify({
    io,
    userIds: mentionedIds,
    type: 'mention',
    title: `${socket.userObj?.name || 'Someone'} mentioned you`,
    body: text.slice(0, 140),
    link: `/meeting/${meeting.roomId}`,
    actor: { _id: socket.user?.id, name: socket.userObj?.name },
    organizationId: meeting.organizationId,
    entityKind: 'message',
    entityId: meeting._id.toString(),
  });
};

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

  // Every key in the state store carries a TTL, so abandoned meetings expire on
  // their own. This sweep only clears the local timer map, which TTLs can't
  // reach. It is cheap and single-instance by nature.
  setInterval(() => {
    for (const [roomId, timer] of notesFlushTimers) {
      io.in(roomId)
        .fetchSockets()
        .then((sockets) => {
          if (sockets.length === 0) {
            clearTimeout(timer);
            notesFlushTimers.delete(roomId);
          }
        })
        .catch(() => {});
    }
  }, 30 * 60 * 1000);

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // A room per user, so the server can push to a specific person (e.g.
    // notifications) rather than only to a meeting or workspace. With the Redis
    // adapter this works across instances for free.
    if (socket.user?.id) {
      socket.join(`user_${socket.user.id}`);
    }

    // ─── WORKSPACE (Team) ROOMS ───
    socket.on('join-workspace', async (workspaceId) => {
      if (!workspaceId) return;

      // 'personal' is the user's own workspace; anything else is an
      // organization id and requires membership. Without this, any socket could
      // join any org's room and receive its task-refresh broadcasts.
      if (workspaceId !== 'personal') {
        const membership = await getOrgMembership(socket.user?.id, workspaceId);
        if (!membership) {
          console.warn(`[Socket] ${socket.id} denied workspace_${workspaceId}`);
          return;
        }
      }

      socket.join(`workspace_${workspaceId}`);
      console.log(`[Socket] ${socket.id} joined workspace_${workspaceId}`);
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

        const canAccess = await canUserAccessMeeting(meeting, userObj.id);
        if (!canAccess) {
          socket.emit('room-error', 'You do not have permission to join this meeting.');
          return;
        }

        // Determine if this user is the host
        const isHost = !!(userObj.id && meeting.host.toString() === userObj.id);

        // Persist on socket for use in other handlers. Guests get `roomId` set
        // here too (not on admission) because a remote socket's properties
        // cannot be written from another instance.
        socket.roomId = roomId;
        socket.userObj = userObj;
        socket.isHost = isHost;

        // Cache what the chat handler needs so it doesn't hit Mongo per message.
        await stateStore.set(
          keys.roomMeta(roomId),
          { meetingId: meeting._id.toString(), title: meeting.title },
          TTL.MEETING
        );

        if (isHost) {
          // Host joins the room immediately
          socket.join(roomId);
          console.log(`[Socket] HOST ${socket.id} (${userObj.name}) joined room ${roomId}`);

          // Tell the host they're in
          socket.emit('room-joined', { isHost: true, roomId });

          // Notify anyone already in the room
          socket.to(roomId).emit('user-connected', socket.id, userObj);

          // Flush any pending waiting room requests to the host
          const pending = Object.values(await stateStore.hgetall(keys.waiting(roomId)));
          if (pending.length > 0) {
            console.log(`[Socket] Flushing ${pending.length} waiting requests to host`);
            pending.forEach((req) => socket.emit('join-request', req));
          }
        } else {
          // Guest — put in a private waiting room
          socket.join(`waiting-${socket.id}`);
          console.log(`[Socket] GUEST ${socket.id} (${userObj.name}) waiting for room ${roomId}`);

          const requestData = { socketId: socket.id, userObj, roomId };

          // Hash keyed by socket id, so re-joining replaces rather than duplicates.
          await stateStore.hset(keys.waiting(roomId), socket.id, requestData, TTL.WAITING);

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
        // Only the host of this room may admit guests — otherwise any
        // participant could bypass the waiting room on the host's behalf.
        if (!socket.isHost || socket.roomId !== roomId) {
          return socket.emit('room-error', 'Only the host can admit participants.');
        }

        console.log(`[Socket] Host accepted guest ${guestSocketId} into room ${roomId}`);

        await stateStore.hdel(keys.waiting(roomId), guestSocketId);

        // Add to meeting participants in DB
        if (guestUserObj?.id && mongoose.Types.ObjectId.isValid(guestUserObj.id)) {
          // $addToSet is atomic, so two hosts admitting at once can't clobber
          // each other the way read-modify-save could.
          await Meeting.updateOne({ roomId }, { $addToSet: { participants: guestUserObj.id } });
        }

        // Tell the guest they're accepted
        io.to(`waiting-${guestSocketId}`).emit('join-accepted');

        // Move the guest into the room using adapter-aware calls. The previous
        // `io.sockets.sockets.get()` only sees sockets connected to THIS
        // instance, so with more than one server a guest would be silently
        // stranded in the waiting room forever.
        await io.in(guestSocketId).socketsLeave(`waiting-${guestSocketId}`);
        await io.in(guestSocketId).socketsJoin(roomId);
        console.log(`[Socket] Guest ${guestSocketId} moved into room ${roomId}`);

        // Tell everyone already in the room about the new user
        io.to(roomId).except(guestSocketId).emit('user-connected', guestSocketId, guestUserObj);
      } catch (err) {
        console.error('[Socket] accept-join error:', err);
      }
    });

    // ─── REJECT JOIN ───
    socket.on('reject-join', async (guestSocketId, roomId) => {
      if (!socket.isHost || socket.roomId !== roomId) {
        return socket.emit('room-error', 'Only the host can reject participants.');
      }

      console.log(`[Socket] Host rejected guest ${guestSocketId} from room ${roomId}`);
      await stateStore.hdel(keys.waiting(roomId), guestSocketId);
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

    // ─── MEDIA STATE CHANGE (audio/video toggle) ───
    socket.on('media-state-change', (data) => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('media-state-change', {
          socketId: socket.id,
          isAudio: data.isAudio,
          isVideo: data.isVideo,
        });
      }
    });

    // ─── CHAT ───
    socket.on('chat-message', async (msgData) => {
      try {
        if (!msgData.roomId || (!msgData.text && !msgData.fileUrl)) return;

        // Only allow posting into a room this socket has actually joined, and
        // always attribute the message to the authenticated user. The client
        // used to supply `msgData.sender`, which let any participant post as
        // somebody else.
        if (socket.roomId !== msgData.roomId) return;
        const senderId = socket.user?.id;

        if (senderId && mongoose.Types.ObjectId.isValid(senderId)) {
          const message = new Message({
            roomId: msgData.roomId,
            sender: senderId,
            text: msgData.text,
            type: msgData.type || 'text',
            fileUrl: msgData.fileUrl,
            fileName: msgData.fileName,
            fileSize: msgData.fileSize,
          });
          await message.save();
          const populated = await Message.findById(message._id).populate('sender', 'name avatar');
          io.to(msgData.roomId).emit('chat-message', populated);

          // @mentions — best-effort, never blocks message delivery.
          if (msgData.text?.includes('@')) {
            notifyMentions({ io, socket, roomId: msgData.roomId, text: msgData.text }).catch((err) =>
              console.error('[Socket] mention notify failed:', err.message)
            );
          }
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
        const pending = notesFlushTimers.get(roomId);
        if (pending) clearTimeout(pending);
        notesFlushTimers.set(roomId, setTimeout(async () => {
          notesFlushTimers.delete(roomId);
          try {
            await Meeting.updateOne({ roomId }, { $set: { notes } });
          } catch (err) {
            console.error('[Socket] note flush failed:', err.message);
          }
        }, 3000));
      } catch (error) {
        console.error('[Socket] note-update error:', error);
      }
    });

    // ─── AI AUDIO TRANSCRIPTION ───
    // Receives a transcribed line of text from a user's browser
    socket.on('audio-transcription', async (roomId, text) => {
      try {
        if (!text || !text.trim() || socket.roomId !== roomId) return;

        const transcriptLine = `${socket.userObj?.name || 'Guest'}: ${text}`;
        await stateStore.listPush(keys.transcript(roomId), transcriptLine);
        await stateStore.expire(keys.transcript(roomId), TTL.MEETING);
        io.to(roomId).emit('transcript-update', transcriptLine);

        // Persist to MongoDB incrementally so transcripts survive server restarts
        try {
          let summaryDocId = await stateStore.get(keys.summaryDoc(roomId));

          if (!summaryDocId) {
            const meeting = await Meeting.findOne({ roomId });
            if (meeting) {
              // Upsert rather than find-then-create: two transcript lines
              // arriving together used to race and both try to insert, which
              // the unique index on meetingId rejects.
              const summaryDoc = await Summary.findOneAndUpdate(
                { meetingId: meeting._id },
                {
                  $setOnInsert: {
                    meetingId: meeting._id,
                    organizationId: meeting.organizationId,
                    title: meeting.title,
                    date: meeting.createdAt.toISOString().split('T')[0],
                  },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
              );
              summaryDocId = summaryDoc._id.toString();
              await stateStore.set(keys.summaryDoc(roomId), summaryDocId, TTL.MEETING);
            }
          }

          if (summaryDocId) {
            await Summary.updateOne({ _id: summaryDocId }, { $push: { transcript: transcriptLine } });
          }
        } catch (dbErr) {
          console.error('[Socket] Failed to persist transcript line:', dbErr.message);
        }

        // Live copilot analysis — fire-and-forget so a slow or failing AI call
        // can never delay or drop transcript persistence.
        copilotService.onTranscriptLine(io, roomId).catch((err) =>
          console.error('[Copilot] tick failed:', err.message)
        );
      } catch (err) {
        console.error('Error handling transcript chunk:', err);
      }
    });

    // ─── END MEETING ───
    socket.on('end-meeting', async (roomId) => {
      if (socket.roomId !== roomId || !socket.isHost) return;

      try {
        // Atomically flip to completed, so a double-click (or a retry) can't
        // start two summary generations.
        const meeting = await Meeting.findOneAndUpdate(
          { roomId, status: { $ne: 'completed' } },
          { $set: { status: 'completed', endedAt: new Date() } },
          { new: true }
        );

        // Tell the room either way — the second caller still needs to be kicked out.
        io.to(roomId).emit('meeting-ended');

        if (!meeting) return;

        console.log(`[Socket] Meeting ${roomId} ended by host`);

        // Fire-and-forget: summary generation takes tens of seconds and must
        // not hold the socket handler open.
        runSummaryPipeline({ io, meetingId: meeting._id, roomId }).catch((err) =>
          console.error('[Socket] summary pipeline failed:', err.message)
        );
      } catch (error) {
        console.error('[Socket] end-meeting error:', error);
      }
    });

    // ─── LIVE COPILOT ───
    // `copilot:insights` only carries newly-found items, so a client joining
    // late (or reconnecting) asks for the full picture once.
    socket.on('copilot:sync', async (roomId) => {
      if (socket.roomId !== roomId) return;
      socket.emit('copilot:snapshot', await copilotService.getSnapshot(roomId));
    });

    // ─── DISCONNECT ───
    socket.on('disconnect', async () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);

      // We know which room this socket was in, so this is a single targeted
      // delete rather than a scan of every waiting room on the server.
      if (socket.roomId) {
        await stateStore.hdel(keys.waiting(socket.roomId), socket.id);
        socket.to(socket.roomId).emit('user-disconnected', socket.id);
      }
    });
  });
};

export default socketHandler;
