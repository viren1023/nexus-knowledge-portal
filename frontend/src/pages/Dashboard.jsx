import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/api';
import Header from '../components/Header';
import { CalendarClock, FolderKanban } from 'lucide-react';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [personalDashboard, setPersonalDashboard] = useState({ my_tasks: [], upcoming_tasks: [], due_soon_days: 7 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    // Basic placeholder for project creation
    const name = prompt('Enter project name:');
    if (name) {
      projectService.create({ name, description: 'New project' })
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
    high: 'bg-red-50 text-red-700 border-red-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    low: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const upcomingIds = new Set((personalDashboard.upcoming_tasks || []).map(task => task.id));
  const regularMyTasks = (personalDashboard.my_tasks || []).filter(task => !upcomingIds.has(task.id)).slice(0, 6);
  const overdueTasks = (personalDashboard.upcoming_tasks || []).filter(task => task.due_state === 'overdue');
  const dueSoonTasks = (personalDashboard.upcoming_tasks || []).filter(task => task.due_state === 'due_soon');

  const renderTaskRow = (task, options = {}) => (
    <button
      key={`${options.prefix || 'task'}-${task.id}`}
      onClick={() => navigate(`/projects/${task.project_id}`)}
      className="w-full grid grid-cols-1 md:grid-cols-[1fr_180px_120px_100px] gap-2 md:gap-4 items-center rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
    >
      <div className="min-w-0">
        <p className="font-semibold text-sm text-slate-900 truncate">{task.title}</p>
        <p className="text-xs text-slate-500 truncate">{task.project_name}</p>
      </div>
      <span className="text-xs font-medium capitalize text-slate-600">{formatStatus(task.status)}</span>
      <span className={`w-fit rounded border px-2 py-1 text-[10px] font-bold uppercase ${priorityClasses[task.priority] || priorityClasses.low}`}>
        {task.priority || 'low'}
      </span>
      <span className={`text-xs font-semibold ${options.overdue ? 'text-red-700' : 'text-slate-600'}`}>
        {formatDate(task.due_date)}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Projects Dashboard</h1>
            <p className="text-slate-600">Welcome back, {user.name}</p>
          </div>
          {user.role === 'manager' && (
            <button
              onClick={handleCreateProject}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm font-medium transition-colors"
            >
              + New Project
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="h-56 rounded-xl bg-white border border-slate-200 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(item => <div key={item} className="h-44 rounded-xl bg-white border border-slate-200 animate-pulse" />)}
            </div>
          </div>
        ) : (
          <>
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <FolderKanban className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-bold text-slate-800">My Tasks</h2>
              </div>
              {regularMyTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  {(personalDashboard.my_tasks || []).length === 0
                    ? "You don't have any tasks assigned to you yet."
                    : "Your due-soon tasks are highlighted below."}
                </div>
              ) : (
                <div className="space-y-3">
                  {regularMyTasks.map(task => renderTaskRow(task))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <CalendarClock className="w-5 h-5 text-amber-600" />
                <h2 className="text-xl font-bold text-slate-800">Upcoming / Overdue</h2>
              </div>
              {overdueTasks.length === 0 && dueSoonTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  You're all caught up. No tasks are due soon.
                </div>
              ) : (
                <div className="space-y-5">
                  {overdueTasks.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-bold uppercase text-red-700">Overdue</div>
                      <div className="space-y-3">
                        {overdueTasks.map(task => renderTaskRow(task, { overdue: true, prefix: 'overdue' }))}
                      </div>
                    </div>
                  )}
                  {dueSoonTasks.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-bold uppercase text-amber-700">Due Soon</div>
                      <div className="space-y-3">
                        {dueSoonTasks.map(task => renderTaskRow(task, { prefix: 'due-soon' }))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-800 mb-4">My Projects</h2>
              {projects.length === 0 ? (
                <div className="bg-white p-10 rounded-xl shadow-sm border border-slate-200 text-center">
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">No Projects Yet</h3>
                  <p className="text-slate-500 mb-6">You aren't a member of any projects.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group flex flex-col h-full"
                    >
                      <h3 className="font-bold text-xl text-slate-800 group-hover:text-indigo-600 transition-colors">{project.name}</h3>
                      <p className="text-sm text-slate-500 mt-2 line-clamp-2 flex-grow">{project.description || 'No description provided.'}</p>

                      <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between text-xs font-medium text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                          {project.team_size} Members
                        </span>
                        <span>{project.tasks_count} Tasks</span>
                        <span>{project.documents_count} Docs</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
