import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './hooks/supabaseClient';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AttendanceHistory from './pages/AttendanceHistory';
import AdminPanel from './pages/AdminPanel';
import UserManagement from './pages/UserManagement';
import SalaryPaymentManagement from './pages/SalaryPaymentManagement';
import DepartmentManagement from './pages/DepartmentManagement';
import PositionManagement from './pages/PositionManagement';
import ProfileSetup from './pages/ProfileSetup';
import LocationSettings from './pages/LocationSettings';
import BankManagement from './pages/BankManagement';
import AttendanceManagementByDate from './pages/AttendanceManagementByDate';
import { LanguageProvider } from './utils/languageContext';

function App() {
  return (
    <LanguageProvider>
      <div className="flex flex-col min-h-screen">
        <Router>
          <AppContent />
        </Router>
      </div>
    </LanguageProvider>
  );
}

import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './hooks/useAuth';

function AppContent() {
  const { session, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex space-x-1 text-tosca-600">
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-600 mt-4">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <Routes>
        <Route 
          path="/login" 
          element={!session ? <Login /> : (userRole === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />)} 
        />
        <Route 
          path="/register" 
          element={!session ? <Register /> : (userRole === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />)} 
        />
        <Route 
          path="/dashboard" 
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
        />
        <Route 
          path="/profile-setup" 
          element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>}
        />
        <Route 
          path="/history" 
          element={<ProtectedRoute><AttendanceHistory /></ProtectedRoute>}
        />
        <Route 
          path="/admin" 
          element={<ProtectedRoute adminOnly={true}><AdminPanel /></ProtectedRoute>}
        />
        <Route 
          path="/admin/users" 
          element={<ProtectedRoute adminOnly={true}><UserManagement /></ProtectedRoute>}
        />
        <Route 
          path="/admin/departments" 
          element={<ProtectedRoute adminOnly={true}><DepartmentManagement /></ProtectedRoute>}
        />
        <Route 
          path="/admin/positions" 
          element={<ProtectedRoute adminOnly={true}><PositionManagement /></ProtectedRoute>}
        />
        <Route 
          path="/admin/salary-payment" 
          element={<ProtectedRoute adminOnly={true}><SalaryPaymentManagement /></ProtectedRoute>}
        />
        <Route 
          path="/admin/location" 
          element={<ProtectedRoute adminOnly={true}><LocationSettings /></ProtectedRoute>}
        />
        <Route 
          path="/admin/bank" 
          element={<ProtectedRoute adminOnly={true}><BankManagement /></ProtectedRoute>}
        />
        <Route 
          path="/admin/attendance" 
          element={<ProtectedRoute adminOnly={true}><AttendanceManagementByDate /></ProtectedRoute>}
        />
        <Route 
          path="/" 
          element={
            !session ? <Navigate to="/login" replace /> : 
            userRole === 'admin' ? <Navigate to="/admin" replace /> : 
            <Navigate to="/dashboard" replace />
          } 
        />
        {/* Catch-all route to handle 404s */}
        <Route 
          path="*" 
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </div>
  );
}

export default App;