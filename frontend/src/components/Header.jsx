import React from 'react';
import { ChevronDown, LogOut, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Header({ 
  projectName, 
  subTitle, 
  backTo, 
  backLabel,
  children 
}) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const initials = (user.name || 'User')
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 sm:px-6 py-2.5 bg-white border-b border-slate-200 shadow-2xs shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {backTo && (
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer"
            title={backLabel || "Go back"}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">{backLabel || "Back"}</span>
          </button>
        )}

        <div className="min-w-0">
          <div 
            onClick={() => navigate('/')} 
            className="text-base font-bold text-slate-900 truncate cursor-pointer hover:text-indigo-600 transition-colors"
          >
            Project Knowledge
          </div>
          {(subTitle || projectName) && (
            <div className="text-xs text-slate-500 truncate">
              {subTitle || `Projects / ${projectName}`}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {children}

        <div className="group relative">
          <button 
            type="button"
            className="flex items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white font-semibold text-xs shrink-0 shadow-xs">
              {initials}
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-xs font-semibold text-slate-800 max-w-36 truncate">{user.name || 'User'}</div>
              <div className="text-[11px] text-slate-500 capitalize">{(user.role || 'developer').replace('_', ' ')}</div>
            </div>
            <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-slate-400" />
          </button>

          <div className="absolute right-0 mt-2 hidden w-56 rounded-xl border border-slate-200 bg-white shadow-lg group-focus-within:block group-hover:block z-50 animate-in fade-in duration-100">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="text-sm font-semibold text-slate-800 truncate">{user.name || 'User'}</div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
              <span className="mt-2 inline-flex rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                {(user.role || 'developer').replace('_', ' ')}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-b-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
