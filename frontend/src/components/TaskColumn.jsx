import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Circle } from 'lucide-react';
import TaskCard from './TaskCard';

const TaskColumn = ({ column, onTaskClick }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div className="bg-white border border-[#E8E4DD] rounded-2xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-[#E8E4DD] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: column.color }}
          />
          <span className="text-sm font-semibold text-[#1A1A1A]">
            {column.title}
          </span>
          <span className="bg-[#F5F2EE] text-[#6B6560] text-xs w-5 h-5 rounded-full flex items-center justify-center ml-2">
            {column.tasks.length}
          </span>
        </div>
        <button 
          onClick={() => onTaskClick(null, column.id)}
          className="w-6 h-6 rounded-lg hover:bg-[#F5F2EE] flex items-center justify-center text-[#6B6560] hover:text-[#1A1A1A] transition"
        >
          <Plus size={14} />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 p-3 space-y-2 min-h-[200px] transition-colors ${
          isOver ? 'bg-[#F5F2EE]' : ''
        }`}
      >
        <SortableContext items={column.tasks.map((t) => t._id)} strategy={verticalListSortingStrategy}>
          {column.tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center pointer-events-none">
              <Circle size={20} className="text-[#E8E4DD] mb-2" />
              <p className="text-xs text-[#C4BDB5]">Drop tasks here</p>
            </div>
          ) : (
            column.tasks.map((task) => (
              <TaskCard key={task._id} task={task} onClick={() => onTaskClick(task)} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
};

export default TaskColumn;
