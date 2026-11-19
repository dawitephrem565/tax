'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, ArrowRight, Upload, X, Building2, AlertCircle,
  Loader2, Plus, ChevronDown, ChevronUp, FileText, Users
} from 'lucide-react';

interface RegistrationFormProps {
  onRegistrationSubmit: () => void;
  onSwitchToLogin: () => void;
  onBack: () => void;
}

// ─── Branch Data ───────────────────────────────────────────────
const ADDIS_ABABA_BRANCHES = [
  'Head Office (Mexico Square / Ras Lulseged Street, Kirkos Sub-City)',
  'Kirkos Sub-City Branch (Behind Addis Ababa Stadium)',
  'Bole Sub-City Branch (Bole Medhanealem / Dembel area)',
  'Lideta Sub-City Branch (Lideta Sub-City Administration area)',
  'Addis Ketema & Merkato Branches (Merkato commercial area / Addis Ketema Sub-City)',
  'Medium Taxpayers Branch (City-level medium taxpayers)',
  'Nifas Silk-Lafto Sub-City Branch (Near Getu Commercial Center)',
  'Gulele Sub-City Branch (Near Gulele Sub-City Administration)',
  'Yeka Sub-City Branch (Woreda 8 / near Yeka Sub-City Administration)',
  'Kolfe Keranio Sub-City Branch (Near Kolfe Keranio Sub-City Administration)',
  'Akaki Kality Sub-City Branch (Near Akaki Kality Sub-City Administration)',
  'Lemi Kura Sub-City Branch (Lemi Kura Sub-City Administration area)',
  'Woreda Micro-Taxpayer Offices (116 woreda offices across Addis Ababa)',
];

const FEDERAL_MOR_BRANCHES = [
  'MOR Headquarters (Megenagna, Bole Sub-City)',
  'Large Taxpayers Office (LTO) – Addis Ababa',
  'East Addis Ababa Medium Taxpayers Branch',
  'West Addis Ababa Medium Taxpayers Branch',
  'East Addis Ababa Small Taxpayers Branch',
  'West Addis Ababa Small Taxpayers Branch',
  'North West Addis Ababa Small Taxpayers Branch',
  'Mesob One-Stop Service Center',
  'Investment One-Stop Registration Center',
];

// ─── License Document Slots ────────────────────────────────────
const LICENSE_DOCUMENT_SLOTS = [
  { label: 'Business License', field: 'license' },
  { label: 'License Registration', field: 'licenseRegistration' },
  { label: 'VAT Certificate', field: 'vatCertificate' },
  { label: 'TIN Certificate', field: 'tinCertificate' },
  { label: 'Neged Mezgeba (Company Registration File)', field: 'negedMezgeba' },
  { label: 'Neged Seyame (Brand Name Authorization)', field: 'negedSeyame' },
  { label: 'Home Rent Wel (Lease File)', field: 'homeRentWel' },
  { label: 'National ID of General Manager', field: 'managerNationalId' },
  { label: 'Metedadriya Denb (Location Authorization)', field: 'metedadriyaDenb' },
];

interface LicenseEntry {
  id: string;
  licenseName: string;
  licenseNumber: string;
  licenseType: string;
  files: Record<string, File | null>;
}

