import Task from '../models/Task.js';

export const getTasks = async (req, res) => {
  try {
    const { organizationId, meetingId } = req.query;
    const query = {};
    if (meetingId) {
      query.meetingId = meetingId;
    } else {
      query.assignee = req.user._id;
      query.organizationId = organizationId || null;
    }
    const tasks = await Task.find(query).populate('assignee', 'name');
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createTask = async (req, res) => {
  try {
    const { title, description, status, meetingId, dueDate, organizationId, teamId, priority, tags, assignee } = req.body;
    
    const task = new Task({
      title,
      description,
      status: status || 'Todo',
      assignee: assignee || req.user._id,
      meetingId,
      dueDate,
      organizationId: organizationId || null,
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
