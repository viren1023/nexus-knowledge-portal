import React, { useMemo } from 'react';
import { Users, UserPlus, Mail, Shield, CheckCircle, Clock, Award, Trash2 } from 'lucide-react';

export default function ProjectTeamView({ 
  members = [], 
  tasks = [], 
  canManageTeam = false, 
  onAddMemberClick,
  onRemoveMember 
}) {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const teamData = useMemo(() => {
    return members.map((member, index) => {
      const assignedTasks = tasks.filter(t => t.assigned_to === member.id);
      const completed = assignedTasks.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length;
      const inProgress = assignedTasks.filter(t => ['in_progress', 'review'].includes(t.status?.toLowerCase())).length;
      const pending = assignedTasks.length - completed - inProgress;

      // Online status simulation (first 2 members online, others idle/offline)
      const isOnline = index % 3 !== 2;

      return {
        ...member,
        assignedTasks,
        totalTasks: assignedTasks.length,
        completed,
        inProgress,
        pending,
        isOnline,
        isCurrentUser: member.id === currentUser.user_id,
      };
    }).sort((a, b) => {
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      return b.totalTasks - a.totalTasks;
    });
  }, [members, tasks, currentUser.user_id]);

  const getRoleBadge = (role = 'developer') => {
    switch (role.toLowerCase()) {
      case 'manager':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">Manager</span>;
      case 'team_lead':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">Team Lead</span>;
      case 'qa':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">QA Engineer</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">Developer</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header and Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Project Team Directory</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
              {members.length} Members
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Active collaborators, role privileges, and assigned task workloads
          </p>
        </div>

        {canManageTeam && (
          <button
            type="button"
            onClick={onAddMemberClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="size-3.5" />
            <span>Add Member</span>
          </button>
        )}
      </div>

      {/* Team Member Cards Grid */}
      {teamData.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl">
          <Users className="size-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No team members assigned to this project yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamData.map((member) => (
            <div
              key={member.id}
              className={`relative rounded-xl border p-4 transition-all duration-150 flex flex-col justify-between ${
                member.isCurrentUser 
                  ? 'border-indigo-200 bg-indigo-50/20 shadow-2xs' 
                  : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-2xs'
              }`}
            >
              <div>
                {/* Member Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="relative">
                    <div className="size-11 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                      {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    {/* Online status indicator */}
                    <span
                      title={member.isOnline ? 'Online now' : 'Idle'}
                      className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-white ${
                        member.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {getRoleBadge(member.role)}
                    {member.isCurrentUser && (
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">You</span>
                    )}
                  </div>
                </div>

                {/* Identity */}
                <h3 className="font-bold text-sm text-slate-900 truncate">{member.name}</h3>
                <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                  <Mail className="size-3 text-slate-400 shrink-0" />
                  <span className="truncate">{member.email || 'No email provided'}</span>
                </p>
              </div>

              {/* Workload Stats & Active Tasks */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Workload</span>
                  <span className="font-semibold text-slate-700 tabular-nums">
                    {member.totalTasks} {member.totalTasks === 1 ? 'Task' : 'Tasks'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
                    <span className="block text-[10px] text-emerald-600 font-medium">Done</span>
                    <span className="text-xs font-bold text-emerald-800 tabular-nums">{member.completed}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100">
                    <span className="block text-[10px] text-indigo-600 font-medium">Active</span>
                    <span className="text-xs font-bold text-indigo-800 tabular-nums">{member.inProgress}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="block text-[10px] text-slate-500 font-medium">Todo</span>
                    <span className="text-xs font-bold text-slate-700 tabular-nums">{member.pending}</span>
                  </div>
                </div>

                {/* Remove member button for managers if not self */}
                {canManageTeam && !member.isCurrentUser && onRemoveMember && (
                  <button
                    type="button"
                    onClick={() => onRemoveMember(member.id)}
                    className="w-full mt-2 text-[11px] font-medium text-slate-400 hover:text-rose-600 py-1 rounded hover:bg-rose-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="size-3" />
                    <span>Remove from project</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
