import { useState, useEffect } from 'react';
import { X, Calendar, User, Tag, Clock } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const TaskModal = ({ isOpen, onClose, task, initialStatus, workspace, onSave, onDelete }) => {
  const { token } = useAuthStore();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: initialStatus || 'Todo',
    priority: 'medium',
    dueDate: '',
    tags: '',
    assignee: ''
  });
  
  // A real app would fetch org/team members here. For now we just use a generic input or self.

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'Todo',
        priority: task.priority || 'medium',
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
        tags: task.tags ? task.tags.join(', ') : '',
        assignee: task.assignee?._id || ''
      });
    } else {
      setFormData({
        title: '',
        description: '',
        status: initialStatus || 'Todo',
        priority: 'medium',
        dueDate: '',
        tags: '',
        assignee: ''
      });
    }
  }, [task, initialStatus]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      organizationId: workspace === 'personal' ? null : workspace
    };

    try {
      if (task) {
        await axios.put(`/api/tasks/${task._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('/api/tasks', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      try {
        await axios.delete(`/api/tasks/${task._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if(onDelete) onDelete();
        onClose();
      } catch (err) {
        console.error('Failed to delete', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E8E4DD] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">
            {task ? 'Edit Task' : 'Create Task'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F2EE] rounded-full text-[#6B6560] transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-[#E8E4DD] rounded-xl outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] transition"
              placeholder="Task title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-[#E8E4DD] rounded-xl outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] transition h-24 resize-none"
              placeholder="Task description (optional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-[#E8E4DD] rounded-xl outline-none focus:border-[#7C3AED] transition bg-white"
              >
                <option value="Todo">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="In Review">In Review</option>
                <option value="Done">Done</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-[#E8E4DD] rounded-xl outline-none focus:border-[#7C3AED] transition bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Due Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-[#E8E4DD] rounded-xl outline-none focus:border-[#7C3AED] transition bg-white"
                />
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6560]" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Tags</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-[#E8E4DD] rounded-xl outline-none focus:border-[#7C3AED] transition bg-white"
                  placeholder="Frontend, Bug"
                />
                <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6560]" />
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-[#E8E4DD]">
            {task ? (
              <button
                type="button"
                onClick={handleDelete}
                className="text-red-500 hover:text-red-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-red-50 transition"
              >
                Delete Task
              </button>
            ) : <div></div>}
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-sm font-semibold text-[#1A1A1A] bg-white border border-[#E8E4DD] rounded-xl hover:bg-[#F5F2EE] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold text-white bg-[#7C3AED] rounded-xl hover:bg-[#6D28D9] transition"
              >
                {task ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
