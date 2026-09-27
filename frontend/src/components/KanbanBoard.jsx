import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { taskService } from '../services/api';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  GripVertical, 
  AlertCircle, 
  CheckCircle2, 
  Circle,
  HelpCircle
} from 'lucide-react';

const COLUMNS = [
  {
    id: 'backlog',
    title: 'Backlog',
    accent: 'border-t-slate-400',
    badge: 'bg-slate-100 text-slate-700',
    icon: <Circle className="size-3.5 text-slate-400" />
  },
  {
    id: 'todo',
    title: 'To Do',
    accent: 'border-t-sky-500',
    badge: 'bg-sky-50 text-sky-700 border border-sky-100',
    icon: <Circle className="size-3.5 text-sky-500" />
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    accent: 'border-t-indigo-500',
    badge: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
    icon: <Clock className="size-3.5 text-indigo-500" />
  },
  {
    id: 'review',
    title: 'Review',
    accent: 'border-t-amber-500',
    badge: 'bg-amber-50 text-amber-700 border border-amber-100',
    icon: <HelpCircle className="size-3.5 text-amber-500" />
  },
  {
    id: 'completed',
    title: 'Done',
    accent: 'border-t-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    icon: <CheckCircle2 className="size-3.5 text-emerald-500" />
  }
];

