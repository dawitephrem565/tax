'use client';

import { Button } from '@/components/ui/button';
import { Clock, Mail } from 'lucide-react';

interface PendingApprovalScreenProps {
  onBack: () => void;
}

export default function PendingApprovalScreen({
  onBack,
}: PendingApprovalScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary to-background flex items-center justify-center pt-20 pb-12">
      <div className="max-w-md w-full px-6">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 text-accent-foreground" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-4">
            Registration Pending
          </h1>

          <p className="text-muted-foreground mb-6 leading-relaxed text-pretty">
            Your registration has been submitted successfully. Our admin team will
            review your documents and verify your information.
          </p>

          <div className="bg-secondary border border-border rounded-lg p-6 mb-8">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium text-foreground text-sm">
                  What happens next?
                </p>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  You will receive an email notification within 2-3 business days once your
                  registration has been reviewed and approved.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <div className="w-2 h-2 bg-primary rounded-full" />
              <span>Documents will be verified</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <div className="w-2 h-2 bg-primary rounded-full" />
              <span>Compliance check will be completed</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <div className="w-2 h-2 bg-primary rounded-full" />
              <span>You'll receive login credentials</span>
            </div>
          </div>

          <Button onClick={onBack} variant="outline" className="w-full mt-8 bg-transparent">
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
