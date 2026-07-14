'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import NewReportModal from '@/components/modals/new-report-modal';

interface UserDashboardProps {
  user: {
    fullName: string;
    email: string;
    companyAddress: string;
  } | null;
  onLogout: () => void;
}

interface Report {
  id: string;
  type: string;
  dateSubmitted: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

const statusColors = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
};

export default function UserDashboard({ user, onLogout }: UserDashboardProps) {
  const [reports, setReports] = useState<Report[]>([
    {
      id: '1',
      type: 'VAT Report',
      dateSubmitted: 'Jan 15, 2024',
      status: 'Pending',
    },
    {
      id: '2',
      type: 'Income Tax',
      dateSubmitted: 'Jan 10, 2024',
      status: 'Approved',
    },
    {
      id: '3',
      type: 'Withholding Tax',
      dateSubmitted: 'Jan 5, 2024',
      status: 'Pending',
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddReport = (reportData: any) => {
    const newReport: Report = {
      id: Date.now().toString(),
      type: reportData.type,
      dateSubmitted: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      status: 'Pending',
    };
    setReports([newReport, ...reports]);
    setIsModalOpen(false);
  };

  const handleDeleteReport = (id: string) => {
    setReports(reports.filter((r) => r.id !== id));
  };

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Welcome, {user?.fullName}
          </h1>
          <p className="text-muted-foreground">
            {user?.companyAddress}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Total Reports
            </h3>
            <p className="text-3xl font-bold text-primary">{reports.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Pending Approval
            </h3>
            <p className="text-3xl font-bold text-yellow-600">
              {reports.filter((r) => r.status === 'Pending').length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Approved
            </h3>
            <p className="text-3xl font-bold text-green-600">
              {reports.filter((r) => r.status === 'Approved').length}
            </p>
          </div>
        </div>

        {/* Reports Section */}
        <div className="bg-card border border-border rounded-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Report History</h2>
            <Button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Report
            </Button>
          </div>

          {/* Reports Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-4 font-semibold text-foreground">
                    Report Type
                  </th>
                  <th className="text-left py-4 px-4 font-semibold text-foreground">
                    Date Submitted
                  </th>
                  <th className="text-left py-4 px-4 font-semibold text-foreground">
                    Status
                  </th>
                  <th className="text-left py-4 px-4 font-semibold text-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className="border-b border-border hover:bg-secondary transition-colors"
                  >
                    <td className="py-4 px-4 text-foreground">{report.type}</td>
                    <td className="py-4 px-4 text-foreground">
                      {report.dateSubmitted}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          statusColors[
                            report.status as keyof typeof statusColors
                          ]
                        }`}
                      >
                        {report.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => handleDeleteReport(report.id)}
                        className="p-2 hover:bg-secondary rounded-lg transition-colors"
                        title="Delete report"
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reports.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No reports yet. Create your first report to get started.
              </p>
              <Button onClick={() => setIsModalOpen(true)}>
                Create First Report
              </Button>
            </div>
          )}
        </div>

        {/* New Report Modal */}
        <NewReportModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleAddReport}
        />
      </div>
    </div>
  );
}
