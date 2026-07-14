'use client';

import { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type AdminTab = 'overview' | 'approvals' | 'reports' | 'users';
type ReportStatus = 'Pending' | 'In Review' | 'Completed';

interface Company {
  id: string;
  name: string;
  tin: string;
  email: string;
  submittedDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  hasLicense: boolean;
  hasVat: boolean;
  hasTin: boolean;
}

interface Report {
  id: string;
  companyName: string;
  reportType: 'VAT' | 'Withhold' | 'Business Profits Tax';
  submittedDate: string;
  status: ReportStatus;
}

interface AdminDashboardProps {
  onBack: () => void;
}

export default function AdminDashboard({ onBack }: AdminDashboardProps) {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showDocuments, setShowDocuments] = useState(false);

  // Mock data
  const companies: Company[] = [
    {
      id: '1',
      name: 'Tech Solutions Ltd',
      tin: '001234567',
      email: 'tech@company.com',
      submittedDate: '2024-01-15',
      status: 'Pending',
      hasLicense: true,
      hasVat: true,
      hasTin: true,
    },
    {
      id: '2',
      name: 'Finance Corp',
      tin: '002345678',
      email: 'finance@corp.com',
      submittedDate: '2024-01-16',
      status: 'Pending',
      hasLicense: true,
      hasVat: false,
      hasTin: true,
    },
    {
      id: '3',
      name: 'Trading House',
      tin: '003456789',
      email: 'trade@house.com',
      submittedDate: '2024-01-17',
      status: 'Approved',
      hasLicense: true,
      hasVat: true,
      hasTin: true,
    },
  ];

  const reports: Report[] = [
    {
      id: '1',
      companyName: 'Tech Solutions Ltd',
      reportType: 'VAT',
      submittedDate: '2024-01-18',
      status: 'Pending',
    },
    {
      id: '2',
      companyName: 'Finance Corp',
      reportType: 'Withhold',
      submittedDate: '2024-01-17',
      status: 'In Review',
    },
    {
      id: '3',
      companyName: 'Trading House',
      reportType: 'Business Profits Tax',
      submittedDate: '2024-01-16',
      status: 'Completed',
    },
  ];

  const filteredCompanies = companies.filter(
    (c) =>
      c.tin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalCompanies: companies.length,
    pendingApprovals: companies.filter((c) => c.status === 'Pending').length,
    newReports: reports.filter((r) => r.status === 'Pending').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'In Review':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const isAmharic = language === 'am';

  return (
    <div className={`min-h-screen bg-background pt-20 pb-8 ${isAmharic ? 'rtl' : 'ltr'}`} dir={isAmharic ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              {t('adminDashboardTitle')}
            </h1>
            <p className="text-muted-foreground">{t('overview')}</p>
          </div>
          <Button onClick={onBack} variant="outline" className="bg-transparent">
            {t('back')}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-border overflow-x-auto">
          {(['overview', 'approvals', 'reports', 'users'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'overview' && t('overview')}
              {tab === 'approvals' && t('companyApprovalQueue')}
              {tab === 'reports' && t('reportManagement')}
              {tab === 'users' && t('userSearch')}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 border border-border">
              <p className="text-muted-foreground text-sm mb-2">
                {t('totalRegisteredCompanies')}
              </p>
              <p className="text-4xl font-bold text-primary">{stats.totalCompanies}</p>
            </Card>
            <Card className="p-6 border border-border">
              <p className="text-muted-foreground text-sm mb-2">
                {t('pendingApprovals')}
              </p>
              <p className="text-4xl font-bold text-accent">{stats.pendingApprovals}</p>
            </Card>
            <Card className="p-6 border border-border">
              <p className="text-muted-foreground text-sm mb-2">
                {t('newReportsSubmitted')}
              </p>
              <p className="text-4xl font-bold text-accent">{stats.newReports}</p>
            </Card>
          </div>
        )}

        {/* Company Approval Queue Tab */}
        {activeTab === 'approvals' && (
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">
              {t('companyApprovalQueue')}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-semibold text-foreground">
                      {t('companyName')}
                    </th>
                    <th className="text-left p-4 font-semibold text-foreground">
                      {t('tinNumber')}
                    </th>
                    <th className="text-left p-4 font-semibold text-foreground">
                      {t('submittedDate')}
                    </th>
                    <th className="text-left p-4 font-semibold text-foreground">
                      {t('status')}
                    </th>
                    <th className="text-left p-4 font-semibold text-foreground">
                      {t('action')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id} className="border-b border-border hover:bg-secondary">
                      <td className="p-4 text-foreground">{company.name}</td>
                      <td className="p-4 text-foreground">{company.tin}</td>
                      <td className="p-4 text-foreground">{company.submittedDate}</td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded text-xs font-semibold ${getStatusColor(
                            company.status
                          )}`}
                        >
                          {company.status === 'Pending' && t('pending')}
                          {company.status === 'Approved' && t('approved')}
                          {company.status === 'Rejected' && t('rejected')}
                        </span>
                      </td>
                      <td className="p-4">
                        <Button
                          onClick={() => {
                            setSelectedCompany(company);
                            setShowDocuments(true);
                          }}
                          size="sm"
                          variant="outline"
                          className="bg-transparent"
                        >
                          {t('viewDocuments')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report Management Tab */}
        {activeTab === 'reports' && (
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">
              {t('reportManagement')}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-semibold text-foreground">
                      {t('companyName')}
                    </th>
                    <th className="text-left p-4 font-semibold text-foreground">
                      {t('reportType')}
                    </th>
                    <th className="text-left p-4 font-semibold text-foreground">
                      {t('submittedDate')}
                    </th>
                    <th className="text-left p-4 font-semibold text-foreground">
                      {t('status')}
                    </th>
                    <th className="text-left p-4 font-semibold text-foreground">
                      {t('action')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="border-b border-border hover:bg-secondary">
                      <td className="p-4 text-foreground">{report.companyName}</td>
                      <td className="p-4 text-foreground">{report.reportType}</td>
                      <td className="p-4 text-foreground">{report.submittedDate}</td>
                      <td className="p-4">
                        <Select defaultValue={report.status}>
                          <SelectTrigger className="w-32 bg-transparent">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">{t('pending')}</SelectItem>
                            <SelectItem value="In Review">{t('inReview')}</SelectItem>
                            <SelectItem value="Completed">{t('completed')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4">
                        <Button size="sm" className="text-sm">
                          {t('action')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* User Search Tab */}
        {activeTab === 'users' && (
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">
              {t('userSearch')}
            </h2>
            <div className="mb-6">
              <Input
                placeholder={t('searchByTinOrName')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
              />
            </div>
            {filteredCompanies.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {filteredCompanies.map((company) => (
                  <Card key={company.id} className="p-6 border border-border">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {company.name}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {t('tinNumber')}: {company.tin}
                        </p>
                        <p className="text-muted-foreground text-sm">{company.email}</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded text-xs font-semibold ${getStatusColor(
                          company.status
                        )}`}
                      >
                        {company.status === 'Pending' && t('pending')}
                        {company.status === 'Approved' && t('approved')}
                        {company.status === 'Rejected' && t('rejected')}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center border border-border">
                <p className="text-muted-foreground">{t('noResults')}</p>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Documents Modal */}
      {showDocuments && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6 border border-border">
            <h3 className="text-lg font-bold text-foreground mb-4">
              {selectedCompany.name} - {t('viewDocuments')}
            </h3>
            <div className="space-y-4 mb-6">
              <div className="p-4 bg-secondary rounded">
                <p className="text-sm font-medium text-foreground mb-2">
                  Business License
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedCompany.hasLicense ? 'Uploaded' : 'Not uploaded'}
                </p>
              </div>
              <div className="p-4 bg-secondary rounded">
                <p className="text-sm font-medium text-foreground mb-2">
                  VAT Certificate
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedCompany.hasVat ? 'Uploaded' : 'Not uploaded'}
                </p>
              </div>
              <div className="p-4 bg-secondary rounded">
                <p className="text-sm font-medium text-foreground mb-2">
                  TIN Certificate
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedCompany.hasTin ? 'Uploaded' : 'Not uploaded'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowDocuments(false);
                  setSelectedCompany(null);
                }}
                variant="outline"
                className="flex-1 bg-transparent"
              >
                Close
              </Button>
              <Button className="flex-1">{t('approve')}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
