import Meeting from '../models/Meeting.js';
import Summary from '../models/Summary.js';

export const getSummaryByMeeting = async (req, res) => {
  try {
    // req.params.meetingId is usually the roomId string (e.g. "WEEKLY1")
    let meeting = await Meeting.findOne({ roomId: req.params.meetingId }).populate('participants');
    
    // Fallback if the param is actually the _id
    if (!meeting && req.params.meetingId.match(/^[0-9a-fA-F]{24}$/)) {
      meeting = await Meeting.findById(req.params.meetingId).populate('participants');
    }

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const summary = await Summary.findOne({ meetingId: meeting._id });

    let calculatedDuration = summary?.duration || '0 minutes';
    if (meeting.endedAt && meeting.createdAt) {
      const diffMs = new Date(meeting.endedAt) - new Date(meeting.createdAt);
      const diffMins = Math.round(diffMs / 60000);
      calculatedDuration = `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    }

    const responseData = {
      title: meeting.title,
      date: new Date(meeting.scheduledAt || meeting.createdAt).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }),
      duration: calculatedDuration,
      participants: meeting.participants.map(p => p.name) || [],
      summary: summary?.summary || 'No AI summary generated yet.',
      actionItems: summary?.actionItems || [],
      transcript: summary?.transcript || []
    };

    res.json(responseData);
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const createSummary = async (req, res) => {
  try {
    const summary = new Summary(req.body);
    const createdSummary = await summary.save();
    res.status(201).json(createdSummary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
