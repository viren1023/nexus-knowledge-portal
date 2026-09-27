import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatService } from '../services/api';

export default function ProjectChat({ projectId }) {
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
      setMessages([{ type: 'assistant', content: "Hello! Ask me anything about this project's documentation, tasks, or code assets." }]);
    }
  };

  useEffect(() => {
    const openChat = () => handleOpen();
    window.addEventListener('open-project-chat', openChat);
    return () => window.removeEventListener('open-project-chat', openChat);
  }, [projectId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { type: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    let activeSessionId = sessionId;
    try {
      if (!activeSessionId) {
        const res = await chatService.startSession(projectId);
        activeSessionId = res.data.session_id;
        setSessionId(activeSessionId);
      }

      const res = await chatService.sendMessage(projectId, {
        session_id: activeSessionId,
        message: userMessage.content,
        previous_context: true
      });
      
      const assistantMessage = { 
        type: 'assistant', 
        content: res.data.response,
        sources: res.data.sources,
        suggested_task: res.data.suggested_task,
        follow_ups: res.data.follow_up_suggestions,
        intent: res.data.intent
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Failed to send message', err);
      setMessages(prev => [...prev, { type: 'assistant', content: 'Sorry, I encountered an error while processing your request.' }]);
    } finally {
      setLoading(false);
    }
  };

  const sendQuickResponse = async (text) => {
    if (loading || !sessionId) return;
    const userMessage = { type: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await chatService.sendMessage(projectId, {
        session_id: sessionId,
        message: text,
        previous_context: true
      });
      
      const assistantMessage = { 
        type: 'assistant', 
        content: res.data.response,
        sources: res.data.sources,
        suggested_task: res.data.suggested_task,
        follow_ups: res.data.follow_up_suggestions,
        intent: res.data.intent
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Failed to send quick response', err);
      setMessages(prev => [...prev, { type: 'assistant', content: 'Sorry, I encountered an error while processing your request.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 bg-indigo-600 hover:bg-indigo-700 text-white w-14 h-14 rounded-full shadow-xl flex justify-center items-center transition-transform hover:scale-105 z-40"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 h-[520px] max-h-[calc(100vh-2rem)] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
            <div>
              <h3 className="font-bold">Project Assistant</h3>
              <p className="text-indigo-100 text-xs">Knowledge & Tasks</p>
            </div>
            <div className="flex items-center gap-1">
              <button 
                type="button"
                onClick={() => navigate(`/projects/${projectId}/chat`)} 
                title="Expand to Full Screen Chat" 
                className="text-indigo-200 hover:text-white p-1 rounded-md hover:bg-indigo-700/50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
              <button 
                type="button"
                onClick={() => setIsOpen(false)} 
                className="text-indigo-200 hover:text-white p-1 rounded-md hover:bg-indigo-700/50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.type === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 shadow-sm rounded-bl-none'}`}>
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  
                  {/* Task Confirmation Quick Actions */}
                  {msg.suggested_task && msg.suggested_task.status === 'pending' && idx === messages.length - 1 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => sendQuickResponse("Yes, create it")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                      >
                        ✅ Yes, Create Task
                      </button>
                      <button
                        type="button"
                        onClick={() => sendQuickResponse("Cancel")}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        ❌ Cancel
                      </button>
                    </div>
                  )}



                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500 space-y-1">
                      <p className="font-semibold text-slate-600">Sources:</p>
                      {msg.sources.map((src, i) => (
                        <div key={i} className="truncate">📄 {src.file_name || src.title}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white text-slate-800 border border-slate-200 shadow-sm rounded-2xl rounded-bl-none p-3 text-sm flex gap-1 items-center">
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-100">
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask or create a task..."
                className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-indigo-600 text-white rounded-full p-2 w-10 h-10 flex justify-center items-center disabled:opacity-50 hover:bg-indigo-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
