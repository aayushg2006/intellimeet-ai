import Task from '../models/Task.js';

export const getTasks = async (req, res) => {
  try {
    const { organizationId } = req.query;
    const query = { 
      assignee: req.user._id,
      organizationId: organizationId || null
    };
    const tasks = await Task.find(query).populate('assignee', 'name');
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createTask = async (req, res) => {
  try {
    const { title, description, status, meetingId, dueDate, organizationId } = req.body;
    
    const task = new Task({
      title,
      description,
      status: status || 'Todo',
      assignee: req.user._id,
      meetingId,
      dueDate,
      organizationId: organizationId || null
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
      // Authorization Check: Only assignee can update the task
      if (task.assignee.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to update this task' });
      }

      task.title = req.body.title || task.title;
      task.description = req.body.description || task.description;
      task.status = req.body.status || task.status;
      task.assignee = req.body.assignee || task.assignee;
      
      const updatedTask = await task.save();
      res.json(updatedTask);
    } else {
      res.status(404).json({ message: 'Task not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
