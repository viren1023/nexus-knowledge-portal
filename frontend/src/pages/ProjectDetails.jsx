import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectService, taskService } from '../services/api';
import AddMemberModal from '../components/AddMemberModal';
import UploadAssetModal from '../components/UploadAssetModal';
import AddTaskModal from '../components/AddTaskModal';
import EditTaskModal from '../components/EditTaskModal';
import KanbanBoard from '../components/KanbanBoard';
import TeamProgress from '../components/TeamProgress';
import ProjectAssets from '../components/ProjectAssets';
import ProjectTeamView from '../components/ProjectTeamView';
import ProjectTasksListView from '../components/ProjectTasksListView';
import ProjectActivityView from '../components/ProjectActivityView';
import ProjectSettingsView from '../components/ProjectSettingsView';
import ProjectChatDrawer from '../components/ProjectChatDrawer';
import Header from '../components/Header';
import { 
  Folder, 
  ArrowLeft, 
  LayoutDashboard, 
  Kanban, 
  FolderKanban, 
  Files, 
  ListTodo, 
  Users, 
  Activity, 
  Settings, 
  Plus, 
  Upload, 
  ChevronRight
} from 'lucide-react';

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'kanban' | 'assets' | 'tasks' | 'team' | 'activity' | 'settings'

  // Modals state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const canManageTeam = ['manager', 'team_lead', 'admin'].includes(currentUser.role);

  const fetchProjectData = async () => {
    try {
      setError('');
      const [projectRes, tasksRes, membersRes] = await Promise.all([
        projectService.getOne(id),
        taskService.getAll(id),
        projectService.getMembers(id)
      ]);
      setProject(projectRes.data.project || projectRes.data);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : (tasksRes.data.tasks || []));
      setMembers(membersRes.data.members || []);

      try {
        const token = localStorage.getItem('token');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setCurrentUserRole(payload.role);
        }
      } catch {}
    } catch (error) {
      console.error('Failed to fetch project details', error);
      setError('We could not load this project. Please verify connectivity or permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchProjectData();
  }, [id]);

  const handleRemoveMember = async (devId) => {
    if (!window.confirm("Are you sure you want to remove this member from the project?")) return;
    try {
      await projectService.removeMember(id, devId);
      fetchProjectData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to remove member");
    }
  };

  // Calculate project completion percent
  const completedTasks = tasks.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="size-4" /> },
    { id: 'kanban', label: 'Kanban', icon: <Kanban className="size-4" />, count: tasks.length },
    { id: 'assets', label: 'Assets', icon: <Files className="size-4" /> },
    { id: 'tasks', label: 'Tasks', icon: <ListTodo className="size-4" />, count: tasks.length },
    { id: 'team', label: 'Team', icon: <Users className="size-4" />, count: members.length },
    { id: 'activity', label: 'Activity', icon: <Activity className="size-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="size-4" /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
          <div className="h-40 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          <div className="h-96 bg-white rounded-2xl border border-slate-200 animate-pulse" />
        </main>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-4xl mx-auto p-6 sm:p-12 text-center">
          <div className="bg-white border border-rose-100 rounded-2xl p-8 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">Project Not Available</h2>
            <p className="text-xs text-rose-600 mb-4">{error || 'Project not found.'}</p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => navigate('/')} 
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Back to Dashboard
              </button>
              <button 
                onClick={fetchProjectData} 
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header projectName={project.name} subTitle="Project Workspace" />

      {/* STICKY PROJECT HEADER & NAVIGATION (Requirements 2, 3, 8) */}
      <section className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3.5 pb-0">
          
          {/* Top Bar: Breadcrumb, Project Identity & Quick Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3">
            
            {/* Identity & Status */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => navigate('/')}
                title="Back to all projects"
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors shrink-0 cursor-pointer"
              >
                <ArrowLeft className="size-4" />
              </button>

              <div className="size-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-2xs">
                <Folder className="size-4.5" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate tracking-tight">
                    {project.name}
                  </h1>
                  
                  {/* Status Badge */}
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Active</span>
                  </span>

                  {/* Compact Progress Badge */}
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                    <span className="tabular-nums font-semibold text-slate-800">{progressPercent}%</span> complete
                  </span>
                </div>

                <p className="text-xs text-slate-500 truncate max-w-xl hidden sm:block">
                  {project.description || 'Enterprise project workspace and knowledge base.'}
                </p>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
              {/* Team Avatars preview */}
              <div 
                onClick={() => setActiveTab('team')}
                role="button"
                tabIndex={0}
                title="View project team"
                className="hidden lg:flex items-center -space-x-1.5 overflow-hidden mr-2 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {members.slice(0, 4).map((m) => (
                  <div
                    key={m.id}
                    className="size-7 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-2xs"
                    title={m.name}
                  >
                    {m.name ? m.name.charAt(0).toUpperCase() : '?'}
                  </div>
                ))}
                {members.length > 4 && (
                  <div className="size-7 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center border-2 border-white">
                    +{members.length - 4}
                  </div>
                )}
              </div>

              {canManageTeam && (
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">Add Member</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Upload className="size-3.5" />
                <span className="hidden sm:inline">Upload</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTaskModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>New Task</span>
              </button>
            </div>
          </div>

          {/* Sticky Tab Navigation Bar */}
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-slate-100 pt-1 -mb-px">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2.5 border-b-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-bold ${
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

        </div>
      </section>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Team Progress at Top (Requirement 7) */}
            <TeamProgress members={members} tasks={tasks} />

            {/* Quick Kanban preview & Team Snapshot */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Quick Tasks Summary */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="size-4 text-indigo-600" />
                    <h3 className="font-bold text-sm text-slate-900">Active Sprint Tasks</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('kanban')}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Kanban Board</span>
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>

                {tasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    No tasks yet. Create one with the "+ New Task" button above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks.slice(0, 5).map(task => (
                      <div
                        key={task.id}
                        onClick={() => setEditingTask(task)}
                        className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <h4 className="font-semibold text-slate-900 truncate">{task.title}</h4>
                          <p className="text-[11px] text-slate-500 capitalize">{task.status?.replace('_', ' ')}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            task.priority === 'high' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {task.priority || 'Medium'}
                          </span>
                          <span className="text-slate-400 text-[11px] tabular-nums">
                            {task.due_date || 'No date'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Team Members Snapshot */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-indigo-600" />
                      <h3 className="font-bold text-sm text-slate-900">Project Team</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('team')}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                    >
                      Directory ↗
                    </button>
                  </div>

                  <ul className="space-y-3">
                    {members.slice(0, 5).map(m => (
                      <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {m.name ? m.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{m.name}</p>
                            <p className="text-[10px] text-slate-400 capitalize truncate">{m.role}</p>
                          </div>
                        </div>
                        {m.id === currentUser.user_id && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">You</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {canManageTeam && (
                  <button
                    type="button"
                    onClick={() => setIsMemberModalOpen(true)}
                    className="w-full mt-4 py-2 rounded-lg border border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                  >
                    + Add Team Member
                  </button>
                )}
              </div>

            </div>

            {/* Quick Assets Preview */}
            <ProjectAssets 
              projectId={id} 
              currentUserRole={currentUserRole} 
              onUploadClick={() => setIsUploadModalOpen(true)}
            />
          </div>
        )}

        {/* KANBAN TAB */}
        {activeTab === 'kanban' && (
          <div className="animate-in fade-in duration-150">
            <KanbanBoard
              tasks={tasks}
              projectId={id}
              members={members}
              onTaskUpdated={fetchProjectData}
              onTaskClick={(task) => setEditingTask(task)}
              onAddNewTask={() => setIsTaskModalOpen(true)}
            />
          </div>
        )}

        {/* ASSETS TAB */}
        {activeTab === 'assets' && (
          <div className="animate-in fade-in duration-150">
            <ProjectAssets
              projectId={id}
              currentUserRole={currentUserRole}
              onUploadClick={() => setIsUploadModalOpen(true)}
            />
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <div className="animate-in fade-in duration-150">
            <ProjectTasksListView
              tasks={tasks}
              projectId={id}
              members={members}
              onTaskUpdated={fetchProjectData}
              onTaskClick={(task) => setEditingTask(task)}
              onAddNewTask={() => setIsTaskModalOpen(true)}
            />
          </div>
        )}

        {/* TEAM TAB */}
        {activeTab === 'team' && (
          <div className="animate-in fade-in duration-150">
            <ProjectTeamView
              members={members}
              tasks={tasks}
              canManageTeam={canManageTeam}
              onAddMemberClick={() => setIsMemberModalOpen(true)}
              onRemoveMember={handleRemoveMember}
            />
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <div className="animate-in fade-in duration-150">
            <ProjectActivityView
              project={project}
              tasks={tasks}
              members={members}
            />
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="animate-in fade-in duration-150">
            <ProjectSettingsView
              project={project}
              onProjectUpdated={fetchProjectData}
            />
          </div>
        )}

      </main>

      {/* AI Assistant Chat Drawer (Requirement 9) */}
      <ProjectChatDrawer projectId={id} projectName={project.name} />

      {/* MODALS */}
      <AddMemberModal  
        isOpen={isMemberModalOpen} 
        onClose={() => setIsMemberModalOpen(false)} 
        projectId={id}
        onMemberAdded={fetchProjectData}
      />
      
      <UploadAssetModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        projectId={id}
        onUploadSuccess={fetchProjectData}
      />

      <AddTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projectId={id}
        members={members}
        onTaskAdded={fetchProjectData}
      />

      <EditTaskModal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        projectId={id}
        members={members}
        task={editingTask}
        onTaskUpdated={fetchProjectData}
      />
    </div>
  );
}
