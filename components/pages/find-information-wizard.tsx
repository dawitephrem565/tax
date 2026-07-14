'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FindInformationWizardProps {
  onBack: () => void;
}

const steps = ['License Type', 'Business Type', 'Subcity Office', 'Tax Information'];

const subcityOffices = [
  'Addis Ketema',
  'Akaki Kaliti',
  'Arada',
  'Bole',
  'Gulele',
  'Kirkos',
  'Kolfe Keranio',
  'Lideta',
  'Nifas Silk-Lafto',
  'Yeka',
];

const taxInfoData: { [key: string]: { [key: string]: string } } = {
  'License Renewal': {
    'Sole Proprietorship':
      'To renew your sole proprietorship license, submit Form TR-1 with proof of current license, updated business plan, and payment of renewal fees.',
    PLC: 'To renew your Public Limited Company license, submit Form PLC-1 with board minutes, updated Articles of Association, and annual compliance report.',
  },
  'License Closing': {
    'Sole Proprietorship':
      'To close your sole proprietorship, complete Form CL-1, clear all outstanding taxes, submit final reports, and notify relevant government offices.',
    PLC: 'To close your PLC, complete Form CL-PLC with board approval, settle all liabilities, distribute assets, and file final audit report.',
  },
  'New License': {
    'Sole Proprietorship':
      'To obtain a new sole proprietorship license, submit Form NL-1 with business plan, personal identification, proof of address, and initial registration fees.',
    PLC: 'To register a new PLC, submit Form NL-PLC with Articles of Association, shareholder details, business plan, and registration fees.',
  },
};

export default function FindInformationWizard({
  onBack,
}: FindInformationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [licenseType, setLicenseType] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [subcityOffice, setSubcityOffice] = useState('');

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getTaxInfo = () => {
    if (licenseType && businessType) {
      return (
        taxInfoData[licenseType]?.[businessType] || 'Information not available'
      );
    }
    return '';
  };

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="max-w-4xl mx-auto px-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="bg-card border border-border rounded-lg p-8">
          <h1 className="text-3xl font-bold text-foreground mb-8">
            Tax Information Finder
          </h1>

          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              {steps.map((step, index) => (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      index <= currentStep
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {index < currentStep ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <p className="text-xs font-medium text-foreground mt-2 text-center">
                    {step}
                  </p>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-12 h-1 mt-4 ${
                        index < currentStep ? 'bg-primary' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step 1: License Type */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">
                What type of license are you looking for?
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {['License Renewal', 'License Closing', 'New License'].map(
                  (type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setLicenseType(type);
                        handleNext();
                      }}
                      className={`p-6 border-2 rounded-lg text-left transition-all ${
                        licenseType === type
                          ? 'border-primary bg-secondary'
                          : 'border-border hover:border-primary'
                      }`}
                    >
                      <p className="font-semibold text-foreground">{type}</p>
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Step 2: Business Type */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">
                What type of business entity are you?
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => {
                    setBusinessType('Sole Proprietorship');
                    handleNext();
                  }}
                  className="p-6 border-2 border-border rounded-lg hover:border-primary transition-all text-left"
                >
                  <p className="font-semibold text-foreground">
                    Sole Proprietorship
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    A business owned and operated by one individual
                  </p>
                </button>
                <button
                  onClick={() => {
                    setBusinessType('PLC');
                    handleNext();
                  }}
                  className="p-6 border-2 border-border rounded-lg hover:border-primary transition-all text-left"
                >
                  <p className="font-semibold text-foreground">
                    Public Limited Company (PLC)
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    A company with multiple shareholders and public ownership
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Subcity Office */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">
                Select your Subcity Government Tax Office
              </h2>
              <Select value={subcityOffice} onValueChange={setSubcityOffice}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a subcity office..." />
                </SelectTrigger>
                <SelectContent>
                  {subcityOffices.map((office) => (
                    <SelectItem key={office} value={office}>
                      {office}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subcityOffice && (
                <Button onClick={handleNext} className="w-full">
                  Continue to Tax Information
                </Button>
              )}
            </div>
          )}

          {/* Step 4: Tax Information */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">
                Tax Information for {subcityOffice}
              </h2>
              <div className="bg-secondary p-6 rounded-lg border border-border">
                <p className="text-foreground leading-relaxed">
                  <strong>License Type:</strong> {licenseType}
                </p>
                <p className="text-foreground leading-relaxed mt-2">
                  <strong>Business Type:</strong> {businessType}
                </p>
                <p className="text-foreground leading-relaxed mt-2">
                  <strong>Office:</strong> {subcityOffice}
                </p>
                <div className="mt-6 pt-6 border-t border-border">
                  <h3 className="font-semibold text-foreground mb-4">
                    Required Information & Steps:
                  </h3>
                  <p className="text-foreground leading-relaxed">
                    {getTaxInfo()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8 justify-between">
            <Button
              onClick={handlePrevious}
              variant="outline"
              disabled={currentStep === 0}
              className="px-8 bg-transparent"
            >
              Previous
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button
                onClick={handleNext}
                disabled={
                  (currentStep === 0 && !licenseType) ||
                  (currentStep === 1 && !businessType) ||
                  (currentStep === 2 && !subcityOffice)
                }
                className="px-8"
              >
                Next
              </Button>
            ) : (
              <Button onClick={onBack} className="px-8">
                Back to Home
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