export default function KanbanBoard({ 
  tasks = [], 
  projectId, 
  members = [], 
  onTaskUpdated, 
  onTaskClick,
  onAddNewTask 
}) {
  const [columns, setColumns] = useState({});
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name)),
    [members]
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Assignee filter
      if (filterAssignee === 'mine' && task.assigned_to !== currentUser.user_id) return false;
      if (filterAssignee === 'unassigned' && task.assigned_to) return false;
      if (filterAssignee.startsWith('user:') && task.assigned_to !== filterAssignee.replace('user:', '')) return false;

      // Priority filter
      if (filterPriority !== 'all' && (task.priority || 'medium') !== filterPriority) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = task.title?.toLowerCase().includes(query);
        const descMatch = task.description?.toLowerCase().includes(query);
        if (!titleMatch && !descMatch) return false;
      }

      return true;
    });
  }, [tasks, filterAssignee, filterPriority, searchQuery, currentUser.user_id]);

  useEffect(() => {
    const initialCols = COLUMNS.reduce((acc, col) => {
      acc[col.id] = [];
      return acc;
    }, {});

    filteredTasks.forEach(task => {
      let status = task.status;
      if (status === 'done') status = 'completed';
      if (!status) status = 'todo';
      
      if (initialCols[status]) {
        initialCols[status].push(task);
      } else {
        initialCols['todo'].push(task);
      }
    });

    setColumns(initialCols);
  }, [filteredTasks]);

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const startCol = source.droppableId;
    const endCol = destination.droppableId;

    const startTasks = Array.from(columns[startCol]);
    const [movedTask] = startTasks.splice(source.index, 1);
    const newColumns = { ...columns };

    if (startCol === endCol) {
      startTasks.splice(destination.index, 0, movedTask);
      newColumns[startCol] = startTasks;
      setColumns(newColumns);
    } else {
      const endTasks = Array.from(columns[endCol]);
      movedTask.status = endCol;
      endTasks.splice(destination.index, 0, movedTask);
      newColumns[startCol] = startTasks;
      newColumns[endCol] = endTasks;
      setColumns(newColumns);

      try {
        await taskService.update(projectId, draggableId, { status: endCol });
        onTaskUpdated?.();
      } catch (err) {
        console.error('Failed to update task status', err);
        onTaskUpdated?.();
      }
    }
  };

  const getPriorityBadge = (priority = 'medium') => {
    switch (priority.toLowerCase()) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            <span className="size-1 rounded-full bg-rose-500" />
            High
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-200">
            <span className="size-1 rounded-full bg-slate-400" />
            Low
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <span className="size-1 rounded-full bg-amber-500" />
            Medium
          </span>
        );
    }
  };

  const isOverdue = (dueDate, status) => {
    if (!dueDate || ['completed', 'done'].includes(status)) return false;
    const today = new Date().toISOString().split('T')[0];
    return dueDate < today;
  };

  const formatDueDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks by title or details..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        {/* Filter Pills & Selects */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Assignee Toggles */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-medium">
            <button
              type="button"
              onClick={() => setFilterAssignee('all')}
              className={`px-3 py-1 rounded-md transition-colors ${filterAssignee === 'all' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterAssignee('mine')}
              className={`px-3 py-1 rounded-md transition-colors ${filterAssignee === 'mine' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              My Tasks
            </button>
          </div>

          {/* Member Dropdown */}
          <select
            value={filterAssignee.startsWith('user:') || filterAssignee === 'unassigned' ? filterAssignee : ''}
            onChange={(e) => setFilterAssignee(e.target.value || 'all')}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
          >
            <option value="">Filter Assignee</option>
            <option value="unassigned">Unassigned Only</option>
            {sortedMembers.map(m => (
              <option key={m.id} value={`user:${m.id}`}>{m.name}</option>
            ))}
          </select>

          {/* Priority Dropdown */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>

          {onAddNewTask && (
            <button
              type="button"
              onClick={onAddNewTask}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold shadow-2xs transition-all ml-auto lg:ml-2 cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>New Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Kanban Drag-and-Drop Columns */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[620px]">
          {COLUMNS.map(column => {
            const colTasks = columns[column.id] || [];

            return (
              <div
                key={column.id}
                className="w-76 min-w-[290px] flex-shrink-0 flex flex-col rounded-2xl bg-slate-100/60 border border-slate-200/80 shadow-2xs"
              >
                {/* Column Header */}
                <div className={`p-3.5 rounded-t-2xl border-t-3 ${column.accent} bg-white border-b border-slate-200/80 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    {column.icon}
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      {column.title}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${column.badge}`}>
                      {colTasks.length}
                    </span>
                  </div>

                  {onAddNewTask && (
                    <button
                      type="button"
                      onClick={onAddNewTask}
                      title={`Add task to ${column.title}`}
                      className="size-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-2.5 overflow-y-auto space-y-2.5 min-h-[480px] max-h-[70vh] transition-colors rounded-b-2xl ${
                        snapshot.isDraggingOver ? 'bg-indigo-50/50 ring-2 ring-indigo-300 ring-inset' : ''
                      }`}
                    >
                      {colTasks.length === 0 && !snapshot.isDraggingOver && (
                        <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200/80 rounded-xl bg-white/40">
                          Empty column
                        </div>
                      )}

                      {colTasks.map((task, index) => {
                        const overdue = isOverdue(task.due_date, column.id);
                        const assignedMember = members.find(m => m.id === task.assigned_to) || task.assignee;

                        return (
                          <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                            {(provided, dragSnapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                onClick={() => onTaskClick?.(task)}
                                className={`group relative rounded-xl border bg-white p-3.5 shadow-2xs transition-all duration-150 cursor-pointer select-none text-left ${
                                  dragSnapshot.isDragging
                                    ? 'rotate-1 shadow-xl border-indigo-400 ring-2 ring-indigo-200 z-50'
                                    : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                                }`}
                              >
                                {/* Drag Affordance handle & Priority */}
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  {getPriorityBadge(task.priority)}

                                  <div
                                    {...provided.dragHandleProps}
                                    title="Drag task"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-slate-300 group-hover:text-slate-400 p-0.5 rounded hover:bg-slate-100 transition-colors cursor-grab active:cursor-grabbing"
                                  >
                                    <GripVertical className="size-3.5" />
                                  </div>
                                </div>

                                {/* Task Title */}
                                <h4 className="font-semibold text-xs sm:text-sm text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                                  {task.title}
                                </h4>

                                {/* Task Description preview if present */}
                                {task.description && (
                                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-normal">
                                    {task.description}
                                  </p>
                                )}

                                {/* Card Footer: Due Date & Assignee */}
                                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                  {/* Due Date Indicator */}
                                  {task.due_date ? (
                                    <span
                                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                                        overdue ? 'text-rose-600 font-semibold' : 'text-slate-500'
                                      }`}
                                      title={overdue ? 'Task is overdue!' : 'Due date'}
                                    >
                                      {overdue ? (
                                        <AlertCircle className="size-3 text-rose-500" />
                                      ) : (
                                        <Calendar className="size-3 text-slate-400" />
                                      )}
                                      <span className="tabular-nums">{formatDueDate(task.due_date)}</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">No due date</span>
                                  )}

                                  {/* Assignee Pill / Avatar */}
                                  <div className="flex items-center gap-1.5">
                                    {assignedMember ? (
                                      <div
                                        className="size-5 rounded-full bg-slate-800 text-white text-[9px] font-bold flex items-center justify-center shadow-2xs"
                                        title={`Assigned to ${assignedMember.name || 'Member'}`}
                                      >
                                        {assignedMember.name ? assignedMember.name.charAt(0).toUpperCase() : '?'}
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-medium">Unassigned</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
