import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Pin, 
  Search, 
  Clock, 
  X,
  Sparkles
} from 'lucide-react';

export default function SessionPanel({
  sessions = [],
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onTogglePinSession,
  loading = false,
  isOpen = false,
  onClose
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState(null);

  const formatSessionTitle = (session) => {
    if (session.session_title && !session.session_title.startsWith('Chat ')) {
      return session.session_title;
    }
    if (session.first_message_preview) {
      return session.first_message_preview;
    }
    return session.session_title || 'New Chat';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24 && d.getDate() === now.getDate()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (diffDays === 1 || (diffDays === 0 && d.getDate() !== now.getDate())) {
        return 'Yesterday';
      }
      if (diffDays < 7) {
        return d.toLocaleDateString([], { weekday: 'short' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(s => 
      (s.session_title && s.session_title.toLowerCase().includes(q)) ||
      (s.first_message_preview && s.first_message_preview.toLowerCase().includes(q))
    );
  }, [sessions, searchQuery]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container - Light Theme Matching Portal */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-72 sm:w-80 flex flex-col h-full
          bg-slate-50 border-r border-slate-200 text-slate-800 shadow-xl lg:shadow-none
          transform transition-transform duration-200 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Chat History</h2>
              <p className="text-[11px] text-slate-500">
                {sessions.length} {sessions.length === 1 ? 'conversation' : 'conversations'}
              </p>
            </div>
          </div>

          {/* Close button for mobile */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action: New Chat & Search */}
        <div className="p-3 bg-white/70 border-b border-slate-200/80 space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onNewSession();
              if (onClose) onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading && sessions.length === 0 ? (
            <div className="space-y-2 p-1">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 bg-slate-200/60 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-center p-4 text-slate-400">
              <MessageSquare className="w-6 h-6 text-slate-300 mb-1.5" />
              <p className="text-xs font-medium text-slate-600">
                {searchQuery ? 'No conversations found' : 'No chat history'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {searchQuery ? 'Try another search term' : 'Click New Chat to begin'}
              </p>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isActive = currentSessionId === session.id;
              const formattedTitle = formatSessionTitle(session);
              const timestamp = formatDate(session.last_accessed || session.created_at);

              return (
                <div
                  key={session.id}
                  className={`
                    group relative flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer
                    border transition-all duration-150 text-left
                    ${isActive 
                      ? 'bg-white border-slate-300 shadow-xs border-l-3 border-l-indigo-600 text-slate-900' 
                      : 'border-transparent text-slate-700 hover:bg-slate-200/60 hover:text-slate-900'
                    }
                  `}
                  onClick={() => {
                    onSelectSession(session.id);
                    if (onClose) onClose();
                  }}
                >
                  {/* Icon */}
                  <div 
                    className={`
                      w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs
                      ${isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200/70 text-slate-500'}
                    `}
                  >
                    <MessageSquare className="w-3 h-3" />
                  </div>

                  {/* Title and Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs truncate ${isActive ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {formattedTitle}
                      </p>
                      {session.is_pinned && (
                        <Pin className="w-3 h-3 text-amber-500 shrink-0 fill-amber-500" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                      <span className="flex items-center gap-0.5 shrink-0">
                        <Clock className="w-2.5 h-2.5 opacity-60" />
                        {timestamp}
                      </span>
                      {session.message_count > 0 && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span>{session.message_count} msgs</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions on hover */}
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    {onTogglePinSession && (
                      <button
                        type="button"
                        title={session.is_pinned ? "Unpin" : "Pin"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePinSession(session.id);
                        }}
                        className={`p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-slate-100 transition-colors ${session.is_pinned ? 'text-amber-500' : ''}`}
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                    )}

                    <button
                      type="button"
                      title="Delete conversation"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionToDelete(session.id);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-white text-[11px] text-slate-500 flex items-center justify-between shrink-0">
          <span>Conversations</span>
          <span className="text-slate-400 font-medium text-[10px]">{sessions.length} total</span>
        </div>
      </aside>

      {/* Delete Confirmation Modal (Theme-Cohesive) */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-sm w-full shadow-xl text-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Delete Conversation?</h3>
                <p className="text-xs text-slate-500 mt-0.5">This conversation history will be removed.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSession(sessionToDelete);
                  setSessionToDelete(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white transition-colors cursor-pointer shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
