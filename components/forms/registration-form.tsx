'use client';

import React from "react"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Upload } from 'lucide-react';

interface RegistrationFormProps {
  onRegistrationSubmit: () => void;
  onSwitchToLogin: () => void;
  onBack: () => void;
}

interface FileUpload {
  name: string;
  file: File | null;
}

export default function RegistrationForm({
  onRegistrationSubmit,
  onSwitchToLogin,
  onBack,
}: RegistrationFormProps) {
  const [fullName, setFullName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [taxPassword, setTaxPassword] = useState('');
  const [files, setFiles] = useState<FileUpload[]>([
    { name: 'License', file: null },
    { name: 'License Registration', file: null },
    { name: 'VAT Certificate', file: null },
    { name: 'TIN Certificate', file: null },
  ]);
  const [error, setError] = useState('');

  const handleFileUpload = (index: number, file: File | null) => {
    const newFiles = [...files];
    newFiles[index].file = file;
    setFiles(newFiles);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName || !companyAddress || !taxPassword) {
      setError('Please fill in all required fields');
      return;
    }

    const uploadedFiles = files.filter((f) => f.file !== null);
    if (uploadedFiles.length === 0) {
      setError('Please upload at least one document');
      return;
    }

    onRegistrationSubmit();
  };

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="max-w-2xl mx-auto px-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="bg-card border border-border rounded-lg p-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Create New Account
          </h1>
          <p className="text-muted-foreground mb-8">
            Register your company to start reporting taxes
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Basic Information Section */}
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground border-b border-border pb-4">
                Company Information
              </h2>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Full Name / Company Name *
                </label>
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter full name or company name"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Company Address *
                </label>
                <Input
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="Enter company address"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tax Password *
                </label>
                <Input
                  type="password"
                  value={taxPassword}
                  onChange={(e) => setTaxPassword(e.target.value)}
                  placeholder="Create a secure tax password"
                  className="w-full"
                />
              </div>
            </div>

            {/* Document Upload Section */}
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground border-b border-border pb-4">
                Required Documents
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {files.map((fileObj, index) => (
                  <div
                    key={index}
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-secondary transition-colors"
                  >
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                    <label className="block">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) =>
                          handleFileUpload(index, e.target.files?.[0] || null)
                        }
                        className="hidden"
                      />
                      <span className="text-sm font-medium text-foreground cursor-pointer hover:text-primary">
                        {fileObj.file
                          ? fileObj.file.name
                          : `Upload ${fileObj.name}`}
                      </span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-2">
                      PDF files only
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full py-3">
              Submit Registration
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Already have an account?
            </p>
            <Button
              onClick={onSwitchToLogin}
              variant="outline"
              className="w-full bg-transparent"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
