import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Send, 
  X, 
  Maximize2, 
  Bot, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Lightbulb,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { chatService } from '../services/api';

export default function ProjectChatDrawer({ projectId, projectName }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    if (messages.length === 0) {
      setMessages([
        { 
          type: 'assistant', 
          content: `Hello! I am your AI assistant for **${projectName || 'this project'}**. Ask me to analyze indexed documents, summarize tasks, track blockers, or draft new work items.` 
        }
      ]);
    }
  };

  useEffect(() => {
    const handleGlobalTrigger = () => handleOpen();
    window.addEventListener('open-project-chat', handleGlobalTrigger);
    return () => window.removeEventListener('open-project-chat', handleGlobalTrigger);
  }, [projectId]);

  const handleSend = async (messageText) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage = { type: 'user', content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    if (!messageText) setInput('');
    setLoading(true);

    let activeSessionId = sessionId;
    try {
      if (!activeSessionId) {
        const sessionRes = await chatService.startSession(projectId);
        activeSessionId = sessionRes.data.session_id;
        setSessionId(activeSessionId);
      }

      const res = await chatService.sendMessage(projectId, {
        session_id: activeSessionId,
        message: textToSend,
        previous_context: true
      });
      
      const assistantMessage = { 
        type: 'assistant', 
        content: res.data.response,
        sources: res.data.sources,
        suggested_task: res.data.suggested_task,
        intent: res.data.intent
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Failed to send message', err);
      setMessages(prev => [
        ...prev, 
        { type: 'assistant', content: 'Apologies, I encountered an issue connecting to the inference engine. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "Summarize current project status & blockers",
    "Which tasks are overdue or due soon?",
    "Explain architectural documentation",
    "Draft a new high priority bug fix task"
  ];

  return (
    <>
      {/* Floating AI Button (Tasteful & Unobtrusive) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            type="button"
            onClick={handleOpen}
            title="Ask Nexus AI"
            className="group inline-flex items-center gap-2.5 px-4 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-xl hover:shadow-2xl border border-slate-700/80 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97] cursor-pointer"
          >
            <div className="relative flex items-center justify-center">
              <Sparkles className="size-4.5 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-indigo-500 animate-pulse" />
            </div>
            <span className="text-xs font-semibold tracking-wide">Ask AI</span>
          </button>
        </div>
      )}

      {/* Expanded AI Chat Panel Drawer */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] max-h-[calc(100vh-2.5rem)] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-slate-200/90 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
          
          {/* Header */}
          <div className="bg-slate-900 px-4 py-3.5 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-xs sm:text-sm tracking-tight truncate">Nexus AI Assistant</h3>
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  Contextual knowledge assistant for {projectName || 'project'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button 
                type="button"
                onClick={() => navigate(`/projects/${projectId}/chat`)} 
                title="Expand to Full View" 
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Maximize2 className="size-3.5" />
              </button>
              <button 
                type="button"
                onClick={() => setIsOpen(false)} 
                title="Minimize" 
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Quick Prompts Carousel if conversation just started */}
          {messages.length <= 1 && (
            <div className="p-3 bg-slate-50 border-b border-slate-100 flex gap-1.5 overflow-x-auto text-[11px]">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 text-slate-600 transition-all font-medium shrink-0 cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Messages Container */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[88%] p-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    msg.type === 'user' 
                      ? 'bg-slate-900 text-white rounded-br-2xs shadow-2xs font-normal' 
                      : 'bg-white text-slate-800 border border-slate-200/90 shadow-2xs rounded-bl-2xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Task Confirmation Quick Action Card */}
                  {msg.suggested_task && msg.suggested_task.status === 'pending' && idx === messages.length - 1 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                      <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100 text-slate-700 text-xs">
                        <span className="font-semibold text-indigo-900">Task Proposal: </span>
                        <span>{msg.suggested_task.title}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSend("Yes, create it")}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle className="size-3" />
                          <span>Approve & Create</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSend("Cancel")}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}



                  {/* Grounded Source Citations */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400 space-y-0.5">
                      <span className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Grounded Sources:</span>
                      {msg.sources.map((src, i) => (
                        <div key={i} className="flex items-center gap-1 text-slate-600 truncate">
                          <FileText className="size-3 text-slate-400 shrink-0" />
                          <span className="truncate">{src.file_name || src.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-2xs p-3 text-xs text-slate-500 shadow-2xs flex items-center gap-2">
                  <RefreshCw className="size-3.5 animate-spin text-indigo-600" />
                  <span>Synthesizing answer from project knowledge...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-slate-100">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }} 
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AI or type a task request..."
                className="flex-1 bg-slate-100/80 border-none rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:ring-1 focus:ring-slate-900 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="size-9 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 disabled:opacity-40 transition-colors shadow-2xs cursor-pointer"
              >
                <Send className="size-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
