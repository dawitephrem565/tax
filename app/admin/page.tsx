'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Shield,
  LogOut,
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  FileText,
  Users,
} from 'lucide-react';

interface Company {
  _id: string;
  fullName: string;
  companyAddress: string;
  tinNumber: string;
  phone: string;
  email: string;
  status: string;
  files: {
    license: string;
    licenseRegistration: string;
    vatCertificate: string;
    tinCertificate: string;
  };
  createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/admin-login');
      return;
    }
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/companies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setCompanies(data.companies);
    } catch (err) {
      console.error('Failed to fetch companies', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (companyId: string, action: string) => {
    setActionLoading(companyId);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyId, action }),
      });
      if (res.ok) {
        setCompanies((prev) =>
          prev.map((c) => (c._id === companyId ? { ...c, status: action } : c))
        );
        if (selectedCompany?._id === companyId) {
          setSelectedCompany((prev) => prev ? { ...prev, status: action } : null);
        }
      }
    } catch (err) {
      console.error('Approval failed', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('admin');
    router.push('/admin-login');
  };

  const filteredCompanies = companies.filter((c) => {
    const matchesSearch =
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.tinNumber.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || c.status === filter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: companies.length,
    pending: companies.filter((c) => c.status === 'pending').length,
    approved: companies.filter((c) => c.status === 'approved').length,
    rejected: companies.filter((c) => c.status === 'rejected').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-400" />
            <span className="text-white font-bold text-lg">Admin Panel</span>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="text-blue-300 hover:text-white hover:bg-white/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Companies', value: stats.total, icon: Building2, color: 'blue' },
            { label: 'Pending', value: stats.pending, icon: Clock, color: 'amber' },
            { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'green' },
            { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'red' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-200/70 text-sm">{stat.label}</p>
                  <p className="text-white text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-${stat.color}-500/10 flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 text-${stat.color}-400`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-white/10">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, TIN, or email..."
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400 text-sm"
                />
              </div>
              <div className="flex gap-2">
                {['all', 'pending', 'approved', 'rejected'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      filter === f
                        ? 'bg-blue-500 text-white'
                        : 'text-blue-300 hover:bg-white/10'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-blue-200/70 text-sm font-semibold px-5 py-4">Company</th>
                  <th className="text-left text-blue-200/70 text-sm font-semibold px-5 py-4">TIN</th>
                  <th className="text-left text-blue-200/70 text-sm font-semibold px-5 py-4">Email</th>
                  <th className="text-left text-blue-200/70 text-sm font-semibold px-5 py-4">Date</th>
                  <th className="text-left text-blue-200/70 text-sm font-semibold px-5 py-4">Status</th>
                  <th className="text-right text-blue-200/70 text-sm font-semibold px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-blue-300/50">
                      No companies found
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((company) => (
                    <tr
                      key={company._id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelectedCompany(company)}
                          className="text-white font-medium hover:text-blue-400 transition-colors"
                        >
                          {company.fullName}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-blue-200/70 text-sm">{company.tinNumber}</td>
                      <td className="px-5 py-4 text-blue-200/70 text-sm">{company.email}</td>
                      <td className="px-5 py-4 text-blue-200/70 text-sm">
                        {new Date(company.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                            company.status === 'approved'
                              ? 'bg-green-500/10 text-green-400'
                              : company.status === 'rejected'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {company.status === 'approved' && <CheckCircle className="w-3 h-3" />}
                          {company.status === 'rejected' && <XCircle className="w-3 h-3" />}
                          {company.status === 'pending' && <Clock className="w-3 h-3" />}
                          {company.status.charAt(0).toUpperCase() + company.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            onClick={() => setSelectedCompany(company)}
                            variant="ghost"
                            className="text-blue-300 hover:text-white hover:bg-white/10"
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          {company.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                disabled={actionLoading === company._id}
                                onClick={() => handleApproval(company._id, 'approved')}
                                className="bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs"
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                disabled={actionLoading === company._id}
                                onClick={() => handleApproval(company._id, 'rejected')}
                                variant="outline"
                                className="border-red-400/30 text-red-300 hover:bg-red-500/10 rounded-lg text-xs"
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedCompany && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="w-6 h-6 text-blue-400" />
                  <h2 className="text-xl font-bold text-white">{selectedCompany.fullName}</h2>
                </div>
                <button
                  onClick={() => setSelectedCompany(null)}
                  className="text-blue-300 hover:text-white transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-blue-300/70 uppercase tracking-wider">TIN Number</label>
                    <p className="text-white font-medium mt-1">{selectedCompany.tinNumber}</p>
                  </div>
                  <div>
                    <label className="text-xs text-blue-300/70 uppercase tracking-wider">Email</label>
                    <p className="text-white font-medium mt-1">{selectedCompany.email}</p>
                  </div>
                  <div>
                    <label className="text-xs text-blue-300/70 uppercase tracking-wider">Phone</label>
                    <p className="text-white font-medium mt-1">{selectedCompany.phone}</p>
                  </div>
                  <div>
                    <label className="text-xs text-blue-300/70 uppercase tracking-wider">Status</label>
                    <p className={`font-medium mt-1 ${
                      selectedCompany.status === 'approved' ? 'text-green-400' :
                      selectedCompany.status === 'rejected' ? 'text-red-400' : 'text-amber-400'
                    }`}>
                      {selectedCompany.status.charAt(0).toUpperCase() + selectedCompany.status.slice(1)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-blue-300/70 uppercase tracking-wider">Address</label>
                    <p className="text-white font-medium mt-1">{selectedCompany.companyAddress}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-blue-300/70 uppercase tracking-wider">Submitted</label>
                    <p className="text-white font-medium mt-1">
                      {new Date(selectedCompany.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Uploaded Documents</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Business License', file: selectedCompany.files?.license },
                      { label: 'License Registration', file: selectedCompany.files?.licenseRegistration },
                      { label: 'VAT Certificate', file: selectedCompany.files?.vatCertificate },
                      { label: 'TIN Certificate', file: selectedCompany.files?.tinCertificate },
                    ].map((doc) => (
                      <div key={doc.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <p className="text-blue-200/70 text-xs mb-2">{doc.label}</p>
                        {doc.file ? (
                          <a
                            href={doc.file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View Document
                          </a>
                        ) : (
                          <span className="text-red-400 text-sm">Not uploaded</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedCompany.status === 'pending' && (
                  <div className="flex gap-3 pt-4 border-t border-white/10">
                    <Button
                      disabled={actionLoading === selectedCompany._id}
                      onClick={() => handleApproval(selectedCompany._id, 'approved')}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl h-11"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Company
                    </Button>
                    <Button
                      disabled={actionLoading === selectedCompany._id}
                      onClick={() => handleApproval(selectedCompany._id, 'rejected')}
                      variant="outline"
                      className="flex-1 border-red-400/30 text-red-300 hover:bg-red-500/10 rounded-xl h-11"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
