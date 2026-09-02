import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SignUp from './pages/SignUp.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ConnectSourceTenant from './pages/ConnectSourceTenant.jsx';
import ConnectTargetTenant from './pages/ConnectTargetTenant.jsx';
import Packages from './pages/Packages.jsx';
import PackageDetail from './pages/PackageDetail.jsx';
import IflowDetail from './pages/IflowDetail.jsx';
import MigrationReport from './pages/MigrationReport.jsx';
// import TransformRules from './pages/TransformRules.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';
import BatchMigrationReport from './pages/BatchMigrationReport.jsx';
export default function App() {
  return (
    <Routes>
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<Login />} />

      {/* <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/connect/source" element={<ProtectedRoute><ConnectSourceTenant /></ProtectedRoute>} />
      <Route path="/connect/target" element={<ProtectedRoute><ConnectTargetTenant /></ProtectedRoute>} /> */}

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
<Route path="/connect/source" element={<ProtectedRoute><ConnectSourceTenant /></ProtectedRoute>} />
<Route path="/connect/source/:id" element={<ProtectedRoute><ConnectSourceTenant /></ProtectedRoute>} />
<Route path="/connect/target" element={<ProtectedRoute><ConnectTargetTenant /></ProtectedRoute>} />
<Route path="/connect/target/:id" element={<ProtectedRoute><ConnectTargetTenant /></ProtectedRoute>} />

      <Route path="/packages" element={<ProtectedRoute><Packages /></ProtectedRoute>} />
      <Route path="/packages/:packageId" element={<ProtectedRoute><PackageDetail /></ProtectedRoute>} />
      <Route path="/packages/:packageId/iflows/:id" element={<ProtectedRoute><IflowDetail /></ProtectedRoute>} />

      <Route path="/migrations/batch/:batchId" element={<ProtectedRoute><BatchMigrationReport /></ProtectedRoute>} />
      <Route path="/migrations/:id" element={<ProtectedRoute><MigrationReport /></ProtectedRoute>} />

      <Route path="/migrations/:id" element={<ProtectedRoute><MigrationReport /></ProtectedRoute>} />
      {/* <Route path="/transform-rules" element={<ProtectedRoute><TransformRules /></ProtectedRoute>} /> */}

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
