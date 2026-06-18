import Meeting from '../models/Meeting.js';
import redis from '../config/redis.js';

export const getMeetings = async (req, res) => {
  try {
    const cacheKey = `meetings:user:${req.user._id}`;
    const cachedMeetings = await redis.get(cacheKey);
    if (cachedMeetings) {
      return res.json(JSON.parse(cachedMeetings));
    }

    const meetings = await Meeting.find({
      $or: [{ host: req.user._id }, { participants: req.user._id }]
    }).populate('host', 'name email');
    
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
    const { title, description, scheduledAt, roomId } = req.body;
    
    // Auto-generate roomId if not provided
    const generatedRoomId = roomId || Math.random().toString(36).substring(2, 10);

    const meeting = new Meeting({
      title,
      description,
      scheduledAt,
      roomId: generatedRoomId,
      host: req.user._id,
      participants: [req.user._id]
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
      meeting.title = req.body.title || meeting.title;
      meeting.description = req.body.description || meeting.description;
      meeting.status = req.body.status || meeting.status;

      const updatedMeeting = await meeting.save();
      res.json(updatedMeeting);
    } else {
      res.status(404).json({ message: 'Meeting not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
