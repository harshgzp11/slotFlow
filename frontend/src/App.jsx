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
import { WaitlistPage } from './pages/dashboard/WaitlistPage.jsx';
import { AnalyticsPage } from './pages/dashboard/AnalyticsPage.jsx';
import { QueuePage } from './pages/dashboard/QueuePage.jsx';
import { PublicBookingPage } from './pages/public/PublicBookingPage.jsx';
import { ManageBookingPage } from './pages/public/ManageBookingPage.jsx';
import { ClaimOfferPage } from './pages/public/ClaimOfferPage.jsx';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Booking, Guest Management & Recovery Offer Pages */}
          <Route path="/book/:slug" element={<PublicBookingPage />} />
          <Route path="/appointments/:id/manage" element={<ManageBookingPage />} />
          <Route path="/guest/bookings/:id" element={<ManageBookingPage />} />
          <Route path="/offers/:id" element={<ClaimOfferPage />} />

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
            <Route path="waitlist" element={<WaitlistPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="queue" element={<QueuePage />} />
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
