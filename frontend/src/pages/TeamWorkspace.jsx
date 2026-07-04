import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft
} from 'lucide-react'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import KanbanBoard from '../components/KanbanBoard'
import TaskModal from '../components/TaskModal'

export const TeamWorkspace = () => {
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const { activeWorkspace } = useWorkspaceStore()
  const queryClient = useQueryClient();
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [initialStatus, setInitialStatus] = useState('Todo')
  const [socket, setSocket] = useState(null)

  useEffect(() => { document.title = 'Team Workspace — IntellMeet' }, [])

  useEffect(() => {
    const socketUrl = '/';
    const newSocket = io(socketUrl, {
      auth: { token }
    })
    setSocket(newSocket)

    newSocket.emit('join-workspace', activeWorkspace)

    newSocket.on('refresh-tasks', () => {
      queryClient.invalidateQueries(['tasks', activeWorkspace])
    })

    return () => {
      newSocket.emit('leave-workspace', activeWorkspace)
      newSocket.disconnect()
    }
  }, [activeWorkspace, queryClient])

  const tagColors = {
    Frontend: 'bg-blue-50 text-blue-600',
    Backend: 'bg-orange-50 text-orange-600',
    Testing: 'bg-green-50 text-green-600',
    DevOps: 'bg-purple-50 text-purple-600',
  }

  const priorityColors = {
    high: 'bg-red-500',
    medium: 'bg-yellow-400',
    low: 'bg-gray-300',
  }

  const { data: tasks = [], isLoading: loading } = useQuery({
    queryKey: ['tasks', activeWorkspace],
    queryFn: async () => {
      const res = await axios.get('/api/tasks', {
        headers: { Authorization: `Bearer ${token}` },
        params: { organizationId: activeWorkspace === 'personal' ? null : activeWorkspace }
      })
      return res.data
    },
    enabled: !!token
  })

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }) => {
      const res = await axios.put(`/api/tasks/${taskId}`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries(['tasks', activeWorkspace]);
      const previousTasks = queryClient.getQueryData(['tasks', activeWorkspace]);
      
      queryClient.setQueryData(['tasks', activeWorkspace], old => {
        return old.map(task => 
          task._id === taskId ? { ...task, status } : task
        );
      });
      
      return { previousTasks };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(['tasks', activeWorkspace], context.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['tasks', activeWorkspace]);
      if (socket) {
        socket.emit('task-updated', activeWorkspace);
      }
    }
  });

  const handleTaskMove = (taskId, newStatus) => {
    updateTaskMutation.mutate({ taskId, status: newStatus });
  };

  const handleTaskAction = () => {
    queryClient.invalidateQueries(['tasks', activeWorkspace]);
    if (socket) {
      socket.emit('task-updated', activeWorkspace);
    }
  };

  const handleTaskClick = (task, columnId = 'Todo') => {
    setSelectedTask(task);
    setInitialStatus(columnId);
    setIsModalOpen(true);
  };

  const totalTasks = tasks.length;

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      <div className="border-b border-[#E8E4DD] bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#1A1A1A] font-semibold">
          <img src="/logo.png" alt="IntellMeet" className="h-8 w-auto" />
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-sm text-[#6B6560] hover:text-[#1A1A1A] transition"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-6 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A1A]">
              {activeWorkspace === 'personal' ? 'My Tasks' : 'Team Workspace'}
            </h1>
            <p className="text-sm text-[#6B6560] mt-1">
              {activeWorkspace === 'personal' ? 'Personal To-Do Board' : 'IntellMeet — Sprint 1'}
            </p>
          </div>
          <span className="bg-white border border-[#E8E4DD] text-[#6B6560] text-xs px-3 py-1.5 rounded-full">
            {totalTasks} tasks
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-10">
        <KanbanBoard tasks={tasks} onTaskMove={handleTaskMove} onTaskClick={handleTaskClick} />
      </div>

      <TaskModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        task={selectedTask}
        initialStatus={initialStatus}
        workspace={activeWorkspace}
        onSave={handleTaskAction}
        onDelete={handleTaskAction}
      />
    </div>
  )
}
