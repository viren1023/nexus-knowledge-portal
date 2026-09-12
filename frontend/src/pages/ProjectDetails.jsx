import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectService, taskService } from '../services/api';
import AddMemberModal from '../components/AddMemberModal';
import UploadAssetModal from '../components/UploadAssetModal';
import AddTaskModal from '../components/AddTaskModal';
import EditTaskModal from '../components/EditTaskModal';
import KanbanBoard from '../components/KanbanBoard';
import ProjectChat from '../components/ProjectChat';
import TeamProgress from '../components/TeamProgress';
import ProjectAssets from '../components/ProjectAssets';
import Header from '../components/Header';

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const canManageTeam = ['manager', 'team_lead'].includes(currentUser.role);

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
      
      const currentUserId = localStorage.getItem('user_id'); // We need user id or role.
      // Wait, we don't have user_id stored easily unless it's in jwt payload. 
      // Instead, we can find the current user's role from members array.
      // The `checkAuth` or `authContext` might provide it, but let's try to extract it from jwt.
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setCurrentUserRole(payload.role);
        }
      } catch (e) {}
    } catch (error) {
      console.error('Failed to fetch project details', error);
      setError('We could not load this project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchProjectData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
          <div className="h-32 bg-white rounded-xl border border-slate-200 animate-pulse" />
          <div className="h-96 bg-white rounded-xl border border-slate-200 animate-pulse" />
        </main>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-6xl mx-auto p-4 sm:p-6">
          <div className="bg-white border border-red-100 rounded-xl p-8 text-center">
            <p className="text-red-600 font-medium">{error || 'Project not found.'}</p>
            <button onClick={fetchProjectData} className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium">Retry</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header projectName={project.name} />
      <main className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
        <button
          onClick={() => navigate('/')}
          className="text-slate-600 hover:text-slate-900 flex items-center gap-2 transition-colors font-medium text-sm"
        >
          &larr; Back to projects
        </button>

      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
            <p className="text-slate-600 mt-2 max-w-3xl">{project.description || 'No description provided.'}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded bg-slate-100 px-2.5 py-1">{tasks.length} Tasks</span>
              <span className="rounded bg-slate-100 px-2.5 py-1">{members.length} Members</span>
              <span className="rounded bg-slate-100 px-2.5 py-1">{project.team_size || members.length} Team Size</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800">Kanban / Tasks</h2>
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg"
              >
                + Add Task
              </button>
            </div>
            <KanbanBoard 
              tasks={tasks} 
              projectId={id} 
              members={members}
              onTaskUpdated={fetchProjectData}
              onTaskClick={(task) => setEditingTask(task)}
            />
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800">Team Members</h2>
              {canManageTeam && (
                <button
                  onClick={() => setIsMemberModalOpen(true)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded"
                >
                  + Add
                </button>
              )}
            </div>
            {members.length === 0 ? (
              <p className="text-slate-500">No team members assigned.</p>
            ) : (
              <ul className="space-y-4">
                {[...members]
                  .sort((a, b) => {
                    const currentUserId = currentUser.user_id;
                    if (a.id === currentUserId) return -1;
                    if (b.id === currentUserId) return 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map(member => {
                    const currentUserId = currentUser.user_id;
                    return (
                  <li key={member.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-inner">
                      {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 text-sm">{member.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{member.role}</p>
                    </div>
                    </div>
                    {member.id === currentUserId && (
                      <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">You</span>
                    )}
                  </li>
                    );
                  })}
              </ul>
            )}
          </div>
          <TeamProgress members={members} tasks={tasks} />
      </div>

      <ProjectAssets 
        projectId={id} 
        currentUserRole={currentUserRole} 
        onUploadClick={() => setIsUploadModalOpen(true)}
      />

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

      <ProjectChat projectId={id} />
      </main>
    </div>
  );
}
