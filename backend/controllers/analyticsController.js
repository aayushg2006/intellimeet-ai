import Meeting from '../models/Meeting.js';
import Task from '../models/Task.js';

export const getAnalytics = async (req, res) => {
  try {
    const { organizationId, timeRange } = req.query;

    const query = { host: req.user._id };
    if (organizationId && organizationId !== 'personal') {
      query.organizationId = organizationId;
      // Also maybe we can see all meetings in the org if we are a member, but for now we look at meetings we hosted or participated in?
      // Actually, if it's an organization, it might be better to see all meetings in the organization if the user has access.
      delete query.host;
    } else {
      query.organizationId = null;
    }

    // Time range filter (Optional enhancement)
    let startDate = new Date();
    if (timeRange === 'This week') {
      startDate.setDate(startDate.getDate() - 7);
      query.createdAt = { $gte: startDate };
    } else if (timeRange === 'This month') {
      startDate.setMonth(startDate.getMonth() - 1);
      query.createdAt = { $gte: startDate };
    }

    const meetings = await Meeting.find(query).populate('participants');
    
    // Calculate total hours and participants from meetings
    let totalParticipants = 0;
    let totalMinutes = 0;
    
    const dayCounts = { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 };
    const typeCounts = {};

    meetings.forEach(m => {
      totalParticipants += m.participants.length || 1;
      
      // Calculate duration
      if (m.createdAt && m.endedAt) {
        const diff = (new Date(m.endedAt) - new Date(m.createdAt)) / 1000 / 60;
        totalMinutes += diff;
      }

      // Day of week
      if (m.createdAt) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const day = days[new Date(m.createdAt).getDay()];
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      }

      // Type counts
      const type = m.meetingType || 'Internal';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const recentActivity = meetings.slice(-5).reverse().map(m => {
      let dur = 0;
      if (m.createdAt && m.endedAt) {
        dur = Math.round((new Date(m.endedAt) - new Date(m.createdAt)) / 1000 / 60);
      }
      return {
        title: m.title,
        date: m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'N/A',
        duration: `${dur}m`
      };
    });

    const meetingsThisWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
      day, count: dayCounts[day]
    }));

    const colors = ['#7C3AED', '#D97706', '#059669', '#2563EB', '#DC2626'];
    const meetingsByType = Object.keys(typeCounts).map((type, i) => ({
      name: type,
      value: typeCounts[type],
      fill: colors[i % colors.length]
    }));

    const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
    const avgDuration = meetings.length ? Math.round(totalMinutes / meetings.length) : 0;

    const analytics = {
      totalMeetings: meetings.length,
      totalHours,
      totalParticipants,
      avgDuration,
      meetingsThisWeek,
      meetingsByType,
      topParticipants: [], // Could aggregate if needed
      recentActivity
    };

    res.json(analytics);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: error.message });
  }
};
