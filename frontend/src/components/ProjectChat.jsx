import React, { useState, useEffect, useRef } from 'react';
import { chatService } from '../services/api';

export default function ProjectChat({ projectId }) {
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

  const handleOpen = async () => {
    setIsOpen(true);
    if (!sessionId) {
      try {
        const res = await chatService.startSession(projectId);
        setSessionId(res.data.session_id);
        setMessages([{ type: 'assistant', content: "Hello! I'm your project AI. Ask me anything about this project, its tasks, or its codebase." }]);
      } catch (err) {
        console.error('Failed to start chat session', err);
      }
    }
  };

  useEffect(() => {
    const openChat = () => handleOpen();
    window.addEventListener('open-project-chat', openChat);
    return () => window.removeEventListener('open-project-chat', openChat);
  }, [sessionId, projectId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !sessionId) return;

    const userMessage = { type: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await chatService.sendMessage(projectId, {
        session_id: sessionId,
        message: input,
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
              <h3 className="font-bold">Project AI</h3>
              <p className="text-indigo-100 text-xs">Task Assistant & Knowledge</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-indigo-200 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
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

                  {/* Follow-up Suggestions */}
                  {msg.follow_ups && msg.follow_ups.length > 0 && idx === messages.length - 1 && (!msg.suggested_task || msg.suggested_task.status !== 'pending') && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex gap-1.5 flex-wrap">
                      {msg.follow_ups.map((suggestion, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => sendQuickResponse(suggestion)}
                          className="bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-slate-200 text-slate-600 text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                        >
                          {suggestion}
                        </button>
                      ))}
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
