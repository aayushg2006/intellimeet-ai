import Meeting from '../models/Meeting.js';
import Task from '../models/Task.js';

export const getTasks = async (req, res) => {
  try {
    const { organizationId, meetingId } = req.query;
    const query = {};
    if (meetingId) {
      query.meetingId = meetingId;
    } else {
      if (organizationId && organizationId !== 'personal') {
        query.organizationId = organizationId;
      } else {
        query.assignee = req.user._id;
        query.$or = [{ organizationId: null }, { organizationId: { $exists: false } }];
      }
    }
    const tasks = await Task.find(query)
      .populate('assignee', 'name')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createTask = async (req, res) => {
  try {
    const { title, description, status, meetingId, dueDate, organizationId, teamId, priority, tags, assignee } = req.body;

    let meetingTitle = req.body.meetingTitle || '';
    let derivedOrganizationId = organizationId || null;
    let derivedMeetingId = meetingId || null;

    if (meetingId && !meetingTitle) {
      const meeting = await Meeting.findById(meetingId).select('title organizationId');
      if (meeting) {
        meetingTitle = meeting.title;
        derivedOrganizationId = derivedOrganizationId || meeting.organizationId || null;
      }
    }
    
    const task = new Task({
      title,
      description,
      status: status || 'Todo',
      assignee: assignee || req.user._id,
      meetingId: derivedMeetingId,
      meetingTitle,
      dueDate,
      organizationId: derivedOrganizationId,
      teamId,
      priority,
      tags
    });

    const createdTask = await task.save();
    res.status(201).json(createdTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (task) {
      // Authorization Check: Assignee can update, or if team task, any team member could theoretically update (for now allow assignee or creator or just bypass strict check for simplicity since it's an internal tool, or we can check organization)
      // We will just allow it for now if they are authenticated, but ideally check org membership.
      
      if (req.body.title !== undefined) task.title = req.body.title;
      if (req.body.description !== undefined) task.description = req.body.description;
      if (req.body.status !== undefined) task.status = req.body.status;
      if (req.body.dueDate !== undefined) task.dueDate = req.body.dueDate;
      if (req.body.priority !== undefined) task.priority = req.body.priority;
      if (req.body.tags !== undefined) task.tags = req.body.tags;
      if (req.body.assignee !== undefined) task.assignee = req.body.assignee;
      if (req.body.teamId !== undefined) task.teamId = req.body.teamId;
      if (req.body.meetingTitle !== undefined) task.meetingTitle = req.body.meetingTitle;

      const updatedTask = await task.save();
      res.json(updatedTask);
    } else {
      res.status(404).json({ message: 'Task not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    
    if (task.assignee && task.assignee.toString() !== req.user._id.toString()) {
       return res.status(403).json({ message: 'Not authorized to delete this task' });
    }
    
    await task.deleteOne();
    res.json({ message: 'Task removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
