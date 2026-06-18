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
    
    await redis.setex(cacheKey, 60, JSON.stringify(meetings));
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

export const getMeetingByRoomId = async (req, res) => {
  try {
    const cacheKey = `meeting:room:${req.params.roomId}`;
    const cachedMeeting = await redis.get(cacheKey);
    if (cachedMeeting) {
      return res.json(JSON.parse(cachedMeeting));
    }

    const meeting = await Meeting.findOne({ roomId: req.params.roomId })
      .populate('host', 'name email')
      .populate('participants', 'name email');
      
    if (meeting) {
      await redis.setex(cacheKey, 60, JSON.stringify(meeting));
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
