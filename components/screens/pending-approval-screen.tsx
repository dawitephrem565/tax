'use client';

import { Button } from '@/components/ui/button';
import { Clock, Mail, CheckCircle, FileText, Shield } from 'lucide-react';
import Link from 'next/link';

interface PendingApprovalScreenProps {
  onBack: () => void;
}

export default function PendingApprovalScreen({
  onBack,
}: PendingApprovalScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center pt-20 pb-12">
      <div className="max-w-lg w-full px-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-200 mb-6">
            <Shield className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Registration Submitted!
          </h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Your company registration has been submitted successfully. Our admin
            team will review your documents and verify your information.
          </p>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 mb-8 text-left">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900 text-sm mb-2">
                  What happens next?
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  You will be able to log in once an admin approves your
                  registration. You will receive a notification once your account
                  has been activated.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            {[
              'Documents will be verified by admin',
              'Compliance check will be completed',
              'Account will be activated upon approval',
            ].map((step, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm text-slate-700"
              >
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span>{step}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={onBack}
              variant="outline"
              className="flex-1 rounded-xl border-slate-300 text-slate-700"
            >
              Back to Home
            </Button>
            <Link href="/admin-login" className="flex-1">
              <Button className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-200">
                <Shield className="w-4 h-4 mr-2" />
                Admin Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
