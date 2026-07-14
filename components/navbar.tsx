'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: any) => void;
  isLoggedIn: boolean;
  onLogout: () => void;
  onAdminClick?: () => void;
}

export default function Navbar({
  currentPage,
  onNavigate,
  isLoggedIn,
  onLogout,
  onAdminClick,
}: NavbarProps) {
  const { language, t, toggleLanguage } = useLanguage();
  
  const navItems = [
    { label: t('findInformation'), page: 'findInfo' },
    { label: t('reportTax'), page: 'reportTax' },
    { label: t('news'), page: 'news' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Image
            src="/logo.png"
            alt="Amis Financial"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <h1 className="text-2xl font-bold text-primary">Amis Financial</h1>
          <div className="hidden md:flex gap-6">
            {navItems.map((item) => (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                className={`text-sm font-medium transition-colors ${
                  currentPage === item.page
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-foreground hover:text-primary'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleLanguage}
            className="px-3 py-1.5 rounded border border-border hover:bg-secondary text-sm font-medium transition-colors"
          >
            {language === 'en' ? 'አማርኛ' : 'EN'}
          </button>
          
          {isLoggedIn && onAdminClick && (
            <Button
              onClick={onAdminClick}
              variant="outline"
              className="text-sm bg-transparent"
            >
              {t('adminDashboard')}
            </Button>
          )}
          
          {isLoggedIn ? (
            <Button
              onClick={onLogout}
              variant="outline"
              className="text-sm bg-transparent"
            >
              {t('logout')}
            </Button>
          ) : (
            <Button
              onClick={() => onNavigate('reportTax')}
              className="text-sm"
            >
              {t('login')}
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
