import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/api';
import Header from '../components/Header';
import ProjectFolderCard from '../components/ProjectFolderCard';
import { 
  Folder, 
  FolderPlus, 
  CalendarClock, 
  CheckCircle2, 
  Layers, 
  Search, 
  Clock, 
  AlertTriangle,
  Sparkles
} from 'lucide-react';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [personalDashboard, setPersonalDashboard] = useState({ my_tasks: [], upcoming_tasks: [], due_soon_days: 7 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'completed'
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setError('');
        const [projectsResponse, personalResponse] = await Promise.all([
          projectService.getAll(),
          projectService.getPersonalDashboard()
        ]);
        setProjects(projectsResponse.data.projects || []);
        setPersonalDashboard(personalResponse.data || { my_tasks: [], upcoming_tasks: [], due_soon_days: 7 });
      } catch (error) {
        console.error('Failed to fetch dashboard', error);
        setError('We could not load your dashboard. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const handleCreateProject = () => {
    const name = prompt('Enter project name:');
    if (name && name.trim()) {
      projectService.create({ name: name.trim(), description: 'New project workspace' })
        .then(() => window.location.reload())
        .catch(err => alert(err.response?.data?.error || 'Failed to create project'));
    }
  };

  const formatStatus = (value) => (value || 'todo').replace('_', ' ');
  const formatDate = (value) => {
    if (!value) return 'No due date';
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const priorityClasses = {
    high: 'bg-rose-50 text-rose-700 border-rose-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const upcomingIds = new Set((personalDashboard.upcoming_tasks || []).map(task => task.id));
  const regularMyTasks = (personalDashboard.my_tasks || []).filter(task => !upcomingIds.has(task.id)).slice(0, 6);
  const overdueTasks = (personalDashboard.upcoming_tasks || []).filter(task => task.due_state === 'overdue');
  const dueSoonTasks = (personalDashboard.upcoming_tasks || []).filter(task => task.due_state === 'due_soon');

  // Filter projects by search and status
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = p.name?.toLowerCase().includes(query);
        const descMatch = p.description?.toLowerCase().includes(query);
        if (!nameMatch && !descMatch) return false;
      }
      if (statusFilter === 'completed' && p.status !== 'completed') return false;
      if (statusFilter === 'active' && p.status === 'completed') return false;
      return true;
    });
  }, [projects, searchQuery, statusFilter]);

  // Aggregate stats
  const totalTasks = projects.reduce((acc, p) => acc + (p.tasks_count || 0), 0);
  const totalDocs = projects.reduce((acc, p) => acc + (p.documents_count || 0), 0);

  const renderTaskRow = (task, options = {}) => (
    <button
      key={`${options.prefix || 'task'}-${task.id}`}
      onClick={() => navigate(`/projects/${task.project_id}`)}
      className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-left hover:border-indigo-300 hover:shadow-2xs transition-all cursor-pointer group"
    >
      <div className="min-w-0 flex items-center gap-3">
        <div className={`size-2 rounded-full ${options.overdue ? 'bg-rose-500' : 'bg-slate-300 group-hover:bg-indigo-500'} transition-colors shrink-0`} />
        <div className="min-w-0">
          <p className="font-semibold text-xs sm:text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
            {task.title}
          </p>
          <p className="text-[11px] text-slate-400 truncate">{task.project_name}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <span className="text-[11px] font-medium capitalize text-slate-500 hidden sm:inline">
          {formatStatus(task.status)}
        </span>
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${priorityClasses[task.priority] || priorityClasses.low}`}>
          {task.priority || 'medium'}
        </span>
        <span className={`text-xs font-semibold tabular-nums ${options.overdue ? 'text-rose-600' : 'text-slate-500'}`}>
          {formatDate(task.due_date)}
        </span>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header subTitle="Executive Overview" />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* Top Hero Section: Welcome & High-level KPIs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Project Hub & Workspace
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Welcome back, <span className="font-semibold text-slate-700">{user.name || 'User'}</span>. Here is your enterprise project portfolio and active workload.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {user.role === 'manager' && (
              <button
                type="button"
                onClick={handleCreateProject}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white px-4 py-2.5 rounded-xl shadow-xs text-xs sm:text-sm font-semibold transition-all cursor-pointer"
              >
                <FolderPlus className="size-4" />
                <span>New Project Folder</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs sm:text-sm text-rose-700 font-medium">
            {error}
          </div>
        )}

        {/* 4 Executive Metric Chips */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Projects</span>
              <Folder className="size-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{projects.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">Active enterprise folders</p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Tasks</span>
              <Layers className="size-4 text-sky-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{totalTasks}</div>
            <p className="text-[11px] text-slate-400 mt-1">Across all project boards</p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Due Soon</span>
              <CalendarClock className="size-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{dueSoonTasks.length + overdueTasks.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">
              {overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : 'On target'}
            </p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Indexed Docs</span>
              <Sparkles className="size-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{totalDocs}</div>
            <p className="text-[11px] text-slate-400 mt-1">Vector-indexed for AI</p>
          </div>
        </div>

        {/* SECTION: PROJECT FOLDERS (Requirement 1) */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Project Folders</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums">
                  {filteredProjects.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Each project workspace is organized as a dedicated asset and task folder
              </p>
            </div>

            {/* Project Search & Filter */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search project folders..."
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 w-48 sm:w-60"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="all">All Folders</option>
                <option value="active">Active Only</option>
                <option value="completed">Completed Only</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-56 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center space-y-3">
              <div className="size-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Folder className="size-6" />
              </div>
              <h3 className="font-semibold text-sm text-slate-800">No project folders found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery ? 'Try adjusting your search terms or filter criteria.' : 'Create a new project folder to start tracking tasks and organizing knowledge.'}
              </p>
              {user.role === 'manager' && (
                <button
                  type="button"
                  onClick={handleCreateProject}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Create First Project
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              {filteredProjects.map((project) => (
                <ProjectFolderCard
                  key={project.id}
                  project={project}
                  onClick={() => navigate(`/projects/${project.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* SECTION: PERSONAL TASKS & DEADLINES (Compact Executive Layout) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
          
          {/* My Assigned Tasks */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <CheckCircle2 className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">My Assigned Tasks</h3>
                  <p className="text-[11px] text-slate-500">Tasks requiring your attention</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-500 tabular-nums">
                {regularMyTasks.length} active
              </span>
            </div>

            {regularMyTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No active tasks assigned directly to you.
              </div>
            ) : (
              <div className="space-y-2">
                {regularMyTasks.map(task => renderTaskRow(task))}
              </div>
            )}
          </div>

          {/* Upcoming & Overdue Tasks */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <CalendarClock className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Upcoming & Overdue Milestones</h3>
                  <p className="text-[11px] text-slate-500">Approaching target deadlines</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-500 tabular-nums">
                {dueSoonTasks.length + overdueTasks.length} scheduled
              </span>
            </div>

            {overdueTasks.length === 0 && dueSoonTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                All caught up! No imminent deadlines this week.
              </div>
            ) : (
              <div className="space-y-4">
                {overdueTasks.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-600">
                      <AlertTriangle className="size-3" />
                      <span>Overdue</span>
                    </div>
                    {overdueTasks.map(task => renderTaskRow(task, { overdue: true, prefix: 'overdue' }))}
                  </div>
                )}

                {dueSoonTasks.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                      <Clock className="size-3" />
                      <span>Due within 7 days</span>
                    </div>
                    {dueSoonTasks.map(task => renderTaskRow(task, { prefix: 'due-soon' }))}
                  </div>
                )}
              </div>
            )}
          </div>

        </section>

      </main>
    </div>
  );
}
