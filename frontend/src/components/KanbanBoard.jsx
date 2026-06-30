import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCorners,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TaskColumn from './TaskColumn';
import TaskCard from './TaskCard';

const KanbanBoard = ({ tasks, onTaskMove, onTaskClick }) => {
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const getColumns = () => {
    const grouped = { 'Todo': [], 'In Progress': [], 'In Review': [], 'Done': [] };
    tasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      } else {
        grouped['Todo'].push(task);
      }
    });

    return [
      { id: 'Todo', title: 'To Do', color: '#6B6560', tasks: grouped['Todo'] },
      { id: 'In Progress', title: 'In Progress', color: '#D97706', tasks: grouped['In Progress'] },
      { id: 'In Review', title: 'In Review', color: '#7C3AED', tasks: grouped['In Review'] },
      { id: 'Done', title: 'Done', color: '#059669', tasks: grouped['Done'] },
    ];
  };

  const columns = getColumns();

  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find((t) => t._id === active.id);
    setActiveTask(task);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const taskId = active.id;
    const newStatus = over.id; // column id is the status string

    const task = tasks.find((t) => t._id === taskId);
    if (task && task.status !== newStatus) {
      onTaskMove(taskId, newStatus);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-4 gap-4">
        {columns.map((col) => (
          <TaskColumn key={col.id} column={col} onTaskClick={onTaskClick} />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
