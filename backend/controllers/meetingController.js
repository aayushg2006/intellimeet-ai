import Meeting from '../models/Meeting.js';
import redis from '../config/redis.js';

export const getMeetings = async (req, res) => {
  try {
    const { organizationId } = req.query;
    const cacheKey = `meetings:user:${req.user._id}:org:${organizationId || 'personal'}`;
    const cachedMeetings = await redis.get(cacheKey);
    if (cachedMeetings) {
      return res.json(JSON.parse(cachedMeetings));
    }

    const query = {
      $or: [{ host: req.user._id }, { participants: req.user._id }],
      organizationId: organizationId || null,
    };

    const meetings = await Meeting.find(query).populate('host', 'name email');
    
    await redis.set(cacheKey, JSON.stringify(meetings), 'EX', 60);
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMeetingById = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('host', 'name email')
      .populate('participants', 'name email');
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
      .populate('participants', '_id name email');
      
    if (meeting) {
      // Access Control
      if (meeting.allowedParticipants && meeting.allowedParticipants.length > 0) {
        const isAllowed = meeting.allowedParticipants.some(p => p._id.toString() === req.user._id.toString()) || meeting.host._id.toString() === req.user._id.toString();
        if (!isAllowed) {
          // We don't check teams yet since teams might be empty, but ideally we check if user is in allowedTeams
          // For now, simple check
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
    const { title, description, scheduledAt, roomId, organizationId, meetingType, allowedParticipants, allowedTeams } = req.body;
    
    // Auto-generate roomId if not provided
    const generatedRoomId = roomId || Math.random().toString(36).substring(2, 10);

    const meeting = new Meeting({
      title,
      description,
      scheduledAt,
      meetingType: meetingType || 'other',
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
    
    // Invalidate the meetings cache for this user/org
    const cacheKey = `meetings:user:${req.user._id}:org:${organizationId || 'personal'}`;
    await redis.del(cacheKey);

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

      meeting.title = req.body.title || meeting.title;
      meeting.description = req.body.description || meeting.description;
      meeting.status = req.body.status || meeting.status;

      const updatedMeeting = await meeting.save();
      
      // Invalidate cache
      const cacheKey = `meetings:user:${req.user._id}:org:${meeting.organizationId || 'personal'}`;
      await redis.del(cacheKey);

      res.json(updatedMeeting);
    } else {
      res.status(404).json({ message: 'Meeting not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
