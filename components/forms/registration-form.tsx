'use client';

import React, { useState, useRef } from "react"
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Upload, CheckCircle, X, Building2, FileText, Shield } from 'lucide-react';

interface RegistrationFormProps {
  onRegistrationSubmit: () => void;
  onSwitchToLogin: () => void;
  onBack: () => void;
}

interface FileUpload {
  label: string;
  field: string;
  file: File | null;
}

export default function RegistrationForm({
  onRegistrationSubmit,
  onSwitchToLogin,
  onBack,
}: RegistrationFormProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    companyAddress: '',
    tinNumber: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [files, setFiles] = useState<FileUpload[]>([
    { label: 'Business License', field: 'license', file: null },
    { label: 'License Registration', field: 'licenseRegistration', file: null },
    { label: 'VAT Certificate', field: 'vatCertificate', file: null },
    { label: 'TIN Certificate', field: 'tinCertificate', file: null },
  ]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (index: number, file: File | null) => {
    const newFiles = [...files];
    newFiles[index].file = file;
    setFiles(newFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles[index].file = null;
    setFiles(newFiles);
    if (fileInputRefs.current[index]) {
      fileInputRefs.current[index]!.value = '';
    }
  };

  const uploadFileToServer = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { fullName, companyAddress, tinNumber, phone, email, password, confirmPassword } = formData;

    if (!fullName || !companyAddress || !tinNumber || !phone || !email || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    const allFilesUploaded = files.every(f => f.file !== null);
    if (!allFilesUploaded) {
      setError('All 4 documents must be uploaded');
      return;
    }

    setLoading(true);

    try {
      const uploadedUrls: Record<string, string> = {};
      for (const f of files) {
        const url = await uploadFileToServer(f.file!);
        uploadedUrls[f.field] = url;
      }

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, files: uploadedUrls }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onRegistrationSubmit();
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isStep1Valid = formData.fullName && formData.companyAddress && formData.tinNumber;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 pt-20 pb-12">
      <div className="max-w-3xl mx-auto px-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-200 mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Company Registration</h1>
          <p className="text-slate-500 mt-2">Register your company for tax reporting services</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            step === 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-100 text-slate-400'
          }`}>
            <FileText className="w-4 h-4" />
            Company Info
          </div>
          <div className="w-12 h-0.5 bg-slate-200" />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            step === 2 ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-100 text-slate-400'
          }`}>
            <Shield className="w-4 h-4" />
            Documents
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
            {error && (
              <div className="mx-6 mt-6 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                <X className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.fullName}
                      onChange={(e) => updateField('fullName', e.target.value)}
                      placeholder="Enter company name"
                      className="w-full border-slate-200 focus:border-blue-400 focus:ring-blue-400 rounded-xl h-11"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      TIN Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.tinNumber}
                      onChange={(e) => updateField('tinNumber', e.target.value)}
                      placeholder="Enter TIN number"
                      className="w-full border-slate-200 focus:border-blue-400 focus:ring-blue-400 rounded-xl h-11"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="Enter email address"
                      className="w-full border-slate-200 focus:border-blue-400 focus:ring-blue-400 rounded-xl h-11"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="Enter phone number"
                      className="w-full border-slate-200 focus:border-blue-400 focus:ring-blue-400 rounded-xl h-11"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Company Address <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.companyAddress}
                      onChange={(e) => updateField('companyAddress', e.target.value)}
                      placeholder="Enter company address"
                      className="w-full border-slate-200 focus:border-blue-400 focus:ring-blue-400 rounded-xl h-11"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      placeholder="Create password"
                      className="w-full border-slate-200 focus:border-blue-400 focus:ring-blue-400 rounded-xl h-11"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => updateField('confirmPassword', e.target.value)}
                      placeholder="Confirm password"
                      className="w-full border-slate-200 focus:border-blue-400 focus:ring-blue-400 rounded-xl h-11"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="p-6">
                <p className="text-sm text-slate-500 mb-6">
                  Upload the following documents (PDF format only). All documents are required.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {files.map((fileObj, index) => (
                    <div
                      key={index}
                      className={`relative border-2 rounded-xl p-5 text-center transition-all ${
                        fileObj.file
                          ? 'border-green-300 bg-green-50/50'
                          : 'border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/30'
                      }`}
                    >
                      {fileObj.file ? (
                        <div>
                          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-green-100 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                          </div>
                          <p className="text-sm font-medium text-green-700 truncate max-w-full">
                            {fileObj.file.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="mt-2 text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 flex items-center justify-center">
                            <Upload className="w-6 h-6 text-slate-400" />
                          </div>
                          <label className="cursor-pointer">
                            <input
                              ref={(el) => { fileInputRefs.current[index] = el; }}
                              type="file"
                              accept=".pdf"
                              onChange={(e) => handleFileUpload(index, e.target.files?.[0] || null)}
                              className="hidden"
                            />
                            <span className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                              Upload {fileObj.label}
                            </span>
                          </label>
                          <p className="text-xs text-slate-400 mt-1">PDF only</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              {step === 2 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="rounded-xl border-slate-300"
                  >
                    Previous
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-200 px-8"
                  >
                    {loading ? 'Submitting...' : 'Submit Registration'}
                  </Button>
                </>
              ) : (
                <>
                  <div />
                  <Button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!isStep1Valid}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-200 px-8"
                  >
                    Next Step
                  </Button>
                </>
              )}
            </div>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-blue-600 font-semibold hover:text-blue-700 hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
