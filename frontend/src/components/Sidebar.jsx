import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Search, Kanban, FolderGit2, UploadCloud, Database } from 'lucide-react';

export default function Sidebar() {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'AI Chat', path: '/chat', icon: <MessageSquare className="w-5 h-5" /> },
    { name: 'Discovery', path: '/search', icon: <Search className="w-5 h-5" /> },
    { name: 'Task Board', path: '/tasks', icon: <Kanban className="w-5 h-5" /> },
    { name: 'Projects', path: '/projects', icon: <FolderGit2 className="w-5 h-5" /> },
    { name: 'Ingestion', path: '/upload', icon: <UploadCloud className="w-5 h-5" /> },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
      <div className="p-6 flex items-center space-x-3 border-b border-slate-800">
        <Database className="w-8 h-8 text-blue-400" />
        <h1 className="text-xl font-bold tracking-tight">Nexus Portal</h1>
      </div>
      
      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            {item.icon}
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>
      
      <div className="p-6 border-t border-slate-800">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">Discovery Insights</div>
        <div className="space-y-3">
          <div className="bg-slate-800 p-3 rounded-md border border-slate-700">
            <div className="text-xs text-slate-400">Total Indexed</div>
            <div className="text-lg font-semibold text-white mt-1">1,204 Assets</div>
          </div>
        </div>
      </div>
    </div>
  );
}
