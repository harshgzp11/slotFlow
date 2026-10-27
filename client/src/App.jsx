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
import { BookingsPage } from './pages/dashboard/BookingsPage.jsx';
import { PlaceholderPage } from './pages/dashboard/PlaceholderPage.jsx';
import { PublicBookingPage } from './pages/public/PublicBookingPage.jsx';
import { ManageBookingPage } from './pages/public/ManageBookingPage.jsx';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Booking & Guest Management Pages */}
          <Route path="/book/:slug" element={<PublicBookingPage />} />
          <Route path="/appointments/:id/manage" element={<ManageBookingPage />} />
          <Route path="/guest/bookings/:id" element={<ManageBookingPage />} />

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
            <Route path="bookings" element={<BookingsPage />} />
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
