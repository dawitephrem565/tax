'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/use-language';
import { Shield, Building2, Globe, LogOut, LayoutDashboard } from 'lucide-react';

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
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-90"
          >
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-2xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-foreground">
                Amis Financial
              </span>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal tracking-wide text-muted-foreground">
                ETHIOPIA
              </Badge>
            </div>
          </button>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Button
                key={item.page}
                variant={currentPage === item.page ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => onNavigate(item.page)}
                className={`text-xs h-7 px-3 ${
                  currentPage === item.page ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </Button>
            ))}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <Link href="/admin-login">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground border-border"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'አማርኛ' : 'EN'}</span>
          </Button>

          {isLoggedIn ? (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                onClick={() => onNavigate('dashboard')}
                className="h-7 text-xs gap-1.5 font-medium shadow-2xs"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Workspace
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                title={t('logout')}
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => onNavigate('reportTax')}
              className="h-7 text-xs font-medium shadow-2xs"
            >
              {t('login')}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
