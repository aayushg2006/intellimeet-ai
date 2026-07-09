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
      summary: summary?.summary || '',
      transcriptSummary: summary?.transcriptSummary || '',
      chatSummary: summary?.chatSummary || '',
      notesSummary: summary?.notesSummary || '',
      conclusions: summary?.conclusions || '',
      generationStatus: summary?.generationStatus || (summary?.summary ? 'completed' : 'pending'),
      generationError: summary?.generationError || '',
      generationStartedAt: summary?.generationStartedAt || null,
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

    const messages = await Message.find({ roomId: meeting.roomId }).populate('sender', 'name');
    const chatText = messages
      .map((message) => `${message.sender?.name || 'User'}: ${message.text}`)
      .join('\n');
    const notesText = meeting.notes || '';
    let summaryDoc = await Summary.findOne({ meetingId: meeting._id });
    if (!summaryDoc) {
      summaryDoc = new Summary({
        meetingId: meeting._id,
        organizationId: meeting.organizationId,
        title: meeting.title,
        date: meeting.createdAt.toISOString().split('T')[0],
        transcript: [],
        generationStatus: 'generating',
        generationError: ''
      });
      await summaryDoc.save();
    }
    const existingTranscript = summaryDoc?.transcript || [];
    const fullTranscriptText = existingTranscript.join('\n');
    const hasContent = Boolean(fullTranscriptText.trim() || chatText.trim() || notesText.trim());

    if (!hasContent) {
      if (!summaryDoc) {
        summaryDoc = new Summary({
          meetingId: meeting._id,
          organizationId: meeting.organizationId,
          title: meeting.title,
          date: meeting.createdAt.toISOString().split('T')[0],
          transcript: [],
          generationStatus: 'failed',
          generationError: 'No transcript, chat, or notes were captured for this meeting.'
        });
        await summaryDoc.save();
      } else {
        await Summary.updateOne(
          { _id: summaryDoc._id },
          {
            $set: {
              generationStatus: 'failed',
              generationError: 'No transcript, chat, or notes were captured for this meeting.',
              summary: '',
              conclusions: '',
              transcriptSummary: '',
              chatSummary: '',
              notesSummary: '',
              actionItems: []
            }
          }
        );
      }

      return res.status(400).json({ message: 'No transcript, chat, or notes available to generate summary.' });
    }

    await Summary.updateOne(
      { _id: summaryDoc._id },
      {
        $set: {
          generationStatus: 'generating',
          generationError: '',
          generationStartedAt: new Date()
        }
      }
    );

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
          generationStatus: 'completed',
          generationError: '',
          generationStartedAt: summaryDoc.generationStartedAt || new Date(),
          generatedAt: new Date(),
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
    try {
      const meetingIdQuery = req.params.meetingId;
      const meeting = await Meeting.findOne({
        $or: [
          { roomId: meetingIdQuery },
          ...( /^[0-9a-fA-F]{24}$/.test(meetingIdQuery) ? [{ _id: meetingIdQuery }] : [] )
        ]
      }).select('_id');
      if (meeting) {
        const summaryDoc = await Summary.findOne({ meetingId: meeting._id });
        if (summaryDoc) {
          await Summary.updateOne(
            { _id: summaryDoc._id },
            {
              $set: {
                generationStatus: 'failed',
                generationError: error.message || 'Failed to generate summary.'
              }
            }
          );
        }
      }
    } catch (statusErr) {
      console.error('Failed to update summary generation status:', statusErr);
    }
    res.status(500).json({ message: error.message });
  }
};
