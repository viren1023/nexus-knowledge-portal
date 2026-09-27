import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowUpDown, 
  User,
  Filter
} from 'lucide-react';
import { taskService } from '../services/api';

export default function ProjectTasksListView({ 
  tasks = [], 
  projectId, 
  members = [], 
  onTaskUpdated, 
  onTaskClick,
  onAddNewTask 
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortField, setSortField] = useState('due_date');
  const [sortAsc, setSortAsc] = useState(true);

  const filteredTasks = useMemo(() => {
    let result = tasks.filter(task => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && (task.priority || 'medium') !== priorityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = task.title?.toLowerCase().includes(q);
        const matchDesc = task.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [tasks, statusFilter, priorityFilter, search, sortField, sortAsc]);

  const handleToggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleQuickStatusChange = async (e, task, newStatus) => {
    e.stopPropagation();
    try {
      await taskService.update(projectId, task.id, { status: newStatus });
      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to update task status', err);
    }
  };

  const getPriorityBadge = (priority = 'medium') => {
    switch (priority.toLowerCase()) {
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">High</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">Low</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">Medium</span>;
    }
  };

  const getStatusBadge = (status = 'todo') => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'done':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">Done</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">In Progress</span>;
      case 'review':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">Review</span>;
      case 'backlog':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">Backlog</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-50 text-sky-700 border border-sky-200">To Do</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Task List & Work Breakdown</h2>
          <p className="text-xs text-slate-500">Tabular overview of project milestones, assignees, and target schedules</p>
        </div>

        {onAddNewTask && (
          <button
            type="button"
            onClick={onAddNewTask}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
          >
            <Plus className="size-3.5" />
            <span>Add Task</span>
          </button>
        )}
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="backlog">Backlog</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="completed">Done</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="text-[11px] text-slate-400 uppercase bg-slate-50 border-b border-slate-200 font-semibold select-none">
            <tr>
              <th className="px-4 py-3 cursor-pointer hover:text-slate-700" onClick={() => handleToggleSort('title')}>
                <div className="flex items-center gap-1">
                  <span>Task Title</span>
                  <ArrowUpDown className="size-3" />
                </div>
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-slate-700" onClick={() => handleToggleSort('status')}>
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  <ArrowUpDown className="size-3" />
                </div>
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-slate-700" onClick={() => handleToggleSort('priority')}>
                <div className="flex items-center gap-1">
                  <span>Priority</span>
                  <ArrowUpDown className="size-3" />
                </div>
              </th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3 cursor-pointer hover:text-slate-700" onClick={() => handleToggleSort('due_date')}>
                <div className="flex items-center gap-1">
                  <span>Due Date</span>
                  <ArrowUpDown className="size-3" />
                </div>
              </th>
              <th className="px-4 py-3 text-right">Quick Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No tasks found matching criteria.
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => {
                const assignedMember = members.find(m => m.id === task.assigned_to) || task.assignee;
                const isDone = ['completed', 'done'].includes(task.status?.toLowerCase());

                return (
                  <tr
                    key={task.id}
                    onClick={() => onTaskClick?.(task)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleQuickStatusChange(e, task, isDone ? 'todo' : 'completed')}
                          title={isDone ? 'Mark as incomplete' : 'Mark as done'}
                          className={`size-4 rounded-full border flex items-center justify-center transition-colors ${
                            isDone 
                              ? 'bg-emerald-500 border-emerald-500 text-white' 
                              : 'border-slate-300 hover:border-indigo-500'
                          }`}
                        >
                          {isDone && <CheckCircle2 className="size-3" />}
                        </button>
                        <span className={`${isDone ? 'line-through text-slate-400' : ''} group-hover:text-indigo-600 transition-colors`}>
                          {task.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(task.status)}
                    </td>
                    <td className="px-4 py-3">
                      {getPriorityBadge(task.priority)}
                    </td>
                    <td className="px-4 py-3">
                      {assignedMember ? (
                        <div className="flex items-center gap-1.5">
                          <div className="size-5 rounded-full bg-slate-800 text-white text-[9px] font-bold flex items-center justify-center">
                            {assignedMember.name ? assignedMember.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <span className="truncate max-w-[120px] text-slate-700">{assignedMember.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">
                      {task.due_date ? (
                        new Date(`${task.due_date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onTaskClick?.(task)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
