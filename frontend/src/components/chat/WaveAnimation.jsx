import React from 'react';

export default function WaveAnimation({ label = 'Generating...' }) {
  return (
    <div 
      className="inline-flex items-center gap-2 text-indigo-600 select-none py-0.5" 
      aria-label="AI actively generating"
      role="status"
    >
      <div className="flex items-end gap-1 h-3.5 px-0.5" aria-hidden="true">
        <span 
          className="w-1 bg-indigo-500 rounded-full animate-wave-bar h-3.5" 
          style={{ animationDelay: '0ms' }} 
        />
        <span 
          className="w-1 bg-indigo-500 rounded-full animate-wave-bar h-3.5" 
          style={{ animationDelay: '150ms' }} 
        />
        <span 
          className="w-1 bg-indigo-500 rounded-full animate-wave-bar h-3.5" 
          style={{ animationDelay: '300ms' }} 
        />
        <span 
          className="w-1 bg-indigo-500 rounded-full animate-wave-bar h-3.5" 
          style={{ animationDelay: '450ms' }} 
        />
      </div>
      <span className="text-xs font-medium text-slate-500 tracking-wide">
        {label}
      </span>
    </div>
  );
}
