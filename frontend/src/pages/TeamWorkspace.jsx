import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  MoreHorizontal,
  ArrowLeft,
  Users,
  CheckSquare,
  Circle,
  Clock,
  Tag,
} from 'lucide-react'
import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'

export const TeamWorkspace = () => {
  const navigate = useNavigate()
  const { token } = useAuthStore()

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
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await axios.get('/api/tasks', {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data
    },
    enabled: !!token
  })

  const getColumns = () => {
    const grouped = { Todo: [], 'In Progress': [], 'In Review': [], Done: [] }
    tasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push({
          id: task._id,
          title: task.title,
          tag: 'Backend', // Default tag
          assignee: task.assignee?.name?.substring(0, 2).toUpperCase() || 'U',
          priority: 'medium', // Default priority
          due: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'
        })
      }
    })

    return [
      { id: 'todo', title: 'To Do', color: '#6B6560', tasks: grouped['Todo'] },
      { id: 'inprogress', title: 'In Progress', color: '#D97706', tasks: grouped['In Progress'] },
      { id: 'review', title: 'In Review', color: '#7C3AED', tasks: grouped['In Review'] },
      { id: 'done', title: 'Done', color: '#059669', tasks: grouped['Done'] },
    ]
  }

  const columns = getColumns()

  const totalTasks = columns.reduce((sum, column) => sum + column.tasks.length, 0)

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      <div className="border-b border-[#E8E4DD] bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#1A1A1A] font-semibold">
          <span className="text-[#7C3AED]">●</span>
          IntellMeet
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
            <h1 className="text-2xl font-semibold text-[#1A1A1A]">Team Workspace</h1>
            <p className="text-sm text-[#6B6560] mt-1">IntellMeet — Sprint 1</p>
          </div>
          <span className="bg-white border border-[#E8E4DD] text-[#6B6560] text-xs px-3 py-1.5 rounded-full">
            {totalTasks} tasks
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-5">
        <div className="grid grid-cols-4 gap-3">
          {columns.map((column) => (
            <div
              key={column.id}
              className="bg-white border border-[#E8E4DD] rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: column.color }}
              />
              <div>
                <p className="text-lg font-semibold text-[#1A1A1A]">
                  {column.tasks.length}
                </p>
                <p className="text-xs text-[#6B6560]">{column.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-10">
        <div className="grid grid-cols-4 gap-4">
          {columns.map((column) => (
            <div
              key={column.id}
              className="bg-white border border-[#E8E4DD] rounded-2xl overflow-hidden flex flex-col"
            >
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
                <button className="w-6 h-6 rounded-lg hover:bg-[#F5F2EE] flex items-center justify-center text-[#6B6560] hover:text-[#1A1A1A] transition">
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex-1 p-3 space-y-2 min-h-[200px]">
                {column.tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Circle size={20} className="text-[#E8E4DD] mb-2" />
                    <p className="text-xs text-[#C4BDB5]">No tasks</p>
                  </div>
                ) : (
                  column.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-[#FAF9F7] border border-[#E8E4DD] rounded-xl p-3 hover:border-[#7C3AED]/30 hover:shadow-sm transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColors[task.tag]}`}>
                          {task.tag}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${priorityColors[task.priority]} ml-auto`} />
                      </div>
                      <p className="text-sm font-medium text-[#1A1A1A] mt-2 leading-snug">
                        {task.title}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-[#6B6560]">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {task.due}
                        </span>
                        <span className="w-6 h-6 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-[10px] font-semibold flex items-center justify-center">
                          {task.assignee}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
