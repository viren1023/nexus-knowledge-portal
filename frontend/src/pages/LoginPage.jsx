import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const DEMO_USERS = [
    { name: 'Alice Manager', email: 'alice@company.com', role: 'manager', color: '#FF6B6B' },
    { name: 'Bob Manager', email: 'bob@company.com', role: 'manager', color: '#FF8A65' },
    { name: 'Charlie Lead', email: 'charlie@company.com', role: 'team_lead', color: '#4ECDC4' },
    { name: 'Diana Lead', email: 'diana@company.com', role: 'team_lead', color: '#45B7D1' },
    { name: 'Eve QA', email: 'eve@company.com', role: 'qa', color: '#FFD93D' },
    { name: 'Frank QA', email: 'frank@company.com', role: 'qa', color: '#FFA502' },
    { name: 'Grace Dev', email: 'grace@company.com', role: 'developer', color: '#6BCB77' },
    { name: 'Henry Dev', email: 'henry@company.com', role: 'developer', color: '#4D96FF' },
    { name: 'Ivy Dev', email: 'ivy@company.com', role: 'developer', color: '#A78BFA' },
  ];

  const handleLogin = async (email) => {
    setLoading(true);
    try {
      const response = await authService.login(email);
      
      // Store token
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data));
      
      // Redirect to dashboard
      navigate('/');
    } catch (error) {
      alert('Login failed. Please ensure the backend is running and users are seeded.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">Nexus Knowledge Portal</h1>
          <p className="text-lg text-slate-600">Select your profile to continue</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DEMO_USERS.map((user) => (
            <div
              key={user.email}
              onClick={() => !loading && handleLogin(user.email)}
              className={`bg-white rounded-xl shadow-sm border-t-4 hover:shadow-md transition-shadow cursor-pointer p-6 flex items-center space-x-4 ${loading ? 'opacity-50 pointer-events-none' : ''}`}
              style={{ borderTopColor: user.color }}
            >
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
                style={{ backgroundColor: user.color }}
              >
                {user.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">{user.name}</h3>
                <p className="text-sm text-slate-500 capitalize">{user.role.replace('_', ' ')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
