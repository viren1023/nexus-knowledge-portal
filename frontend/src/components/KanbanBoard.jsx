import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { taskService } from '../services/api';
import { UserRound } from 'lucide-react';

const COLUMNS = [
  {
    id: 'backlog',
    title: 'Backlog',
    shell: 'bg-slate-50 border-slate-200',
    header: 'bg-slate-100/80 border-slate-200',
    count: 'bg-slate-200 text-slate-700',
    over: 'bg-slate-100'
  },
  {
    id: 'todo',
    title: 'To Do',
    shell: 'bg-sky-50/60 border-sky-100',
    header: 'bg-sky-100/80 border-sky-200',
    count: 'bg-sky-200 text-sky-800',
    over: 'bg-sky-100/70'
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    shell: 'bg-indigo-50/60 border-indigo-100',
    header: 'bg-indigo-100/80 border-indigo-200',
    count: 'bg-indigo-200 text-indigo-800',
    over: 'bg-indigo-100/70'
  },
  {
    id: 'review',
    title: 'Review',
    shell: 'bg-amber-50/60 border-amber-100',
    header: 'bg-amber-100/80 border-amber-200',
    count: 'bg-amber-200 text-amber-800',
    over: 'bg-amber-100/70'
  },
  {
    id: 'completed',
    title: 'Done',
    shell: 'bg-emerald-50/60 border-emerald-100',
    header: 'bg-emerald-100/80 border-emerald-200',
    count: 'bg-emerald-200 text-emerald-800',
    over: 'bg-emerald-100/70'
  }
];

export default function KanbanBoard({ tasks, projectId, members = [], onTaskUpdated, onTaskClick }) {
  const [columns, setColumns] = useState({});
  const [filter, setFilter] = useState('all');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name)),
    [members]
  );

  const filteredTasks = useMemo(() => tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'mine') return task.assigned_to === currentUser.user_id;
    if (filter === 'unassigned') return !task.assigned_to;
    if (filter.startsWith('user:')) return task.assigned_to === filter.replace('user:', '');
    return true;
  }), [tasks, filter, currentUser.user_id]);

  useEffect(() => {
    // Group tasks by status
    const initialCols = COLUMNS.reduce((acc, col) => {
      acc[col.id] = [];
      return acc;
    }, {});

    filteredTasks.forEach(task => {
      let status = task.status;
      if (status === 'done') status = 'completed'; // normalize
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

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const startCol = source.droppableId;
    const endCol = destination.droppableId;

    // Optimistically update UI
    const startTasks = Array.from(columns[startCol]);
    const [movedTask] = startTasks.splice(source.index, 1);
    
    let newColumns = { ...columns };

    if (startCol === endCol) {
      startTasks.splice(destination.index, 0, movedTask);
      newColumns[startCol] = startTasks;
      setColumns(newColumns);
    } else {
      const endTasks = Array.from(columns[endCol]);
      movedTask.status = endCol; // update local status
      endTasks.splice(destination.index, 0, movedTask);
      newColumns[startCol] = startTasks;
      newColumns[endCol] = endTasks;
      setColumns(newColumns);

      // Persist to backend
      try {
        await taskService.update(projectId, draggableId, { status: endCol });
        onTaskUpdated();
      } catch (err) {
        console.error('Failed to update task status', err);
        onTaskUpdated(); // revert by refetching
      }
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            All Tasks
          </button>
          <button
            type="button"
            onClick={() => setFilter('mine')}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${filter === 'mine' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            My Tasks
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="font-medium">Assigned To</span>
          <select
            value={filter.startsWith('user:') || filter === 'unassigned' ? filter : ''}
            onChange={(event) => setFilter(event.target.value || 'all')}
            className="min-w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Any assignee</option>
            <option value="unassigned">Unassigned</option>
            {sortedMembers.map(member => (
              <option key={member.id} value={`user:${member.id}`}>{member.name}</option>
            ))}
          </select>
        </label>
      </div>

      {filteredTasks.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          No tasks match this filter.
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 h-[600px] items-start w-full">
        {COLUMNS.map(column => (
          <div key={column.id} className={`${column.shell} border rounded-xl w-80 min-w-[300px] flex flex-col h-full flex-shrink-0`}>
            <div className={`${column.header} p-4 border-b rounded-t-xl flex justify-between items-center shrink-0`}>
              <h3 className="font-semibold text-slate-700">{column.title}</h3>
              <span className={`${column.count} px-2 py-0.5 rounded-full text-xs font-medium`}>
                {columns[column.id]?.length || 0}
              </span>
            </div>
            
            <Droppable droppableId={column.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 p-3 overflow-y-auto space-y-3 transition-colors ${snapshot.isDraggingOver ? column.over : ''}`}
                >
                  {columns[column.id]?.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-4 text-sm text-slate-500">
                      No tasks yet.
                    </div>
                  )}
                  {columns[column.id]?.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onClick={() => onTaskClick(task)}
                          className={`bg-white p-4 border rounded-xl shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow transition-all
                            ${snapshot.isDragging ? 'shadow-xl border-indigo-500 ring-2 ring-indigo-200 rotate-2' : 'border-slate-200'}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-slate-800 text-sm leading-tight pr-2">{task.title}</h4>
                          </div>
                          {task.description && (
                            <p className="text-xs text-slate-500 line-clamp-2 mb-3">{task.description}</p>
                          )}
                          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                              {task.priority || 'Medium'}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-slate-500 min-w-0">
                              <UserRound className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[120px]">{task.assignee?.name || 'Unassigned'}</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
      </DragDropContext>
    </div>
  );
}
