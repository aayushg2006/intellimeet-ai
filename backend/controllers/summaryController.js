import Meeting from '../models/Meeting.js';
import Summary from '../models/Summary.js';
import Task from '../models/Task.js';
import Message from '../models/Message.js';
import aiService from '../services/aiService.js';

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
      summary: summary?.summary || 'No AI summary generated yet.',
      transcriptSummary: summary?.transcriptSummary || '',
      chatSummary: summary?.chatSummary || '',
      notesSummary: summary?.notesSummary || '',
      conclusions: summary?.conclusions || '',
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
    const summary = new Summary(req.body);
    const createdSummary = await summary.save();
    res.status(201).json(createdSummary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const generatePendingSummary = async (req, res) => {
  try {
    let meeting = await Meeting.findOne({ roomId: req.params.meetingId });
    if (!meeting && req.params.meetingId.match(/^[0-9a-fA-F]{24}$/)) {
      meeting = await Meeting.findById(req.params.meetingId);
    }
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const summaryDoc = await Summary.findOne({ meetingId: meeting._id });
    if (!summaryDoc || !summaryDoc.transcript || summaryDoc.transcript.length === 0) {
      return res.status(400).json({ message: 'No transcript available to generate summary.' });
    }

    // Call AI Service
    const fullTranscriptText = summaryDoc.transcript.join('\n');
    const messages = await Message.find({ roomId: meeting.roomId }).populate('sender', 'name');
    const chatText = messages
      .map((message) => `${message.sender?.name || 'User'}: ${message.text}`)
      .join('\n');
    const notesText = meeting.notes || '';
    const {
      summary,
      transcriptSummary,
      chatSummary,
      notesSummary,
      conclusions,
      actionItems
    } = await aiService.generateSummary(fullTranscriptText, chatText, notesText);

    await Summary.updateOne(
      { _id: summaryDoc._id },
      {
        $set: {
          summary: summary,
          transcriptSummary: transcriptSummary || '',
          chatSummary: chatSummary || '',
          notesSummary: notesSummary || '',
          conclusions: conclusions || '',
          actionItems: actionItems.map((item, index) => ({
            id: index + 1,
            task: item.task,
            assignee: item.assignee || 'Unassigned',
            status: item.status || 'pending',
            taskId: summaryDoc.actionItems?.[index]?.taskId || null
          }))
        }
      }
    );
    res.json({ message: 'Summary generated successfully' });
  } catch (error) {
    console.error('Generate summary error:', error);
    res.status(500).json({ message: error.message });
  }
};
