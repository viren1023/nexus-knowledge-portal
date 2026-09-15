import React, { useState, useEffect, useRef } from 'react';
import { chatService } from '../../services/api';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { 
  Bot, 
  Sparkles, 
  FileSearch, 
  Kanban, 
  Code2, 
  PlusCircle, 
  AlertCircle,
  FolderOpen
} from 'lucide-react';

export default function ChatContainer({ 
  projectId, 
  sessionId, 
  currentSession,
  onSessionUpdated 
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedCitationsMsgId, setExpandedCitationsMsgId] = useState(null);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Fetch chat history whenever the active session changes
  useEffect(() => {
    if (!sessionId || !projectId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    const fetchHistory = async () => {
      setHistoryLoading(true);
      setError(null);
      try {
        const res = await chatService.getHistory(projectId, sessionId, 50);
        if (!isMounted) return;
        
        const data = res.data;
        const msgList = Array.isArray(data) ? data : (data.messages || []);
        
        // Normalize role / message_type
        const normalized = msgList.map(m => ({
          ...m,
          role: m.role || m.message_type || 'assistant',
          message_type: m.message_type || m.role || 'assistant'
        }));

        setMessages(normalized);
        setTimeout(() => scrollToBottom(false), 50);
      } catch (err) {
        console.error('Failed to load chat history', err);
        if (isMounted) {
          setError('Failed to load previous messages for this conversation.');
        }
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    };

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [sessionId, projectId]);

  // Scroll on new messages or loading state
  useEffect(() => {
    scrollToBottom(true);
  }, [messages, loading]);

  const handleSendMessage = async (text) => {
    if (!text || !text.trim() || !sessionId || !projectId || loading) return;

    const userText = text.trim();
    const tempUserId = `temp-${Date.now()}`;
    const userMessage = {
      id: tempUserId,
      role: 'user',
      message_type: 'user',
      content: userText,
      created_at: new Date().toISOString()
    };

    // Optimistic UI update
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    try {
      const res = await chatService.sendMessage(projectId, {
        session_id: sessionId,
        message: userText
      });

      const responseData = res.data;
      const aiMessage = {
        id: responseData.message_id || `ai-${Date.now()}`,
        role: 'assistant',
        message_type: 'assistant',
        content: responseData.response,
        intent: responseData.intent,
        confidence: responseData.confidence,
        sources: responseData.sources,
        sources_detailed: responseData.sources_detailed,
        suggested_task: responseData.suggested_task,
        follow_ups: responseData.follow_up_suggestions,
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);

      // If citations exist, expand by default on first response with citations
      if (responseData.sources_detailed && responseData.sources_detailed.length > 0) {
        setExpandedCitationsMsgId(aiMessage.id);
      }

      // Notify parent to refresh sidebar (e.g. Title generated, count updated)
      if (onSessionUpdated) {
        onSessionUpdated();
      }
    } catch (err) {
      console.error('Failed to send message', err);
      // Remove optimistic message or add error note
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          message_type: 'assistant',
          content: '⚠️ I encountered an error while processing your request. Please try again.',
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const starterPrompts = [
    {
      title: "Project Overview",
      desc: "Understand what this project does and key entry points",
      query: "What is this project about and what are its key components?",
      icon: <FolderOpen className="w-4 h-4 text-indigo-500" />
    },
    {
      title: "Task Query",
      desc: "Check current tasks, priorities, and sprint items",
      query: "Show me all current tasks and their priority",
      icon: <Kanban className="w-4 h-4 text-emerald-500" />
    },
    {
      title: "Code Discovery",
      desc: "Search reusable functions, components, and APIs",
      query: "What reusable code assets and helper functions are indexed?",
      icon: <Code2 className="w-4 h-4 text-blue-500" />
    },
    {
      title: "Create a Task",
      desc: "Draft a new task directly to your project board",
      query: "Create a task to implement comprehensive error logging with high priority",
      icon: <PlusCircle className="w-4 h-4 text-purple-500" />
    }
  ];

  if (!sessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
          <Bot className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Select or Start a Chat</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-1">
          Pick a previous conversation from the history sidebar or create a new one to begin exploring.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {historyLoading ? (
          <div className="space-y-4 max-w-3xl mx-auto py-8">
            <div className="h-16 bg-white border border-slate-200 rounded-2xl animate-pulse" />
            <div className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
            <div className="h-16 bg-indigo-50 border border-indigo-100 rounded-2xl animate-pulse ml-auto max-w-md" />
          </div>
        ) : messages.length === 0 ? (
          /* Empty Chat Welcome Screen */
          <div className="max-w-2xl mx-auto py-8 sm:py-12 px-4 text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {currentSession?.session_title || "How can I help you today?"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Ask questions about documentation, search indexed code assets, or manage project tasks.
              </p>
            </div>

            {/* Quick Starter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
              {starterPrompts.map((card, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(card.query)}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/20 transition-all duration-150 group cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 rounded-md bg-slate-50 group-hover:bg-indigo-100/60 transition-colors">
                      {card.icon}
                    </div>
                    <span className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {card.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">
                    {card.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Conversation Messages */
          <div className="max-w-4xl mx-auto">
            {messages.map((msg, index) => {
              const isAssistant = msg.role === 'assistant' || msg.message_type === 'assistant';
              const isLatestAssistant = isAssistant && (
                index === messages.length - 1 || 
                (index === messages.length - 2 && messages[messages.length - 1].role === 'user')
              );

              return (
                <ChatMessage
                  key={msg.id || index}
                  message={msg}
                  isExpanded={expandedCitationsMsgId === (msg.id || index)}
                  onToggleCitations={() => {
                    const id = msg.id || index;
                    setExpandedCitationsMsgId(expandedCitationsMsgId === id ? null : id);
                  }}
                  onQuickAction={handleSendMessage}
                  isLatestAssistantMessage={isLatestAssistant}
                  projectId={projectId}
                />
              );
            })}

            {/* Typing Indicator */}
            {loading && (
              <div className="flex items-start gap-3 max-w-[80%] mb-4 animate-in fade-in duration-150">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-xs text-slate-500 font-medium ml-2">Searching project context...</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <ChatInput 
        onSendMessage={handleSendMessage}
        disabled={loading || historyLoading}
      />
    </div>
  );
}
