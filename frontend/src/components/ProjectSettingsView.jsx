import React, { useState } from 'react';
import { Settings, Shield, AlertTriangle, Save, Check } from 'lucide-react';
import { projectService } from '../services/api';

export default function ProjectSettingsView({ project, onProjectUpdated }) {
  const [name, setName] = useState(project.name || '');
  const [description, setDescription] = useState(project.description || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const canEdit = ['manager', 'admin'].includes(currentUser.role);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await projectService.update(project.id, { name, description });
      setSuccess(true);
      onProjectUpdated?.();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update project settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-6">
      <div className="pb-4 border-b border-slate-100">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">Project Settings & Configuration</h2>
        <p className="text-xs text-slate-500">Manage project metadata, roles, and administrative parameters</p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium flex items-center gap-2">
          <Check className="size-4" />
          <span>Project settings successfully updated.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Project Name
          </label>
          <input
            type="text"
            required
            disabled={!canEdit}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            disabled={!canEdit}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Knowledge Base Indexing Access
          </label>
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">Automatic Vector Ingestion: Active</div>
            <p className="text-slate-500 leading-relaxed">
              All documents, code files, and repos uploaded to this project are automatically chunked and indexed into the Chroma vector store for RAG chat queries.
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="size-3.5" />
              <span>{loading ? 'Saving Changes...' : 'Save Settings'}</span>
            </button>
          </div>
        )}
      </form>

      {/* Danger Zone */}
      <div className="pt-6 border-t border-slate-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 mb-2 flex items-center gap-1.5">
          <AlertTriangle className="size-3.5" />
          <span>Danger Zone</span>
        </h3>
        <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold text-rose-900">Archive or Reset Project</h4>
            <p className="text-[11px] text-rose-700 mt-0.5">
              Archiving disables task modifications while preserving all vector indices and file assets.
            </p>
          </div>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => alert("Project archiving is restricted to enterprise account owners.")}
            className="px-3.5 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors disabled:opacity-50 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            Archive Project
          </button>
        </div>
      </div>
    </div>
  );
}
