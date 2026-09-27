import React, { useMemo } from 'react';
import { CheckCircle2, Clock, AlertTriangle, Layers, TrendingUp, Calendar } from 'lucide-react';

export default function TeamProgress({ members = [], tasks = [], compact = false }) {
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length;
    const inProgress = tasks.filter(t => ['in_progress', 'review'].includes(t.status?.toLowerCase())).length;
    const backlogOrTodo = total - completed - inProgress;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingDeadlines = tasks.filter(t => {
      if (!t.due_date || ['completed', 'done'].includes(t.status?.toLowerCase())) return false;
      return t.due_date >= todayStr;
    }).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 3);

    const overdueCount = tasks.filter(t => {
      if (!t.due_date || ['completed', 'done'].includes(t.status?.toLowerCase())) return false;
      return t.due_date < todayStr;
    }).length;

    // Member-by-member breakdown
    const memberProgress = members.map(m => {
      const assigned = tasks.filter(t => t.assigned_to === m.id);
      const mTotal = assigned.length;
      const mCompleted = assigned.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length;
      const mInProgress = assigned.filter(t => ['in_progress', 'review'].includes(t.status?.toLowerCase())).length;
      const mPercent = mTotal > 0 ? Math.round((mCompleted / mTotal) * 100) : 0;
      return {
        ...m,
        total: mTotal,
        completed: mCompleted,
        inProgress: mInProgress,
        percent: mPercent,
      };
    }).sort((a, b) => b.total - a.total);

    return { total, completed, inProgress, backlogOrTodo, percent, upcomingDeadlines, overdueCount, memberProgress };
  }, [members, tasks]);

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="relative size-10 flex items-center justify-center">
          <svg className="size-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-slate-100"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-indigo-600 transition-all duration-700 ease-out"
              strokeDasharray={`${stats.percent}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute text-[10px] font-bold text-slate-800 tabular-nums">{stats.percent}%</span>
        </div>
        <div className="leading-tight">
          <div className="text-xs font-semibold text-slate-900">{stats.completed} of {stats.total} Tasks</div>
          <div className="text-[11px] text-slate-500">{stats.inProgress} active in progress</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-6">
      {/* Top Banner: Metric Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Project Velocity & Team Progress</h2>
            <p className="text-xs text-slate-500">Live task execution and individual member contributions</p>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 px-4 py-2 rounded-xl">
          <div className="text-right">
            <div className="text-xs font-bold text-slate-900 tabular-nums">{stats.percent}% Completed</div>
            <div className="text-[11px] text-slate-500 tabular-nums">{stats.completed} / {stats.total} Tasks</div>
          </div>
          <div className="w-24 sm:w-32 h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${stats.percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4 Metric Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Total Tasks</span>
            <Layers className="size-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 tabular-nums">{stats.total}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-medium">Completed</span>
            <CheckCircle2 className="size-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-900 tabular-nums">{stats.completed}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
          <div className="flex items-center justify-between text-indigo-700 mb-1">
            <span className="text-xs font-medium">In Progress</span>
            <Clock className="size-3.5 text-indigo-600" />
          </div>
          <div className="text-xl font-bold text-indigo-900 tabular-nums">{stats.inProgress}</div>
        </div>

        <div className={`p-3.5 rounded-xl border ${stats.overdueCount > 0 ? 'bg-red-50/60 border-red-100 text-red-900' : 'bg-slate-50 border-slate-100 text-slate-900'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-medium ${stats.overdueCount > 0 ? 'text-red-700' : 'text-slate-500'}`}>Overdue</span>
            <AlertTriangle className={`size-3.5 ${stats.overdueCount > 0 ? 'text-red-500' : 'text-slate-400'}`} />
          </div>
          <div className="text-xl font-bold tabular-nums">{stats.overdueCount}</div>
        </div>
      </div>

      {/* Member Contribution Breakdown */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Team Workload Distribution</span>
          <span className="text-xs text-slate-500">{stats.memberProgress.filter(m => m.total > 0).length} active contributors</span>
        </div>

        {stats.memberProgress.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400 rounded-xl border border-dashed border-slate-200">
            No team members assigned yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stats.memberProgress.slice(0, 6).map((m) => (
              <div key={m.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-7 rounded-full bg-slate-800 text-white font-semibold text-xs flex items-center justify-center shrink-0">
                      {m.name ? m.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{m.name}</p>
                      <p className="text-[10px] text-slate-400 capitalize truncate">{m.role}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-slate-700 tabular-nums">{m.percent}%</span>
                    <p className="text-[10px] text-slate-400 tabular-nums">{m.completed}/{m.total} tasks</p>
                  </div>
                </div>

                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${m.total === 0 ? 0 : (m.completed / m.total) * 100}%` }}
                    title={`${m.completed} Completed`}
                  />
                  <div
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${m.total === 0 ? 0 : (m.inProgress / m.total) * 100}%` }}
                    title={`${m.inProgress} In Progress`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Deadlines Widget if any */}
      {stats.upcomingDeadlines.length > 0 && (
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 font-medium flex items-center gap-1.5">
            <Calendar className="size-3.5 text-slate-400" />
            Next upcoming milestones:
          </span>
          <div className="flex flex-wrap gap-2">
            {stats.upcomingDeadlines.map(t => (
              <span key={t.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                <span className="size-1.5 rounded-full bg-amber-500" />
                <span className="truncate max-w-[120px]">{t.title}</span>
                <span className="text-slate-400 font-mono text-[10px]">
                  {new Date(`${t.due_date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
