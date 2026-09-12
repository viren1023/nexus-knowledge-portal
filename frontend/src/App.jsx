import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ProjectDetails from './pages/ProjectDetails';
import AssetViewerPage from './pages/AssetViewerPage';

// Simple Auth Guard
const RequireAuth = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route 
        path="/" 
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        } 
      />
      <Route 
        path="/projects/:id" 
        element={
          <RequireAuth>
            <ProjectDetails />
          </RequireAuth>
        } 
      />
      <Route 
        path="/projects/:id/assets/:assetId" 
        element={
          <RequireAuth>
            <AssetViewerPage />
          </RequireAuth>
        } 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
