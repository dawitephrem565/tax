'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Clock, CheckCircle, XCircle, Building2, LogOut } from 'lucide-react';
import Link from 'next/link';

interface UserDashboardProps {
  user: {
    id: string;
    fullName: string;
    email: string;
    companyAddress: string;
    tinNumber: string;
  } | null;
  onLogout: () => void;
}

interface Report {
  _id: string;
  reportType: string;
  createdAt: string;
  status: string;
}

export default function UserDashboard({ user, onLogout }: UserDashboardProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports);
      }
    } catch (err) {
      console.error('Failed to fetch reports', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: reports.length,
    pending: reports.filter((r) => r.status === 'Pending').length,
    approved: reports.filter((r) => r.status === 'Approved').length,
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Building2 className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">
                Welcome, {user.fullName}
              </h1>
            </div>
            <p className="text-slate-500 ml-9">{user.companyAddress}</p>
            <p className="text-slate-400 text-sm ml-9">TIN: {user.tinNumber}</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={onLogout}
              variant="outline"
              className="rounded-xl border-slate-300 text-slate-600"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {[
            { label: 'Total Reports', value: stats.total, icon: FileText, color: 'blue' },
            { label: 'Pending Approval', value: stats.pending, icon: Clock, color: 'amber' },
            { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'green' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-${stat.color}-100 flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Report History</h2>
            <Link href="/report-tax">
              <Button className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm text-sm">
                <Plus className="w-4 h-4 mr-1.5" />
                New Report
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4">No reports yet</p>
              <Link href="/report-tax">
                <Button className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create First Report
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-4 px-5 text-sm font-semibold text-slate-600">Report Type</th>
                    <th className="text-left py-4 px-5 text-sm font-semibold text-slate-600">Date Submitted</th>
                    <th className="text-left py-4 px-5 text-sm font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr
                      key={report._id}
                      className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="py-4 px-5 text-slate-900 font-medium">{report.reportType}</td>
                      <td className="py-4 px-5 text-slate-500">
                        {new Date(report.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-4 px-5">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                            report.status === 'Approved'
                              ? 'bg-green-100 text-green-700'
                              : report.status === 'Rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {report.status === 'Approved' && <CheckCircle className="w-3 h-3" />}
                          {report.status === 'Rejected' && <XCircle className="w-3 h-3" />}
                          {report.status === 'Pending' && <Clock className="w-3 h-3" />}
                          {report.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
