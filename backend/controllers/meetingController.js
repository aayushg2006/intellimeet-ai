import Meeting from '../models/Meeting.js';
import crypto from 'crypto';
import { canUserAccessMeeting, canUserCreateMeeting } from '../utils/meetingAccess.js';
import { getOrgMembership } from '../utils/orgUtils.js';
import { notify, resolveMeetingRecipients } from '../services/notificationService.js';

const notifyInvitees = async ({ req, meeting }) => {
  const userIds = await resolveMeetingRecipients(meeting);
  if (userIds.length === 0) return;

  const when = meeting.scheduledAt
    ? new Date(meeting.scheduledAt).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : 'now';

  await notify({
    io: req.app.get('io'),
    userIds,
    type: 'meeting_invite',
    title: `${req.user.name} invited you to a meeting`,
    body: `${meeting.title} — ${when}`,
    link: `/meeting/${meeting.roomId}`,
    actor: req.user,
    organizationId: meeting.organizationId || null,
    entityKind: 'meeting',
    entityId: meeting._id.toString(),
    dedupeKeyFor: (userId) => `meeting_invite:${meeting._id}:${userId}`,
  });
};

export const getMeetings = async (req, res) => {
  try {
    const { organizationId } = req.query;
    const query = {};

    if (organizationId && organizationId !== 'personal') {
      // Same IDOR class as tasks: the org id is a client-supplied query param,
      // so membership has to be proven before we scope the query to it.
      if (!(await getOrgMembership(req.user._id.toString(), organizationId))) {
        return res.status(403).json({ message: 'Not a member of this organization' });
      }
      query.organizationId = organizationId;
    } else {
      query.$or = [{ host: req.user._id }, { participants: req.user._id }];
      query.$and = [{ $or: [{ organizationId: null }, { organizationId: { $exists: false } }] }];
    }

    const meetings = await Meeting.find(query)
      .populate('host', 'name email')
      .populate('allowedParticipants', 'name email avatar')
      .populate('allowedTeams', 'name owner')
      .sort({ scheduledAt: -1, createdAt: -1 });

    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMeetingById = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('host', 'name email')
      .populate('participants', 'name email')
      .populate('allowedParticipants', 'name email avatar')
      .populate('allowedTeams', 'name owner');
    if (meeting) {
      if (!(await canUserAccessMeeting(meeting, req.user._id))) {
        return res.status(403).json({ message: 'Not authorized to view this meeting' });
      }
      res.json(meeting);
    } else {
      res.status(404).json({ message: 'Meeting not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// No cache — this endpoint is critical for host detection and must always return fresh data
export const getMeetingByRoomId = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ roomId: req.params.roomId })
      .populate('host', '_id name email')
      .populate('participants', '_id name email')
      .populate('allowedParticipants', '_id name email avatar')
      .populate('allowedTeams', '_id name owner');
      
    if (meeting) {
      // This route used to be unauthenticated, so `req.user` was always
      // undefined and the permission check below never ran — the full meeting
      // document, including every participant's email, was public to anyone
      // who knew (or guessed) a room id.
      const canAccess = await canUserAccessMeeting(meeting, req.user._id);
      if (!canAccess) {
        return res.status(403).json({ message: 'You do not have permission to join this meeting.' });
      }
      res.json(meeting);
    } else {
      res.status(404).json({ message: 'Meeting not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createMeeting = async (req, res) => {
  try {
    const { title, description, scheduledAt, roomId, organizationId, meetingType, accessMode, allowedParticipants, allowedTeams, status } = req.body;
    
    // Auto-generate roomId if not provided
    const generatedRoomId = roomId || crypto.randomUUID();
    const normalizedAccessMode = accessMode || (organizationId ? ((allowedParticipants?.length || 0) > 0 && (allowedTeams?.length || 0) > 0 ? 'mixed' : (allowedTeams?.length || 0) > 0 ? 'teams' : (allowedParticipants?.length || 0) > 0 ? 'people' : 'organization') : 'personal');

    const canCreateMeeting = await canUserCreateMeeting({
      userId: req.user._id,
      organizationId,
      accessMode: normalizedAccessMode,
      allowedParticipants: allowedParticipants || [],
      allowedTeams: allowedTeams || [],
    });

    if (!canCreateMeeting) {
      return res.status(403).json({
        message: 'You are not allowed to create this meeting scope.',
      });
    }

    const meeting = new Meeting({
      title,
      description,
      scheduledAt,
      meetingType: meetingType || 'other',
      accessMode: normalizedAccessMode,
      status: status || (scheduledAt ? 'scheduled' : 'ongoing'),
      roomId: generatedRoomId,
      host: req.user._id,
      participants: [req.user._id],
      organizationId: organizationId || null,
      allowedParticipants: allowedParticipants || [],
      allowedTeams: allowedTeams || [],
    });

    const createdMeeting = await meeting.save();
    
    // Populate host before returning so the frontend gets { host: { _id, name } }
    await createdMeeting.populate('host', '_id name email');

    // Notify explicitly-invited people and team members. Org-wide meetings are
    // deliberately excluded — they already appear on everyone's dashboard, and
    // notifying a whole organization per meeting is noise.
    if (normalizedAccessMode !== 'organization') {
      notifyInvitees({ req, meeting: createdMeeting }).catch((err) =>
        console.error('[Meeting] invite notify failed:', err.message)
      );
    }

    res.status(201).json(createdMeeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (meeting) {
      // Authorization Check
      if (meeting.host.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to update this meeting' });
      }

      if (req.body.title !== undefined) meeting.title = req.body.title;
      if (req.body.description !== undefined) meeting.description = req.body.description;
      if (req.body.status !== undefined) meeting.status = req.body.status;
      if (req.body.accessMode !== undefined) meeting.accessMode = req.body.accessMode;

      const updatedMeeting = await meeting.save();
      
      res.json(updatedMeeting);
    } else {
      res.status(404).json({ message: 'Meeting not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
