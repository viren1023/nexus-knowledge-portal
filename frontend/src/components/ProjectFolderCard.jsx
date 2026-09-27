import React from 'react';
import { Folder, Users, CheckSquare, FileText, ArrowUpRight, Clock } from 'lucide-react';

export default function ProjectFolderCard({ project, onClick }) {
  const tasksCount = project.tasks_count || 0;
  const docsCount = project.documents_count || 0;
  const teamSize = project.team_size || 1;
  const completedTasks = project.completed_tasks_count ?? Math.round(tasksCount * 0.6); // fallback if backend doesn't send
  const progressPercent = tasksCount > 0 ? Math.round((completedTasks / tasksCount) * 100) : 0;

  // Determine a status based on progress or project status
  const status = project.status || (progressPercent === 100 ? 'completed' : progressPercent > 0 ? 'active' : 'planning');
  
  const statusConfig = {
    active: { label: 'In Progress', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80', dot: 'bg-emerald-500' },
    completed: { label: 'Completed', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200/80', dot: 'bg-blue-500' },
    planning: { label: 'Planning', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' },
    on_hold: { label: 'On Hold', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200/80', dot: 'bg-amber-500' },
  }[status] || { label: 'Active', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80', dot: 'bg-emerald-500' };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="group relative cursor-pointer select-none text-left focus:outline-none"
    >
      {/* Subtle behind-layer representing folder contents/papers */}
      <div className="absolute inset-x-3 -top-2.5 h-6 rounded-t-xl bg-slate-200/80 border-t border-x border-slate-300/70 transition-all duration-200 group-hover:-top-3 group-hover:bg-slate-200" />
      <div className="absolute inset-x-1.5 -top-1.5 h-6 rounded-t-xl bg-slate-100 border-t border-x border-slate-200 transition-all duration-200 group-hover:-top-2" />

      {/* Main Folder Body */}
      <div className="relative rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs transition-all duration-200 ease-out group-hover:shadow-lg group-hover:border-slate-300 group-hover:-translate-y-1 flex flex-col min-h-[220px] justify-between">
        
        {/* Top Folder Header Tab & Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Folder Tab Aesthetic Pill */}
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-indigo-50 border border-indigo-100/80 text-indigo-600 flex items-center justify-center shadow-2xs group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
              <Folder className="size-4.5" />
            </div>
            <span className="text-[11px] font-mono tracking-tight font-medium text-slate-400 uppercase">
              PRJ-{String(project.id).slice(0, 4)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
              <span className={`size-1.5 rounded-full ${statusConfig.dot}`} />
              {statusConfig.label}
            </span>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 group-hover:text-indigo-600">
              <ArrowUpRight className="size-4" />
            </div>
          </div>
        </div>

        {/* Project Name and Description */}
        <div className="space-y-1.5 mb-4">
          <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
            {project.name}
          </h3>
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {project.description || 'No description provided for this project.'}
          </p>
        </div>

        {/* Progress Bar & Percentage */}
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Completion</span>
            <span className="font-semibold text-slate-700 tabular-nums">{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Folder Footer Metadata & Team */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-slate-600 font-medium" title="Tasks">
              <CheckSquare className="size-3.5 text-slate-400" />
              <span className="tabular-nums">{tasksCount}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-slate-600 font-medium" title="Documents & Assets">
              <FileText className="size-3.5 text-slate-400" />
              <span className="tabular-nums">{docsCount}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Team</span>
            <div className="flex -space-x-1.5 overflow-hidden">
              {Array.from({ length: Math.min(teamSize, 3) }).map((_, idx) => (
                <div
                  key={idx}
                  className="size-6 rounded-full bg-slate-800 text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white shadow-2xs"
                >
                  {String.fromCharCode(65 + idx)}
                </div>
              ))}
              {teamSize > 3 && (
                <div className="size-6 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold flex items-center justify-center border-2 border-white shadow-2xs">
                  +{teamSize - 3}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
