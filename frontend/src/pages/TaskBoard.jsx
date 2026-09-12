import React, { useState, useEffect } from 'react';
import { taskService } from '../services/api';

const COLUMNS = ['backlog', 'todo', 'in progress', 'review', 'done'];

export default function TaskBoard() {
  const [tasks, setTasks] = useState([]);
  
  useEffect(() => {
    // In a real implementation we would fetch these from /api/tasks
    // For POC we initialize with empty or mock data
    setTasks([]);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Task Board</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium">
          + New Task
        </button>
      </div>
      
      <div className="flex-1 flex space-x-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <div key={col} className="w-80 flex-shrink-0 flex flex-col bg-gray-100 rounded-lg border border-gray-200 h-full max-h-full overflow-hidden">
            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
              <h3 className="font-semibold text-gray-700 capitalize">{col}</h3>
              <span className="bg-gray-200 text-gray-600 text-xs py-1 px-2 rounded-full font-medium">
                {tasks.filter(t => t.status === col).length}
              </span>
            </div>
            <div className="p-3 flex-1 overflow-y-auto space-y-3">
              {tasks.filter(t => t.status === col).length === 0 && (
                <div className="text-sm text-gray-400 text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
