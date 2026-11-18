'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Upload, CheckCircle2, X, Building2, FileText, AlertCircle, Loader2 } from 'lucide-react';

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
  const [step, setStep] = useState<1 | 2>(1);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
    const data = new FormData();
    data.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: data });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'File upload failed');
    return json.url;
  };

  const handleNextStep = () => {
    setError('');
    const { fullName, companyAddress, tinNumber, phone, email, password, confirmPassword } = formData;

    if (!fullName || !companyAddress || !tinNumber || !phone || !email || !password || !confirmPassword) {
      setError('Please fill in all company information fields');
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

    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const missing = files.find((f) => f.file === null);
    if (missing) {
      setError(`Please upload your ${missing.label}`);
      return;
    }

    setLoading(true);
    try {
      const uploadedFileUrls: Record<string, string> = {};
      for (const f of files) {
        if (f.file) {
          uploadedFileUrls[f.field] = await uploadFileToServer(f.file);
        }
      }

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          files: uploadedFileUrls,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Registration failed');

      onRegistrationSubmit();
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 py-12 flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-lg">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </button>

        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-3 pb-6">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={step === 1 ? 'default' : 'secondary'} className="text-[11px] h-5">
                  Step 1: Info
                </Badge>
                <Badge variant={step === 2 ? 'default' : 'secondary'} className="text-[11px] h-5">
                  Step 2: Documents
                </Badge>
              </div>
            </div>

            <div>
              <CardTitle className="text-xl font-bold tracking-tight">Register Company</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Onboard your Ethiopian company for compliance, OCR receipts & payroll
              </CardDescription>
            </div>
          </CardHeader>

          <form onSubmit={step === 1 ? (e) => { e.preventDefault(); handleNextStep(); } : handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {step === 1 ? (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <Label htmlFor="fullName" className="text-xs">Company Full Legal Name</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => updateField('fullName', e.target.value)}
                      placeholder="e.g. Amis Trading PLC"
                      className="h-9 text-xs"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="tinNumber" className="text-xs">TIN (10-digits)</Label>
                      <Input
                        id="tinNumber"
                        value={formData.tinNumber}
                        onChange={(e) => updateField('tinNumber', e.target.value)}
                        placeholder="0012345678"
                        className="h-9 text-xs font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="phone" className="text-xs">Company Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        placeholder="+251 911 234567"
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="companyAddress" className="text-xs">Registered Business Address</Label>
                    <Input
                      id="companyAddress"
                      value={formData.companyAddress}
                      onChange={(e) => updateField('companyAddress', e.target.value)}
                      placeholder="Subcity, Woreda, Addis Ababa"
                      className="h-9 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="reg-email" className="text-xs">Official Email Address</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="contact@company.com"
                      className="h-9 text-xs"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="reg-pwd" className="text-xs">Password</Label>
                      <Input
                        id="reg-pwd"
                        type="password"
                        value={formData.password}
                        onChange={(e) => updateField('password', e.target.value)}
                        placeholder="••••••••"
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="reg-confirm" className="text-xs">Confirm Password</Label>
                      <Input
                        id="reg-confirm"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => updateField('confirmPassword', e.target.value)}
                        placeholder="••••••••"
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Upload official PDF or clear image scans of your Ethiopian commercial registration and tax certificates.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {files.map((item, index) => (
                      <div
                        key={item.field}
                        className="border border-dashed border-border rounded-xl p-3.5 bg-background flex flex-col justify-between"
                      >
                        <div>
                          <span className="text-xs font-semibold block">{item.label}</span>
                          <span className="text-[10px] text-muted-foreground block mb-2">
                            PDF, PNG or JPG (max 10MB)
                          </span>
                        </div>

                        {item.file ? (
                          <div className="flex items-center justify-between bg-muted/60 p-2 rounded-lg text-xs">
                            <span className="truncate max-w-[140px] text-[11px] font-medium">
                              {item.file.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="text-muted-foreground hover:text-destructive p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              ref={(el) => { fileInputRefs.current[index] = el; }}
                              onChange={(e) => handleFileUpload(index, e.target.files?.[0] || null)}
                              className="hidden"
                              id={`file-input-${item.field}`}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRefs.current[index]?.click()}
                              className="w-full text-xs h-8 gap-1.5 border-border"
                            >
                              <Upload className="w-3 h-3" />
                              Select File
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex items-center justify-between pt-2">
              {step === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={onSwitchToLogin}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Already registered? <span className="text-primary font-medium">Sign in</span>
                  </button>
                  <Button type="submit" size="sm" className="text-xs gap-1 h-8 shadow-xs">
                    Next: Upload Documents
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStep(1)}
                    className="text-xs h-8"
                  >
                    Back to Info
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    size="sm"
                    className="text-xs h-8 shadow-xs"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                        Submitting...
                      </>
                    ) : (
                      'Complete Registration'
                    )}
                  </Button>
                </>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
