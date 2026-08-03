import Meeting from '../models/Meeting.js';
import Task from '../models/Task.js';
import Team from '../models/Team.js';
import { getOrgMembership } from '../utils/orgUtils.js';
import { canUserAccessMeeting } from '../utils/meetingAccess.js';
import { notify } from '../services/notificationService.js';

/**
 * Whether a user may modify (or delete) a task.
 * A task is modifiable by its assignee, by any member of the organization it
 * belongs to, or by any member of the team it is scoped to. Personal tasks with
 * no assignee and no org are only modifiable by their creator's own view, which
 * in practice means the assignee check above.
 */
const canUserModifyTask = async (task, userId) => {
  const uid = userId.toString();

  if (task.assignee && task.assignee.toString() === uid) return true;

  if (task.organizationId && (await getOrgMembership(uid, task.organizationId))) return true;

  if (task.teamId) {
    const team = await Team.findOne({ _id: task.teamId, members: uid }).select('_id').lean();
    if (team) return true;
  }

  // An unassigned personal task (no org, no team) is not reachable by anyone
  // else's queries, so allow the caller to adopt it.
  if (!task.assignee && !task.organizationId && !task.teamId) return true;

  return false;
};

/**
 * Tell someone a task landed on their plate.
 * Skipped when the assignee is unchanged, absent, or is the person acting.
 */
const notifyAssignment = async ({ req, task, previousAssignee }) => {
  const assignee = task.assignee?.toString();
  if (!assignee || assignee === previousAssignee) return;

  await notify({
    io: req.app.get('io'),
    userIds: [assignee],
    type: 'task_assigned',
    title: 'New task assigned to you',
    body: task.title,
    link: '/workspace',
    actor: req.user,
    organizationId: task.organizationId || null,
    entityKind: 'task',
    entityId: task._id.toString(),
  });
};

export const getTasks = async (req, res) => {
  try {
    const { organizationId, meetingId } = req.query;
    const query = {};
    if (meetingId) {
      // Scope meeting tasks to meetings the caller can actually see — otherwise
      // any authenticated user could read another org's tasks by meeting id.
      const meeting = await Meeting.findById(meetingId);
      if (!meeting) return res.json([]);
      if (!(await canUserAccessMeeting(meeting, req.user._id.toString()))) {
        return res.status(403).json({ message: 'Not authorized to view tasks for this meeting' });
      }
      query.meetingId = meetingId;
    } else {
      if (organizationId && organizationId !== 'personal') {
        // The organizationId arrives as a query param from the workspace
        // switcher. Without this check, passing any org id returned that org's
        // entire board.
        if (!(await getOrgMembership(req.user._id.toString(), organizationId))) {
          return res.status(403).json({ message: 'Not a member of this organization' });
        }
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

    // Don't let a caller file a task into an organization they don't belong to.
    if (derivedOrganizationId && !(await getOrgMembership(req.user._id.toString(), derivedOrganizationId))) {
      return res.status(403).json({ message: 'Not a member of this organization' });
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

    notifyAssignment({ req, task: createdTask, previousAssignee: null }).catch((err) =>
      console.error('[Task] assignment notify failed:', err.message)
    );

    res.status(201).json(createdTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (task) {
      if (!(await canUserModifyTask(task, req.user._id))) {
        return res.status(403).json({ message: 'Not authorized to update this task' });
      }

      // Captured before the write so we can tell a reassignment from a no-op.
      const previousAssignee = task.assignee?.toString() || null;

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

      notifyAssignment({ req, task: updatedTask, previousAssignee }).catch((err) =>
        console.error('[Task] assignment notify failed:', err.message)
      );

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
    
    if (!(await canUserModifyTask(task, req.user._id))) {
      return res.status(403).json({ message: 'Not authorized to delete this task' });
    }


    await task.deleteOne();
    res.json({ message: 'Task removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
