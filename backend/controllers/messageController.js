import Message from '../models/Message.js';
import Meeting from '../models/Meeting.js';
import { canUserAccessMeeting } from '../utils/meetingAccess.js';

export const getMessagesByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Room ids are short, human-readable strings (e.g. "WEEKLY1"), so without
    // this gate any authenticated user could read any meeting's chat history by
    // guessing one.
    const meeting = await Meeting.findOne({ roomId }).select(
      'host participants organizationId accessMode allowedParticipants allowedTeams'
    );
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    if (!(await canUserAccessMeeting(meeting, req.user._id.toString()))) {
      return res.status(403).json({ message: 'Not authorized to view this conversation' });
    }

    const messages = await Message.find({ roomId })
      .populate('sender', 'name avatar')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
