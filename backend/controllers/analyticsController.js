import Meeting from '../models/Meeting.js';
import Task from '../models/Task.js';

export const getAnalytics = async (req, res) => {
  try {
    const meetings = await Meeting.find({ host: req.user._id }).populate('participants');
    
    // Calculate total hours and participants from meetings
    let totalParticipants = 0;
    
    meetings.forEach(m => {
      totalParticipants += m.participants.length || 1;
    });

    const recentActivity = meetings.slice(-5).reverse().map(m => ({
      title: m.title,
      date: m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'N/A',
      duration: '0m'
    }));

    const analytics = {
      totalMeetings: meetings.length,
      totalHours: 0,
      totalParticipants: totalParticipants,
      avgDuration: 0,
      meetingsThisWeek: [
        { day: 'Mon', count: 0 },
        { day: 'Tue', count: 0 },
        { day: 'Wed', count: 0 },
        { day: 'Thu', count: 0 },
        { day: 'Fri', count: 0 }
      ],
      meetingsByType: [
        { type: 'Internal', count: meetings.length, color: '#7C3AED' }
      ],
      topParticipants: [],
      recentActivity: recentActivity
    };

    res.json(analytics);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: error.message });
  }
};
