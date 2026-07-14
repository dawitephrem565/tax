'use client';

import { useState } from 'react';
import Navbar from '@/components/navbar';
import HomePage from '@/components/pages/home-page';
import FindInformationWizard from '@/components/pages/find-information-wizard';
import ReportTaxPage from '@/components/pages/report-tax-page';
import UserDashboard from '@/components/pages/user-dashboard';
import NewsPage from '@/components/pages/news-page';
import AdminDashboard from '@/components/pages/admin-dashboard';

type Page = 'home' | 'findInfo' | 'reportTax' | 'news' | 'dashboard' | 'admin';
type AuthState = 'loggedOut' | 'login' | 'register' | 'pending' | 'loggedIn';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [authState, setAuthState] = useState<AuthState>('loggedOut');
  const [userData, setUserData] = useState<{
    fullName: string;
    email: string;
    companyAddress: string;
  } | null>(null);

  const handleNavigation = (page: Page) => {
    if (page === 'reportTax' && authState === 'loggedOut') {
      setCurrentPage(page);
    } else {
      setCurrentPage(page);
    }
  };

  const handleLoginSuccess = (user: { fullName: string; email: string; companyAddress: string }) => {
    setUserData(user);
    setAuthState('loggedIn');
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setAuthState('loggedOut');
    setUserData(null);
    setCurrentPage('home');
  };

  const handleAdminClick = () => {
    setCurrentPage('admin');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigation}
        isLoggedIn={authState === 'loggedIn'}
        onLogout={handleLogout}
        onAdminClick={handleAdminClick}
      />
      <main className="pt-16">
        {currentPage === 'home' && <HomePage onNavigate={handleNavigation} />}
        {currentPage === 'findInfo' && (
          <FindInformationWizard onBack={() => setCurrentPage('home')} />
        )}
        {currentPage === 'reportTax' && (
          <ReportTaxPage
            authState={authState}
            setAuthState={setAuthState}
            onLoginSuccess={handleLoginSuccess}
            onBack={() => setCurrentPage('home')}
          />
        )}
        {currentPage === 'news' && <NewsPage onBack={() => setCurrentPage('home')} />}
        {currentPage === 'dashboard' && (
          <UserDashboard user={userData} onLogout={handleLogout} />
        )}
        {currentPage === 'admin' && (
          <AdminDashboard onBack={() => setCurrentPage('dashboard')} />
        )}
      </main>
    </div>
  );
}
