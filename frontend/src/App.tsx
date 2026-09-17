import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { GovernmentBar } from './components/layout/GovernmentBar';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { MobileDrawer } from './components/layout/MobileDrawer';
import { AccessibilityModal } from './components/layout/AccessibilityModal';
import { FloatingControls } from './components/layout/FloatingControls';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { ApplicationAssistant } from './components/common/ApplicationAssistant';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Pages
import { HomePage } from './pages/HomePage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { GrievancesPage } from './pages/GrievancesPage';
import { HelpPage } from './pages/HelpPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { AdminPortalPage } from './pages/AdminPortalPage';
import { EmploymentPage } from './pages/EmploymentPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { EmploymentApplyPage } from './pages/EmploymentApplyPage';
import { EmploymentApplicationsPage } from './pages/EmploymentApplicationsPage';
import { EmploymentTrackingPage } from './pages/EmploymentTrackingPage';
import { EmploymentSuccessPage } from './pages/EmploymentSuccessPage';
import { ProfilePage } from './pages/ProfilePage';
import { CitizenDataPassportPage } from './pages/CitizenDataPassportPage';

const AppLayout: React.FC = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-gov-blue selection:text-white">
      {/* Accessibility Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-gov-blue focus:text-white focus:rounded-lg focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        Skip to main content
      </a>

      {/* 1. Official Government Strip */}
      <GovernmentBar onOpenAccessibilityModal={() => setIsAccessibilityOpen(true)} />

      {/* 2. Main Portal Header & Navigation */}
      <Header
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
      />

      {/* 3. Main Route Body */}
      <main id="main-content" className="flex-1">
        <Routes>
          {/* Public Core Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/departments" element={<ProtectedRoute><DepartmentsPage /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
          <Route path="/grievances" element={<ProtectedRoute><GrievancesPage /></ProtectedRoute>} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Citizen & Officer Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="/employment" element={<ProtectedRoute><EmploymentPage /></ProtectedRoute>} />
          <Route path="/employment/jobs/:jobId" element={<ProtectedRoute><JobDetailPage /></ProtectedRoute>} />
          <Route path="/employment/jobs/:jobId/apply" element={<ProtectedRoute><EmploymentApplyPage /></ProtectedRoute>} />
          <Route path="/employment/applications" element={<ProtectedRoute><EmploymentApplicationsPage /></ProtectedRoute>} />
          <Route path="/employment/applications/:id" element={<ProtectedRoute><EmploymentTrackingPage /></ProtectedRoute>} />
          <Route path="/employment/applications/:id/success" element={<ProtectedRoute><EmploymentSuccessPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/citizen-passport" element={<ProtectedRoute><CitizenDataPassportPage /></ProtectedRoute>} />
          <Route path="/track-applications" element={<ProtectedRoute><Navigate to="/employment/applications" replace /></ProtectedRoute>} />
          <Route
            path="/applications"
            element={
              <ProtectedRoute>
                <ApplicationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications/:id"
            element={
              <ProtectedRoute>
                <ApplicationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin', 'department_officer']}>
                <AdminPortalPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* 4. Footer */}
      <Footer onOpenAccessibilityModal={() => setIsAccessibilityOpen(true)} />

      {/* 5. Floating Controls (Accessibility & Back-to-Top) */}
      <FloatingControls onOpenAccessibilityModal={() => setIsAccessibilityOpen(true)} />
      <ApplicationAssistant />

      {/* Modals and Drawers */}
      <MobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onOpenAccessibilityModal={() => {
          setIsMobileMenuOpen(false);
          setIsAccessibilityOpen(true);
        }}
      />

      <AccessibilityModal
        isOpen={isAccessibilityOpen}
        onClose={() => setIsAccessibilityOpen(false)}
      />

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AccessibilityProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppLayout />
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </AccessibilityProvider>
  );
};

export default App;
