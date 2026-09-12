import React from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Header({ projectName }) {
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
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 sm:px-6 py-3 bg-white border-b border-slate-200 shadow-sm">
      <div className="min-w-0">
        <div className="text-lg font-bold text-slate-900 truncate">Project Knowledge</div>
        {projectName && (
          <div className="text-xs text-slate-500 truncate">Projects / {projectName}</div>
        )}
      </div>
      
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="group relative">
          <button className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition-colors">
            <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white font-semibold text-sm shrink-0">
              {initials}
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-sm font-semibold text-slate-800 max-w-36 truncate">{user.name || 'User'}</div>
              <div className="text-xs text-slate-500 capitalize">{(user.role || 'developer').replace('_', ' ')}</div>
            </div>
            <ChevronDown className="hidden sm:block w-4 h-4 text-slate-400" />
          </button>

          <div className="absolute right-0 mt-2 hidden w-56 rounded-lg border border-slate-200 bg-white shadow-lg group-focus-within:block group-hover:block">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="text-sm font-semibold text-slate-800 truncate">{user.name || 'User'}</div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
              <span className="mt-2 inline-flex rounded bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">
                {(user.role || 'developer').replace('_', ' ')}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
