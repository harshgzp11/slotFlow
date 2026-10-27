import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { RegisterPage } from './pages/auth/RegisterPage.jsx';
import { OnboardingPage } from './pages/auth/OnboardingPage.jsx';
import { DashboardLayout } from './components/layout/DashboardLayout.jsx';
import { DashboardOverviewPage } from './pages/dashboard/DashboardOverviewPage.jsx';
import { ServicesPage } from './pages/dashboard/ServicesPage.jsx';
import { StaffPage } from './pages/dashboard/StaffPage.jsx';
import { SettingsPage } from './pages/dashboard/SettingsPage.jsx';
import { PlaceholderPage } from './pages/dashboard/PlaceholderPage.jsx';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Protected Dashboard Routes */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardOverviewPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route
              path="bookings"
              element={
                <PlaceholderPage
                  title="Appointment Bookings"
                  subtitle="Atomic 15-minute slot reservations, conflict prevention, and calendar view"
                  milestone="Milestone 2"
                />
              }
            />
            <Route
              path="waitlist"
              element={
                <PlaceholderPage
                  title="Smart Waitlist Recovery"
                  subtitle="Cancellation outbox, candidate matching algorithm, and expiring offers"
                  milestone="Milestone 3"
                />
              }
            />
            <Route
              path="queue"
              element={
                <PlaceholderPage
                  title="Walk-in Queue Management"
                  subtitle="FIFO customer queue, status transitions, and dynamic wait-time estimation"
                  milestone="Milestone 5"
                />
              }
            />
            <Route
              path="analytics"
              element={
                <PlaceholderPage
                  title="Business Analytics & Capacity"
                  subtitle="Real utilization percentages, recovery rates, and aggregated revenue metrics"
                  milestone="Milestone 4"
                />
              }
            />
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
