import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Video,
  Clock,
  Users,
  Loader
} from 'lucide-react'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import KanbanBoard from '../components/KanbanBoard'
import TaskModal from '../components/TaskModal'
import { formatMeetingDate, getMeetingAccessDetails, getMeetingAccessLabel, getMeetingTypeLabel } from '../utils/meetingDisplay'

export const TeamWorkspace = () => {
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const { activeWorkspace } = useWorkspaceStore()
  const queryClient = useQueryClient();
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [initialStatus, setInitialStatus] = useState('Todo')
  const socketRef = useRef(null)

  useEffect(() => { document.title = 'Team Workspace — IntellMeet' }, [])

  useEffect(() => {
    const socketUrl = '/';
    const newSocket = io(socketUrl, {
      auth: { token }
    })
    socketRef.current = newSocket

    newSocket.emit('join-workspace', activeWorkspace)

    newSocket.on('refresh-tasks', () => {
      queryClient.invalidateQueries(['tasks', activeWorkspace])
    })

    return () => {
      newSocket.emit('leave-workspace', activeWorkspace)
      newSocket.disconnect()
      if (socketRef.current === newSocket) {
        socketRef.current = null
      }
    }
  }, [activeWorkspace, queryClient, token])

  const { data: tasks = [] } = useQuery({
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

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ['meetings', activeWorkspace],
    queryFn: async () => {
      const res = await axios.get('/api/meetings', {
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
      if (socketRef.current) {
        socketRef.current.emit('task-updated', activeWorkspace);
      }
    }
  });

  const handleTaskMove = (taskId, newStatus) => {
    updateTaskMutation.mutate({ taskId, status: newStatus });
  };

  const handleTaskAction = () => {
    queryClient.invalidateQueries(['tasks', activeWorkspace]);
    if (socketRef.current) {
      socketRef.current.emit('task-updated', activeWorkspace);
    }
  };

  const handleTaskClick = (task, columnId = 'Todo') => {
    setSelectedTask(task);
    setInitialStatus(columnId);
    setIsModalOpen(true);
  };

  const totalTasks = tasks.length;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-[#FAF9F7] to-[#F3F0FF] text-[#1A1A1A]">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-3rem] top-12 h-[24rem] w-[24rem] rounded-full bg-gradient-to-br from-[#C4B5FD] via-[#93C5FD] to-[#E0E7FF] blur-3xl opacity-45" />
        <div className="absolute right-[-2rem] top-[-2rem] h-[20rem] w-[28rem] rounded-[45%] bg-gradient-to-br from-[#C4B5FD] via-[#93C5FD] to-[#E0E7FF] blur-3xl opacity-40" />
        <div className="absolute bottom-0 right-[8%] h-[18rem] w-[20rem] rounded-[40%] bg-gradient-to-br from-[#93C5FD] via-[#BFDBFE] to-white blur-3xl opacity-40" />
      </div>

      <div className="relative z-10">
        <div className="sticky top-0 z-50 border-b border-white/10 bg-white/60 px-6 py-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold text-[#1A1A1A]">
              <img src="/logo.png" alt="IntellMeet" className="h-8 w-auto" />
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-sm text-[#6B6560] transition hover:text-[#1A1A1A]"
            >
              <ArrowLeft size={16} />
              Back to dashboard
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 pt-6 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[#1A1A1A]">
                {activeWorkspace === 'personal' ? 'My Tasks' : 'Team Workspace'}
              </h1>
              <p className="mt-1 text-sm text-[#6B6560]">
                {activeWorkspace === 'personal' ? 'Personal To-Do Board' : 'IntellMeet — Sprint 1'}
              </p>
            </div>
            <span className="rounded-full border border-[#E8E4DD] bg-white text-xs px-3 py-1.5 text-[#6B6560]">
              {totalTasks} tasks
            </span>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 pb-6">
          <div className="mb-6 rounded-2xl border border-[#E8E4DD] bg-white p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#1A1A1A]">Meeting History</h2>
              <p className="text-sm text-[#6B6560]">Recent meetings in the active workspace</p>
            </div>
            <span className="text-xs text-[#6B6560] bg-[#F5F2EE] px-2.5 py-1 rounded-full">
              {meetings.length} meetings
            </span>
          </div>

          {meetingsLoading ? (
            <div className="py-8 text-center text-[#6B6560]">
              <Loader className="inline-block mr-2 animate-spin" size={16} />
              Loading meeting history...
            </div>
          ) : meetings.length === 0 ? (
            <div className="py-8 text-center text-[#6B6560]">No meetings found in this workspace yet.</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {meetings.slice(0, 6).map((meeting) => {
                const isPast = meeting.status === 'completed' || (meeting.scheduledAt && new Date(meeting.scheduledAt).getTime() < new Date().getTime() && meeting.status !== 'ongoing')
                return (
                  <button
                    key={meeting._id}
                    type="button"
                    onClick={() => navigate(isPast ? `/meeting/${meeting.roomId}/summary` : `/meeting/${meeting.roomId}`)}
                    className="text-left border border-[#E8E4DD] rounded-xl p-4 hover:border-[#7C3AED]/30 hover:bg-[#FAF9F7] transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Video size={14} className="text-[#7C3AED]" />
                          <p className="text-sm font-semibold text-[#1A1A1A]">{meeting.title}</p>
                        </div>
                        <p className="text-xs text-[#6B6560] flex items-center gap-1.5">
                          <Clock size={12} />
                          {formatMeetingDate(meeting.scheduledAt || meeting.createdAt)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="bg-[#F5F2EE] text-[#6B6560] text-[11px] px-2 py-1 rounded-full">
                            {getMeetingTypeLabel(meeting.meetingType)}
                          </span>
                          <span className="bg-[#EEF2FF] text-[#4338CA] text-[11px] px-2 py-1 rounded-full">
                            {getMeetingAccessLabel(meeting)}
                          </span>
                          {getMeetingAccessDetails(meeting).teams.map((teamName) => (
                            <span key={`${meeting._id}-history-team-${teamName}`} className="bg-[#ECFDF5] text-[#059669] text-[11px] px-2 py-1 rounded-full">
                              Team: {teamName}
                            </span>
                          ))}
                          {getMeetingAccessDetails(meeting).people.length > 0 && (
                            <span className="bg-[#FEF3C7] text-[#D97706] text-[11px] px-2 py-1 rounded-full">
                              {getMeetingAccessDetails(meeting).people.length} people
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${meeting.status === 'completed' ? 'bg-[#F3F4F6] text-[#6B6560]' : 'bg-[#EEF2FF] text-[#4338CA]'}`}>
                        {meeting.status || 'scheduled'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-[#6B6560]">
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {meeting.participants?.length || 1} participants
                      </span>
                      {meeting.meetingType && meeting.meetingType !== 'other' && (
                        <span className="capitalize">{meeting.meetingType}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

        <div className="mx-auto max-w-7xl px-6 pb-10">
          <KanbanBoard tasks={tasks} onTaskMove={handleTaskMove} onTaskClick={handleTaskClick} />
        </div>

        <TaskModal 
          key={`${selectedTask?._id || 'new'}-${initialStatus}-${activeWorkspace}-${isModalOpen ? 'open' : 'closed'}`}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          task={selectedTask}
          initialStatus={initialStatus}
          workspace={activeWorkspace}
          onSave={handleTaskAction}
          onDelete={handleTaskAction}
        />
      </div>
    </div>
  )
}