function createEmptyLicense(label: string): LicenseEntry {
  const files: Record<string, File | null> = {};
  for (const slot of LICENSE_DOCUMENT_SLOTS) files[slot.field] = null;
  return {
    id: `lic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    licenseName: label,
    licenseNumber: '',
    licenseType: 'Business License',
    files,
  };
}

// ─── Component ─────────────────────────────────────────────────
export default function RegistrationForm({
  onRegistrationSubmit,
  onSwitchToLogin,
  onBack,
}: RegistrationFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1 — Company Info
  const [formData, setFormData] = useState({
    fullName: '',
    companyAddress: '',
    tinNumber: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyType: '' as '' | 'PLC' | 'SOLE' | 'Share Company',
    memberCount: '',
    branchRegion: '' as '' | 'Addis Ababa' | 'Federal',
    branchOffice: '',
  });

  // Step 2 — Licenses
  const [licenses, setLicenses] = useState<LicenseEntry[]>([createEmptyLicense('Main License')]);
  const [expandedLicenseId, setExpandedLicenseId] = useState<string | null>(licenses[0].id);

  // File refs: licenseId → field → HTMLInputElement
  const fileInputRefs = useRef<Record<string, Record<string, HTMLInputElement | null>>>({});

  const updateField = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  // ─── Branch dropdown list based on region ─────────────────────
  const branchList = formData.branchRegion === 'Addis Ababa'
    ? ADDIS_ABABA_BRANCHES
    : formData.branchRegion === 'Federal'
      ? FEDERAL_MOR_BRANCHES
      : [];

  // ─── License helpers ──────────────────────────────────────────
  const handleAddLicense = () => {
    const newLic = createEmptyLicense(`License ${licenses.length + 1}`);
    setLicenses((prev) => [...prev, newLic]);
    setExpandedLicenseId(newLic.id);
  };

  const handleRemoveLicense = (id: string) => {
    if (licenses.length <= 1) return;
    setLicenses((prev) => prev.filter((l) => l.id !== id));
    if (expandedLicenseId === id) setExpandedLicenseId(licenses[0].id);
  };

  const updateLicenseField = (id: string, field: keyof LicenseEntry, value: string) => {
    setLicenses((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleLicenseFileUpload = (licId: string, field: string, file: File | null) => {
    setLicenses((prev) => prev.map((l) => {
      if (l.id !== licId) return l;
      return { ...l, files: { ...l.files, [field]: file } };
    }));
  };

  const removeLicenseFile = (licId: string, field: string) => {
    handleLicenseFileUpload(licId, field, null);
    const ref = fileInputRefs.current[licId]?.[field];
    if (ref) ref.value = '';
  };

  // ─── File upload helper ───────────────────────────────────────
  const uploadFileToServer = async (file: File): Promise<string> => {
    const data = new FormData();
    data.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: data });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'File upload failed');
    return json.url;
  };

  // ─── Step navigation ──────────────────────────────────────────
  const handleStep1Next = () => {
    setError('');
    const { fullName, companyAddress, tinNumber, phone, email, password, confirmPassword, companyType, branchRegion, branchOffice } = formData;
    if (!fullName || !companyAddress || !tinNumber || !phone || !email || !password || !confirmPassword) {
      setError('Please fill in all company information fields.');
      return;
    }
    if (!companyType) { setError('Please select a company type.'); return; }
    if (companyType === 'PLC' && !formData.memberCount) { setError('Please enter the number of members for PLC.'); return; }
    if (!branchRegion) { setError('Please select the tax revenue branch region.'); return; }
    if (!branchOffice) { setError('Please select the specific branch office.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setStep(2);
  };

  const handleStep2Next = () => {
    setError('');
    for (const lic of licenses) {
      if (!lic.licenseName.trim()) { setError(`Please provide a name for each license.`); return; }
    }
    setStep(3);
  };

  // ─── Final submit ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate required files for first license
    const mainLic = licenses[0];
    const requiredFields = ['license', 'licenseRegistration', 'vatCertificate', 'tinCertificate'];
    for (const f of requiredFields) {
      if (!mainLic.files[f]) {
        const slot = LICENSE_DOCUMENT_SLOTS.find((s) => s.field === f);
        setError(`Please upload "${slot?.label}" for the Main License.`);
        return;
      }
    }

    setLoading(true);
    try {
      // Upload all license files
      const uploadedLicenses: Array<{
        licenseName: string;
        licenseNumber: string;
        licenseType: string;
        files: Record<string, string>;
      }> = [];

      for (const lic of licenses) {
        const uploadedFiles: Record<string, string> = {};
        for (const slot of LICENSE_DOCUMENT_SLOTS) {
          const file = lic.files[slot.field];
          if (file) {
            uploadedFiles[slot.field] = await uploadFileToServer(file);
          }
        }
        uploadedLicenses.push({
          licenseName: lic.licenseName,
          licenseNumber: lic.licenseNumber,
          licenseType: lic.licenseType,
          files: uploadedFiles,
        });
      }

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          companyAddress: formData.companyAddress,
          tinNumber: formData.tinNumber,
          phone: formData.phone,
          email: formData.email,
          password: formData.password,
          companyType: formData.companyType,
          memberCount: formData.memberCount ? Number(formData.memberCount) : null,
          branchRegion: formData.branchRegion,
          branchOffice: formData.branchOffice,
          licenses: uploadedLicenses,
          // Legacy compatibility: main license files at top level
          files: uploadedLicenses[0]?.files ?? {},
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

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-muted/20 py-8 flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-2xl">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </button>

        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-3 pb-5">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1.5">
                {(['Step 1: Company Info', 'Step 2: Licenses', 'Step 3: Documents'] as const).map((label, i) => (
                  <Badge key={label} variant={step === i + 1 ? 'default' : 'secondary'} className="text-[10px] h-5 px-2">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight">Register Company</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Onboard your Ethiopian company for compliance, OCR receipts & payroll
              </CardDescription>
            </div>
          </CardHeader>

          <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); step === 1 ? handleStep1Next() : handleStep2Next(); }}>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* ── STEP 1: COMPANY INFO ── */}
              {step === 1 && (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <Label className="text-xs">Company Full Legal Name</Label>
                    <Input value={formData.fullName} onChange={(e) => updateField('fullName', e.target.value)}
                      placeholder="e.g. Amis Trading PLC" className="h-9 text-xs" required />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">TIN (10-digits)</Label>
                      <Input value={formData.tinNumber} onChange={(e) => updateField('tinNumber', e.target.value)}
                        placeholder="0012345678" className="h-9 text-xs font-mono" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Company Phone</Label>
                      <Input value={formData.phone} onChange={(e) => updateField('phone', e.target.value)}
                        placeholder="+251 911 234567" className="h-9 text-xs" required />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Registered Business Address</Label>
                    <Input value={formData.companyAddress} onChange={(e) => updateField('companyAddress', e.target.value)}
                      placeholder="Subcity, Woreda, Addis Ababa" className="h-9 text-xs" required />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Official Email Address</Label>
                    <Input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)}
                      placeholder="contact@company.com" className="h-9 text-xs" required />
                  </div>

                  {/* Company Type */}
                  <div className="space-y-1">
                    <Label className="text-xs">Company Type</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['PLC', 'SOLE', 'Share Company'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => updateField('companyType', type)}
                          className={`h-9 rounded-md border text-xs font-medium transition-colors ${
                            formData.companyType === type
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {formData.companyType === 'PLC' && (
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Number of PLC Members
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.memberCount}
                        onChange={(e) => updateField('memberCount', e.target.value)}
                        placeholder="e.g. 3"
                        className="h-9 text-xs"
                      />
                    </div>
                  )}

                  {/* Branch / Gebiyon Selection */}
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/20">
                    <Label className="text-xs font-semibold">Tax Revenue Branch (Gebiyon)</Label>
                    <p className="text-[11px] text-muted-foreground">Select the revenue bureau where your company applies for tax registration.</p>

                    <div className="grid grid-cols-2 gap-2">
                      {(['Addis Ababa', 'Federal'] as const).map((region) => (
                        <button
                          key={region}
                          type="button"
                          onClick={() => { updateField('branchRegion', region); updateField('branchOffice', ''); }}
                          className={`h-9 rounded-md border text-xs font-medium transition-colors ${
                            formData.branchRegion === region
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {region === 'Addis Ababa' ? 'Addis Ababa Revenue Bureau (AARB)' : 'Federal Ministry of Revenue (MOR)'}
                        </button>
                      ))}
                    </div>

                    {formData.branchRegion && (
                      <div className="space-y-1 mt-1">
                        <Label className="text-xs">Select Specific Branch</Label>
                        <select
                          value={formData.branchOffice}
                          onChange={(e) => updateField('branchOffice', e.target.value)}
                          className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">— Choose branch —</option>
                          {branchList.map((branch) => (
                            <option key={branch} value={branch}>{branch}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Password</Label>
                      <Input type="password" value={formData.password} onChange={(e) => updateField('password', e.target.value)}
                        placeholder="••••••••" className="h-9 text-xs" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Confirm Password</Label>
                      <Input type="password" value={formData.confirmPassword} onChange={(e) => updateField('confirmPassword', e.target.value)}
                        placeholder="••••••••" className="h-9 text-xs" required />
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 2: LICENSES ── */}
              {step === 2 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Your company can have multiple licenses (e.g. main trading license + import license). Add all licenses that apply.
                  </p>

                  {licenses.map((lic, idx) => (
                    <div key={lic.id} className="border border-border rounded-xl overflow-hidden">
                      {/* License Header */}
                      <div
                        className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer"
                        onClick={() => setExpandedLicenseId(expandedLicenseId === lic.id ? null : lic.id)}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs font-semibold">
                            {lic.licenseName || `License ${idx + 1}`}
                          </span>
                          {idx === 0 && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Main</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {licenses.length > 1 && idx > 0 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRemoveLicense(lic.id); }}
                              className="text-muted-foreground hover:text-destructive p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {expandedLicenseId === lic.id
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          }
                        </div>
                      </div>

                      {/* License Body */}
                      {expandedLicenseId === lic.id && (
                        <div className="p-3 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">License Name / Trade Name</Label>
                              <Input
                                value={lic.licenseName}
                                onChange={(e) => updateLicenseField(lic.id, 'licenseName', e.target.value)}
                                placeholder="e.g. Main Trading License"
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">License Number</Label>
                              <Input
                                value={lic.licenseNumber}
                                onChange={(e) => updateLicenseField(lic.id, 'licenseNumber', e.target.value)}
                                placeholder="e.g. LIC-2024-00123"
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">License Type</Label>
                            <select
                              value={lic.licenseType}
                              onChange={(e) => updateLicenseField(lic.id, 'licenseType', e.target.value)}
                              className="w-full h-8 rounded-md border border-border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              <option>Business License</option>
                              <option>Import License</option>
                              <option>Export License</option>
                              <option>Service License</option>
                              <option>Construction License</option>
                              <option>Manufacturing License</option>
                              <option>Other</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddLicense}
                    className="w-full h-9 text-xs gap-1.5 border-dashed"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Another License
                  </Button>
                </div>
              )}

              {/* ── STEP 3: DOCUMENTS ── */}
              {step === 3 && (
                <div className="space-y-5">
                  <p className="text-xs text-muted-foreground">
                    Upload official PDF or clear image scans. Fields marked with * are required for the Main License.
                  </p>

                  {licenses.map((lic, licIdx) => (
                    <div key={lic.id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <h4 className="text-xs font-semibold">
                          {lic.licenseName || `License ${licIdx + 1}`}
                          {licIdx === 0 && <span className="text-muted-foreground font-normal ml-1">(Main)</span>}
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {LICENSE_DOCUMENT_SLOTS.map((slot) => {
                          const file = lic.files[slot.field];
                          const isRequired = licIdx === 0 && ['license', 'licenseRegistration', 'vatCertificate', 'tinCertificate'].includes(slot.field);

                          if (!fileInputRefs.current[lic.id]) fileInputRefs.current[lic.id] = {};

                          return (
                            <div
                              key={slot.field}
                              className={`border border-dashed rounded-xl p-3 bg-background flex flex-col justify-between gap-2 ${
                                isRequired && !file ? 'border-amber-400/60' : 'border-border'
                              }`}
                            >
                              <div>
                                <span className="text-xs font-semibold block leading-tight">
                                  {slot.label}
                                  {isRequired && <span className="text-amber-500 ml-0.5">*</span>}
                                </span>
                                <span className="text-[10px] text-muted-foreground block">PDF, PNG or JPG (max 10MB)</span>
                              </div>

                              {file ? (
                                <div className="flex items-center justify-between bg-muted/60 p-1.5 rounded-lg text-xs">
                                  <span className="truncate max-w-[130px] text-[11px] font-medium">{file.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeLicenseFile(lic.id, slot.field)}
                                    className="text-muted-foreground hover:text-destructive p-0.5 ml-1 shrink-0"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    ref={(el) => { fileInputRefs.current[lic.id][slot.field] = el; }}
                                    onChange={(e) => handleLicenseFileUpload(lic.id, slot.field, e.target.files?.[0] || null)}
                                    className="hidden"
                                    id={`file-${lic.id}-${slot.field}`}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRefs.current[lic.id]?.[slot.field]?.click()}
                                    className="w-full text-xs h-7 gap-1 border-border"
                                  >
                                    <Upload className="w-3 h-3" />
                                    Select File
                                  </Button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {licIdx < licenses.length - 1 && (
                        <div className="border-b border-border/60 my-2" />
                      )}
                    </div>
                  ))}
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
                    Next: Licenses
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : step === 2 ? (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => setStep(1)} className="text-xs h-8">
                    Back
                  </Button>
                  <Button type="submit" size="sm" className="text-xs gap-1 h-8 shadow-xs">
                    Next: Upload Documents
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => setStep(2)} className="text-xs h-8">
                    Back
                  </Button>
                  <Button type="submit" disabled={loading} size="sm" className="text-xs h-8 shadow-xs">
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
