'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  Building2,
  Receipt,
  FileBox,
  Users,
  FileText,
  Layers,
  Shield,
  PanelLeft,
  Search,
  Plus,
  ChevronRight,
  ExternalLink,
  LogOut,
  RefreshCw,
  UserPlus
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/admin-login');
      return;
    }
    setAuthorized(true);
  }, [router]);

  const handleLogout = () => {
    void fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('adminToken');
    localStorage.removeItem('admin');
    router.push('/admin-login');
  };

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-xs text-muted-foreground">
        Verifying administrator session...
      </div>
    );
  }

  const isNewCompany = pathname === '/admin/companies/new';
  const pageLabel: Record<string, string> = {
    '/admin': 'Overview',
    '/admin/companies/new': 'Onboard New Company',
    '/admin/receipts': 'Receipt Intake',
    '/admin/fileboxes': 'File Boxes',
    '/admin/payroll': 'Ethiopian Payroll',
    '/admin/agreements': 'Legal Agreements',
  };
  const currentLabel = pageLabel[pathname] || 'Overview';

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased">
      {/* 1. PERSISTENT LEFT SIDEBAR */}
      <aside
        className={`${
          sidebarOpen ? 'w-60' : 'w-16'
        } shrink-0 border-r border-sidebar-border bg-sidebar transition-all duration-200 flex flex-col justify-between z-30 sticky top-0 h-screen`}
      >
        <div>
          {/* Sidebar Header */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-sidebar-border">
            <Link href="/admin" className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-7 w-7 rounded-md bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              {sidebarOpen && (
                <div className="truncate text-left">
                  <span className="font-semibold text-xs tracking-tight text-sidebar-foreground block">
                    Amis Financial
                  </span>
                  <span className="text-[10px] text-muted-foreground block truncate">
                    Platform Admin
                  </span>
                </div>
              )}
            </Link>
          </div>

          {/* Navigation Groups */}
          <div className="p-2 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)]">
            {/* Group 1: Main Platform */}
            <div className="space-y-0.5">
              {sidebarOpen && (
                <p className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Platform
                </p>
              )}
              <Link href="/admin">
                <Button
                  variant={pathname === '/admin' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`w-full justify-start h-8 text-xs gap-2.5 px-2 ${
                    pathname === '/admin' ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  {sidebarOpen && <span>Overview</span>}
                </Button>
              </Link>

              <Link href="/admin/companies/new">
                <Button
                  variant={isNewCompany ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`w-full justify-start h-8 text-xs gap-2.5 px-2 ${
                    isNewCompany ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  {sidebarOpen && <span>Onboard Company</span>}
                </Button>
              </Link>
            </div>

            {/* Group 2: Odoo Custom Modules */}
            <div className="space-y-0.5">
              {sidebarOpen && (
                <p className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Odoo Modules
                </p>
              )}
              <Link href="/admin/receipts">
                <Button
                  variant={pathname === '/admin/receipts' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`w-full justify-start h-8 text-xs gap-2.5 px-2 ${pathname === '/admin/receipts' ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground'}`}
                >
                  <Receipt className="w-4 h-4 shrink-0" />
                  {sidebarOpen && <span>Receipt Intake</span>}
                </Button>
              </Link>

              <Link href="/admin/fileboxes">
                <Button
                  variant={pathname === '/admin/fileboxes' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`w-full justify-start h-8 text-xs gap-2.5 px-2 ${pathname === '/admin/fileboxes' ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground'}`}
                >
                  <FileBox className="w-4 h-4 shrink-0" />
                  {sidebarOpen && <span>File Boxes</span>}
                </Button>
              </Link>

              <Link href="/admin/payroll">
                <Button
                  variant={pathname === '/admin/payroll' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`w-full justify-start h-8 text-xs gap-2.5 px-2 ${pathname === '/admin/payroll' ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground'}`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  {sidebarOpen && <span>Ethiopian Payroll</span>}
                </Button>
              </Link>

              <Link href="/admin/agreements">
                <Button
                  variant={pathname === '/admin/agreements' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`w-full justify-start h-8 text-xs gap-2.5 px-2 ${pathname === '/admin/agreements' ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground'}`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  {sidebarOpen && <span>Legal Agreements</span>}
                </Button>
              </Link>

              <Link href="/admin?tab=sectors">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 text-xs gap-2.5 px-2 text-muted-foreground hover:text-foreground"
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  {sidebarOpen && <span>Business Sectors</span>}
                </Button>
              </Link>
            </div>

            {/* Group 3: System & Security */}
            <div className="space-y-0.5">
              {sidebarOpen && (
                <p className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  System
                </p>
              )}
              <Link href="/admin?tab=users">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 text-xs gap-2.5 px-2 text-muted-foreground hover:text-foreground"
                >
                  <Shield className="w-4 h-4 shrink-0" />
                  {sidebarOpen && <span>Admin Roles</span>}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar Footer User Profile */}
        <div className="p-2 border-t border-sidebar-border">
          <div className="flex items-center justify-between p-1.5 rounded-md hover:bg-sidebar-accent/50">
            <div className="flex items-center gap-2 overflow-hidden">
              <Avatar className="h-7 w-7 rounded-md">
                <AvatarFallback className="bg-muted text-foreground text-[10px] font-medium">
                  PA
                </AvatarFallback>
              </Avatar>
              {sidebarOpen && (
                <div className="truncate text-left text-xs">
                  <p className="font-medium text-foreground truncate text-[11px]">Platform Admin</p>
                  <p className="text-[10px] text-muted-foreground truncate">admin@admin.com</p>
                </div>
              )}
            </div>

            {sidebarOpen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* 2. PERSISTENT MAIN VIEWPORT (Renders any page inside container beside sidebar) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-14 border-b border-border bg-background flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            >
              <PanelLeft className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-4" />

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link href="/admin" className="hover:text-foreground">
                Admin
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="font-medium text-foreground capitalize">
                {currentLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden md:block w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search... ⌘K"
                className="h-7 pl-8 text-xs bg-muted/30 border-border"
              />
            </div>

            <Link href="/" target="_blank">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground hidden sm:flex px-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Live Site</span>
              </Button>
            </Link>

            {!isNewCompany && (
              <Link href="/admin/companies/new">
                <Button size="sm" className="h-7 text-xs gap-1.5 font-medium shadow-2xs">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Onboard Company</span>
                </Button>
              </Link>
            )}
          </div>
        </header>

        {/* Child Pages Container */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}

