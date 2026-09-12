import React, { useState, useEffect } from 'react';
import { projectService } from '../services/api';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await projectService.getAll({ page: 1, page_size: 20 });
        setProjects(res.data.projects);
      } catch (error) {
        console.error(error);
      }
    };
    fetchProjects();
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium">
          Create Project
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-gray-500 bg-white border border-gray-200 rounded-lg border-dashed">
            No projects found. Create one to get started.
          </div>
        ) : (
          projects.map(p => (
            <div key={p.id} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold text-gray-800">{p.name}</h3>
              <p className="text-gray-600 text-sm mt-2 line-clamp-3">{p.description}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
