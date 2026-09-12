import React, { useState, useEffect } from 'react';
import { searchService } from '../services/api';
import { Search, FileText, Code, Folder, CheckSquare } from 'lucide-react';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;
    
    setIsLoading(true);
    try {
      const res = await searchService.search({
        query: query,
        page: 1,
        page_size: 20
      });
      setResults(res.data.results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (type) => {
    switch(type) {
      case 'document': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'asset': return <Code className="w-5 h-5 text-purple-500" />;
      case 'project': return <Folder className="w-5 h-5 text-yellow-500" />;
      case 'task': return <CheckSquare className="w-5 h-5 text-green-500" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Discovery Engine</h1>
        <form onSubmit={handleSearch} className="flex space-x-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-lg shadow-sm"
              placeholder="Search for documents, code snippets, tasks, or projects..."
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="text-center text-gray-500 py-12">Searching across knowledge base...</div>
        ) : results.length > 0 ? (
          <div className="space-y-4 pb-12">
            {results.map((result) => (
              <div key={result.id} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    {getIcon(result.type)}
                    <h3 className="text-lg font-semibold text-blue-600 hover:underline cursor-pointer">{result.title}</h3>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                    {result.type}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600 line-clamp-2">{result.snippet}</p>
                <div className="mt-3 flex items-center text-xs text-gray-500 space-x-4">
                  <span>Source: {result.source}</span>
                  <span>Relevance: {(result.relevance_score * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : query && !isLoading ? (
          <div className="text-center text-gray-500 py-12">No results found for "{query}".</div>
        ) : null}
      </div>
    </div>
  );
}
