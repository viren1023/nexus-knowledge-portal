import React, { useMemo } from 'react';
import { Activity, CheckCircle, FileUp, PlusCircle, UserCheck, Clock, GitCommit } from 'lucide-react';

export default function ProjectActivityView({ project, tasks = [], members = [] }) {
  const activityEvents = useMemo(() => {
    const list = [];

    // Synthesize events from tasks
    tasks.forEach(task => {
      if (['completed', 'done'].includes(task.status?.toLowerCase())) {
        list.push({
          id: `task-done-${task.id}`,
          type: 'task_completed',
          title: `Task completed: "${task.title}"`,
          user: task.assignee?.name || 'Team Member',
          time: 'Recently completed',
          icon: <CheckCircle className="size-4 text-emerald-600" />,
          color: 'bg-emerald-50 border-emerald-100',
        });
      } else {
        list.push({
          id: `task-create-${task.id}`,
          type: 'task_created',
          title: `Task logged: "${task.title}"`,
          user: task.assignee?.name || 'Project Lead',
          time: task.due_date ? `Due ${task.due_date}` : 'Active milestone',
          icon: <PlusCircle className="size-4 text-indigo-600" />,
          color: 'bg-indigo-50 border-indigo-100',
        });
      }
    });

    // Synthesize events from members
    members.forEach(member => {
      list.push({
        id: `member-${member.id}`,
        type: 'member_joined',
        title: `${member.name} joined the project as ${member.role?.replace('_', ' ')}`,
        user: member.name,
        time: 'Project member',
        icon: <UserCheck className="size-4 text-sky-600" />,
        color: 'bg-sky-50 border-sky-100',
      });
    });

    return list.slice(0, 15);
  }, [tasks, members]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Project Activity & Audit Timeline</h2>
          <p className="text-xs text-slate-500">Chronological history of task updates, deployments, and assets</p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
          Live feed
        </span>
      </div>

      {activityEvents.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
          No recent activity recorded.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {activityEvents.map((event) => (
            <div key={event.id} className="relative flex items-start gap-3 group">
              {/* Timeline marker */}
              <div className={`absolute -left-6 mt-0.5 size-5 rounded-full border ${event.color} flex items-center justify-center bg-white shadow-2xs`}>
                {event.icon}
              </div>

              <div className="flex-1 bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 rounded-xl p-3 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-900">{event.title}</p>
                  <span className="text-[10px] text-slate-400 font-medium shrink-0">{event.time}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Initiated by <span className="font-medium text-slate-700">{event.user}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
