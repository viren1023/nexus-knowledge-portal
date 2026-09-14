import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, CornerDownLeft, Sparkles } from 'lucide-react';

export default function ChatInput({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Ask a question about this project, search code, or create tasks..." 
}) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea height based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 180);
    textarea.style.height = `${Math.max(44, newHeight)}px`;
  }, [message]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSendMessage(trimmed);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '44px';
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-3 sm:p-4 bg-white border-t border-slate-200/90 shadow-xs">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-2">
        {/* Input Wrapper */}
        <div className="relative flex items-end gap-2 bg-slate-50 border border-slate-300/80 rounded-2xl p-1.5 focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 w-full max-h-44 py-2 px-3 text-sm text-slate-800 placeholder-slate-400 bg-transparent border-none outline-none resize-none leading-relaxed disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={disabled || !message.trim()}
            className={`
              w-10 h-10 rounded-xl flex items-center justify-center shrink-0
              transition-all duration-150 cursor-pointer
              ${message.trim() && !disabled
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }
            `}
            title="Send message (Enter)"
            aria-label="Send message"
          >
            {disabled ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Footer Hints */}
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 truncate">
            <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
            <span className="truncate">Ask about code assets, documentation, or task boards</span>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 text-slate-400 shrink-0">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-600">Enter ↵</kbd>
            <span>to send</span>
          </span>
        </div>
      </form>
    </div>
  );
}
