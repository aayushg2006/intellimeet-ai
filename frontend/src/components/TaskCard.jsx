import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock } from 'lucide-react';

const TaskCard = ({ task, onClick, isOverlay }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const tagColors = {
    Frontend: 'bg-blue-50 text-blue-600',
    Backend: 'bg-orange-50 text-orange-600',
    Testing: 'bg-green-50 text-green-600',
    DevOps: 'bg-purple-50 text-purple-600',
  };

  const priorityColors = {
    high: 'bg-red-500',
    medium: 'bg-yellow-400',
    low: 'bg-gray-300',
  };

  const firstTag = task.tags?.[0] || 'General';
  const tagColor = tagColors[firstTag] || 'bg-gray-100 text-gray-600';
  const pColor = priorityColors[task.priority || 'medium'];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        // Only trigger click if we aren't dragging
        if (!isDragging) {
          onClick(task);
        }
      }}
      className={`bg-[#FAF9F7] border border-[#E8E4DD] rounded-xl p-3 hover:border-[#7C3AED]/30 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing group ${
        isOverlay ? 'shadow-lg rotate-2 scale-105 z-50' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColor}`}>
          {firstTag}
        </span>
        <span className={`w-2 h-2 rounded-full ${pColor} ml-auto`} title={`Priority: ${task.priority || 'medium'}`} />
      </div>
      <p className="text-sm font-medium text-[#1A1A1A] mt-2 leading-snug">
        {task.title}
      </p>
      {task.meetingTitle && (
        <p className="mt-1 text-[11px] text-[#7C3AED] font-medium truncate" title={task.meetingTitle}>
          From: {task.meetingTitle}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-[#6B6560]">
        <span className="flex items-center gap-1">
          <Clock size={11} />
          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
        </span>
        <span className="w-6 h-6 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-[10px] font-semibold flex items-center justify-center" title={task.assignee?.name || 'Unassigned'}>
          {task.assignee?.name?.substring(0, 2).toUpperCase() || 'U'}
        </span>
      </div>
    </div>
  );
};

export default TaskCard;
