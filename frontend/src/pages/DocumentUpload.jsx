import React, { useState } from 'react';
import { documentService } from '../services/api';
import { Upload, FileText, CheckCircle } from 'lucide-react';

export default function DocumentUpload() {
  const [file, setFile] = useState(null);
  const [roleAccess, setRoleAccess] = useState('developer');
  const [isUploading, setIsUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setSuccessMsg('');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('role_access', roleAccess);

    try {
      await documentService.upload(formData);
      setSuccessMsg('Document successfully queued for ingestion!');
      setFile(null);
    } catch (err) {
      alert('Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Ingest Knowledge</h2>
      
      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-md flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          {successMsg}
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select File (PDF, DOCX, MD, PNG)</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-500 transition-colors bg-gray-50">
            <div className="space-y-1 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                  <span>Upload a file</span>
                  <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files[0])} />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">
                {file ? file.name : "PNG, JPG, PDF up to 10MB"}
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Required Role Access</label>
          <select 
            value={roleAccess}
            onChange={(e) => setRoleAccess(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
          >
            <option value="developer">Developer</option>
            <option value="manager">Manager</option>
            <option value="qa">QA</option>
            <option value="team_lead">Team Lead</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={!file || isUploading}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${!file || isUploading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors`}
        >
          {isUploading ? 'Ingesting...' : 'Upload Document'}
        </button>
      </form>
    </div>
  );
}
