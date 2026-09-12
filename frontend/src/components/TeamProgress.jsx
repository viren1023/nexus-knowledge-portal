import React, { useMemo } from 'react';

export default function TeamProgress({ members, tasks }) {
  const progressData = useMemo(() => {
    return members.map(member => {
      // Find tasks assigned to this member
      const memberTasks = tasks.filter(t => t.assigned_to === member.id);
      
      const total = memberTasks.length;
      const completed = memberTasks.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length;
      const inProgress = memberTasks.filter(t => ['in_progress', 'review'].includes(t.status?.toLowerCase())).length;
      
      // Calculate percentage, default to 0 if no tasks
      const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

      return {
        ...member,
        total,
        completed,
        inProgress,
        percentage
      };
    }).filter(member => member.total > 0);
  }, [members, tasks]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Team Progress</h2>
      {progressData.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          No team progress yet. Progress will appear when tasks are assigned.
        </div>
      ) : (
      
      <div className="grid grid-cols-1 gap-4">
        {progressData.map(data => (
          <div key={data.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                  {data.name ? data.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm leading-tight">{data.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{data.role}</p>
                </div>
              </div>
              <span className="text-sm font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-md">
                {data.percentage}%
              </span>
            </div>
            
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1 font-medium">
                <span>{data.completed} Completed</span>
                <span>{data.total} Total</span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-green-500 transition-all duration-1000 ease-out" 
                  style={{ width: `${data.total === 0 ? 0 : (data.completed / data.total) * 100}%` }}
                  title={`${data.completed} Completed`}
                ></div>
                <div 
                  className="h-full bg-amber-400 transition-all duration-1000 ease-out" 
                  style={{ width: `${data.total === 0 ? 0 : (data.inProgress / data.total) * 100}%` }}
                  title={`${data.inProgress} In Progress`}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
