import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { chatService, projectService } from '../services/api';
import SessionPanel from '../components/chat/SessionPanel';
import ChatContainer from '../components/chat/ChatContainer';
import Header from '../components/Header';
import { Menu, ChevronDown } from 'lucide-react';

export default function ChatPage() {
  const params = useParams();
  const navigate = useNavigate();

  // Handle both /projects/:id/chat and /chat
  const [projectId, setProjectId] = useState(params.id || null);
  const [projectList, setProjectList] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // If projectId is in params, ensure state reflects it
  useEffect(() => {
    if (params.id && params.id !== projectId) {
      setProjectId(params.id);
      setCurrentSessionId(null);
    }
  }, [params.id]);

  // Fetch available projects to populate project selector if needed
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await projectService.getAll();
        const projs = res.data.projects || [];
        setProjectList(projs);

        if (!projectId && projs.length > 0) {
          // Default to first project if user came to /chat without an id
          setProjectId(projs[0].id);
        }
      } catch (err) {
        console.error('Failed to load projects list', err);
      }
    };
    loadProjects();
  }, []);

  // Fetch project details when projectId changes
  useEffect(() => {
    if (!projectId) return;

    const fetchProject = async () => {
      try {
        const res = await projectService.getOne(projectId);
        setCurrentProject(res.data.project || res.data);
      } catch (err) {
        console.error('Failed to fetch project info', err);
      }
    };
    fetchProject();
  }, [projectId]);

  // Fetch sessions for the active project
  const fetchSessions = useCallback(async () => {
    if (!projectId) return;

    setLoadingSessions(true);
    try {
      const res = await chatService.listSessions(projectId, 50);
      const sessionList = res.data.sessions || [];
      setSessions(sessionList);

      // If active session was deleted or invalid, clear selection
      if (currentSessionId && !sessionList.some(s => s.id === currentSessionId)) {
        setCurrentSessionId(null);
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    } finally {
      setLoadingSessions(false);
    }
  }, [projectId, currentSessionId]);

  useEffect(() => {
    if (projectId) {
      fetchSessions();
    }
  }, [projectId]);

  // Click "New Chat": simply reset selection to draft state (DO NOT create DB record)
  const handleNewSession = () => {
    setCurrentSessionId(null);
  };

  const handleSessionCreated = (newId) => {
    setCurrentSessionId(newId);
    fetchSessions();
  };

  const handleSelectSession = (sessionId) => {
    setCurrentSessionId(sessionId);

    // Touch last_accessed timestamp in background
    if (projectId && sessionId) {
      chatService.touchSession(projectId, sessionId).catch(err => {
        console.warn('Failed to touch session', err);
      });
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!projectId || !sessionId) return;

    try {
      await chatService.deleteSession(projectId, sessionId);
      const updated = sessions.filter(s => s.id !== sessionId);
      setSessions(updated);

      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }
    } catch (err) {
      console.error('Failed to delete session', err);
    }
  };

  const handleTogglePinSession = async (sessionId) => {
    if (!projectId || !sessionId) return;

    try {
      const res = await chatService.pinSession(projectId, sessionId);
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return { ...s, is_pinned: res.data.is_pinned };
        }
        return s;
      }).sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.last_accessed || b.created_at) - new Date(a.last_accessed || a.created_at);
      }));
    } catch (err) {
      console.error('Failed to toggle pin', err);
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50">
      {/* Unified Portal Header */}
      <Header
        projectName={currentProject?.name}
        subTitle={currentProject?.name ? `Projects / ${currentProject.name} / Chat` : 'AI Chat'}
        backTo={projectId ? `/projects/${projectId}` : '/'}
        backLabel={currentProject?.name ? `Back to ${currentProject.name}` : 'Back to projects'}
      >
        {/* Mobile Sidebar Hamburger Toggle */}
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="lg:hidden inline-flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
          aria-label="Open chat history"
          title="Chat History"
        >
          <Menu className="w-4 h-4" />
          <span className="text-xs font-semibold">History</span>
        </button>

        {/* Project Selector if multiple projects exist */}
        {projectList.length > 1 && (
          <div className="relative hidden sm:block">
            <select
              value={projectId || ''}
              onChange={(e) => {
                const newId = e.target.value;
                setProjectId(newId);
                navigate(`/projects/${newId}/chat`);
              }}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg pl-2.5 pr-7 py-1 text-xs font-semibold text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate max-w-[160px]"
            >
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </Header>

      {/* Main Workspace: Sidebar + Chat Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Session Panel Sidebar (Light Cohesive Theme) */}
        <SessionPanel
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onTogglePinSession={handleTogglePinSession}
          loading={loadingSessions}
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* Full-Screen Chat Viewport */}
        <ChatContainer
          projectId={projectId}
          sessionId={currentSessionId}
          currentSession={currentSession}
          onSessionCreated={handleSessionCreated}
          onSessionUpdated={() => fetchSessions()}
        />
      </div>
    </div>
  );
}
