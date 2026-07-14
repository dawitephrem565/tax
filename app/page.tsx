'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/navbar';
import HomePage from '@/components/pages/home-page';
import FindInformationWizard from '@/components/pages/find-information-wizard';
import ReportTaxPage from '@/components/pages/report-tax-page';
import UserDashboard from '@/components/pages/user-dashboard';
import NewsPage from '@/components/pages/news-page';

type Page = 'home' | 'findInfo' | 'reportTax' | 'news' | 'dashboard';
type AuthState = 'loggedOut' | 'login' | 'register' | 'pending' | 'loggedIn';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [authState, setAuthState] = useState<AuthState>('loggedOut');
  const [userData, setUserData] = useState<{
    id: string;
    fullName: string;
    email: string;
    companyAddress: string;
    tinNumber: string;
  } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserData(user);
        setAuthState('loggedIn');
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleNavigation = (page: Page) => {
    setCurrentPage(page);
  };

  const handleLoginSuccess = (user: any) => {
    setUserData(user);
    setAuthState('loggedIn');
    setCurrentPage('dashboard');
  };

  const handleRegistrationSubmit = () => {
    setAuthState('pending');
    setCurrentPage('reportTax');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthState('loggedOut');
    setUserData(null);
    setCurrentPage('home');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigation}
        isLoggedIn={authState === 'loggedIn'}
        onLogout={handleLogout}
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
            onRegistrationSubmit={handleRegistrationSubmit}
            onBack={() => setCurrentPage('home')}
          />
        )}
        {currentPage === 'news' && <NewsPage onBack={() => setCurrentPage('home')} />}
        {currentPage === 'dashboard' && (
          <UserDashboard user={userData} onLogout={handleLogout} />
        )}
      </main>
    </div>
  );
}
