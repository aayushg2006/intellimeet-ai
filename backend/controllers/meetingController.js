import Meeting from '../models/Meeting.js';
import crypto from 'crypto';
import { canUserAccessMeeting, canUserCreateMeeting } from '../utils/meetingAccess.js';

export const getMeetings = async (req, res) => {
  try {
    const { organizationId } = req.query;
    const query = {};

    if (organizationId && organizationId !== 'personal') {
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
      if (req.user) {
        const canAccess = await canUserAccessMeeting(meeting, req.user._id);
        if (!canAccess) {
          return res.status(403).json({ message: 'You do not have permission to join this meeting.' });
        }
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
