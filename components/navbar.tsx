'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';
import { Shield } from 'lucide-react';
import Link from 'next/link';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: any) => void;
  isLoggedIn: boolean;
  onLogout: () => void;
}

export default function Navbar({
  currentPage,
  onNavigate,
  isLoggedIn,
  onLogout,
}: NavbarProps) {
  const { language, t, toggleLanguage } = useLanguage();
  
  const navItems = [
    { label: t('findInformation'), page: 'findInfo' },
    { label: t('reportTax'), page: 'reportTax' },
    { label: t('news'), page: 'news' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Image
            src="/logo.png"
            alt="Amis Financial"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
            Amis Financial
          </h1>
          <div className="hidden md:flex gap-1 ml-6">
            {navItems.map((item) => (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === item.page
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin-login"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 transition-all"
          >
            <Shield className="w-3.5 h-3.5" />
            Admin
          </Link>

          <button
            onClick={toggleLanguage}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            {language === 'en' ? 'አማርኛ' : 'EN'}
          </button>
          
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => onNavigate('dashboard')}
                variant="ghost"
                className="text-sm"
              >
                Dashboard
              </Button>
              <Button
                onClick={onLogout}
                variant="outline"
                className="text-sm border-slate-300 dark:border-slate-600"
              >
                {t('logout')}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => onNavigate('reportTax')}
              className="text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
            >
              {t('login')}
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
