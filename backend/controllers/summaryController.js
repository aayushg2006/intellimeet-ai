import Meeting from '../models/Meeting.js';
import Summary from '../models/Summary.js';
import Task from '../models/Task.js';
import { canUserAccessMeeting } from '../utils/meetingAccess.js';
import { runSummaryPipeline } from '../services/summaryPipeline.js';

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

    if (!(await canUserAccessMeeting(meeting, req.user._id.toString()))) {
      return res.status(403).json({ message: 'Not authorized to view this summary' });
    }

    const summary = await Summary.findOne({ meetingId: meeting._id });

    let calculatedDuration = summary?.duration || '0 minutes';
    if (meeting.endedAt && meeting.createdAt) {
      const diffMs = new Date(meeting.endedAt) - new Date(meeting.createdAt);
      const diffMins = Math.round(diffMs / 60000);
      calculatedDuration = `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    }

    const manualTasks = await Task.find({ meetingId: meeting._id }).populate('assignee', 'name');
    const formattedTasks = manualTasks.map(t => ({
      taskId: t._id.toString(),
      id: t._id.toString(),
      task: t.title,
      assignee: t.assignee?.name || 'Unassigned',
      status: t.status,
      done: t.status === 'Done',
      meetingTitle: t.meetingTitle || meeting.title
    }));

    let allActionItems = summary?.actionItems || [];
    if (allActionItems.length === 1 && allActionItems[0].task === '[No Action Items listed]') {
      allActionItems = [];
    }
    
    const taskById = new Map(formattedTasks.map((task) => [task.taskId, task]));
    const enrichedActionItems = allActionItems.map((item) => {
      if (item.taskId && taskById.has(item.taskId)) {
        const task = taskById.get(item.taskId);
        return {
          ...item,
          assignee: task.assignee,
          status: task.status,
          done: task.done,
          meetingTitle: task.meetingTitle || meeting.title
        };
      }
      return {
        ...item,
        meetingTitle: meeting.title
      };
    });
    const seenTaskIds = new Set(
      enrichedActionItems
        .map((item) => item.taskId)
        .filter(Boolean)
    );
    const combinedActionItems = [
      ...enrichedActionItems,
      ...formattedTasks.filter((task) => !seenTaskIds.has(task.taskId)),
    ];
    if (combinedActionItems.length === 0) {
      combinedActionItems.push({
        id: 'none',
        task: '[No Action Items listed]',
        assignee: 'Unassigned',
        status: 'pending',
        done: false,
        meetingTitle: meeting.title
      });
    }

    const responseData = {
      title: meeting.title,
      date: new Date(meeting.scheduledAt || meeting.createdAt).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }),
      duration: calculatedDuration,
      participants: meeting.participants.map(p => p.name) || [],
      summary: summary?.summary || '',
      transcriptSummary: summary?.transcriptSummary || '',
      chatSummary: summary?.chatSummary || '',
      notesSummary: summary?.notesSummary || '',
      conclusions: summary?.conclusions || '',
      generationStatus: summary?.generationStatus || (summary?.summary ? 'completed' : 'pending'),
      generationError: summary?.generationError || '',
      generationStartedAt: summary?.generationStartedAt || null,
      generationAttempts: summary?.generationAttempts || 0,
      actionItems: combinedActionItems,
      transcript: summary?.transcript || [],
      attachments: meeting.attachments || [],
      recordingKey: meeting.recordingKey || '',
      notes: meeting.notes || ''
    };

    res.json(responseData);
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const createSummary = async (req, res) => {
  try {
    // `new Summary(req.body)` was a mass-assignment: any authenticated user
    // could write a summary onto any meeting. Gate on meeting access and only
    // accept the fields a client is allowed to set.
    const { meetingId } = req.body;
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    if (!(await canUserAccessMeeting(meeting, req.user._id.toString()))) {
      return res.status(403).json({ message: 'Not authorized to create a summary for this meeting' });
    }

    const summary = new Summary({
      meetingId: meeting._id,
      organizationId: meeting.organizationId,
      title: req.body.title || meeting.title,
      date: req.body.date,
      duration: req.body.duration,
      summary: req.body.summary,
      actionItems: req.body.actionItems,
      transcript: req.body.transcript,
    });
    const createdSummary = await summary.save();
    res.status(201).json(createdSummary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const generatePendingSummary = async (req, res, next) => {
  try {
    let meeting = await Meeting.findOne({ roomId: req.params.meetingId });
    if (!meeting && req.params.meetingId.match(/^[0-9a-fA-F]{24}$/)) {
      meeting = await Meeting.findById(req.params.meetingId);
    }
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    if (!(await canUserAccessMeeting(meeting, req.user._id.toString()))) {
      return res.status(403).json({ message: 'Not authorized to generate a summary for this meeting' });
    }

    // Delegates to the same pipeline the socket `end-meeting` handler uses, so
    // a manual regeneration and an automatic one cannot drift apart. `force`
    // lets the user retry a summary that already completed or failed.
    const result = await runSummaryPipeline({
      io: req.app.get('io'),
      meetingId: meeting._id,
      roomId: meeting.roomId,
      force: true,
    });

    if (result.status === 'no-content') {
      return res
        .status(400)
        .json({ message: 'No transcript, chat, or notes available to generate summary.' });
    }

    if (result.status === 'failed') {
      return res.status(502).json({ message: result.error || 'Failed to generate summary.' });
    }

    if (result.status === 'already-running-or-complete') {
      return res.status(409).json({ message: 'A summary is already being generated for this meeting.' });
    }

    res.json({ message: 'Summary generated successfully' });
  } catch (error) {
    next(error);
  }
};
