'use client';

import { useState } from 'react';
import LoginForm from '@/components/forms/login-form';
import RegistrationForm from '@/components/forms/registration-form';
import PendingApprovalScreen from '@/components/screens/pending-approval-screen';

interface ReportTaxPageProps {
  authState: string;
  setAuthState: (state: any) => void;
  onLoginSuccess: (user: any) => void;
  onRegistrationSubmit: () => void;
  onBack: () => void;
}

export default function ReportTaxPage({
  authState,
  setAuthState,
  onLoginSuccess,
  onRegistrationSubmit,
  onBack,
}: ReportTaxPageProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  if (authState === 'pending') {
    return <PendingApprovalScreen onBack={onBack} />;
  }

  if (isRegisterMode) {
    return (
      <RegistrationForm
        onRegistrationSubmit={() => {
          setAuthState('pending');
          onRegistrationSubmit();
        }}
        onSwitchToLogin={() => setIsRegisterMode(false)}
        onBack={onBack}
      />
    );
  }

  return (
    <LoginForm
      onLoginSuccess={onLoginSuccess}
      onSwitchToRegister={() => setIsRegisterMode(true)}
      onBack={onBack}
    />
  );
}
