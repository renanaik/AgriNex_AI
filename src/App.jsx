import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import Dashboard from './pages/Dashboard';
import SoilTestForm from './pages/SoilTestForm';
import FarmForm from './pages/FarmForm';
import MyFarms from './pages/MyFarms';
import SoilImageUpload from './pages/SoilImageUpload';
import SoilHistory from './pages/SoilHistory';
import AnalyzeSoil from './pages/AnalyzeSoil';
import Reports from './pages/Reports';
import SoilReportDetail from './pages/SoilReportDetail';
import CropAdvisory from './pages/CropAdvisory';
import ProfileSettings from './pages/ProfileSettings';

import './App.css';

function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <TopHeader onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Protected App Routes with Sidebar Layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analyze"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AnalyzeSoil />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/soil-test"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SoilTestForm />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/farms"
        element={
          <ProtectedRoute>
            <AppLayout>
              <MyFarms />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/farms/new"
        element={
          <ProtectedRoute>
            <AppLayout>
              <FarmForm />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/farms/:id/edit"
        element={
          <ProtectedRoute>
            <AppLayout>
              <FarmForm />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SoilHistory />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/upload"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SoilImageUpload />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/crop-advisory"
        element={
          <ProtectedRoute>
            <AppLayout>
              <CropAdvisory />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Reports />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SoilReportDetail />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProfileSettings />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
