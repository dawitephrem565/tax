'use client';

import { useState } from 'react';

export type Language = 'en' | 'am';

export const translations = {
  en: {
    // Navbar
    findInformation: 'Find Information',
    reportTax: 'Report Tax',
    news: 'News',
    adminDashboard: 'Admin Dashboard',
    logout: 'Logout',
    login: 'Login',
    
    // Home page
    professionalTaxSolutions: 'Amis Financial: Professional Tax & Accounting Solutions',
    welcome: 'Welcome to Amis Financial',
    getStarted: 'Get Started',
    
    // Find Information
    findInformationWizard: 'Find Information Wizard',
    licenseType: 'License Type',
    businessType: 'Business Type',
    subcity: 'Subcity',
    requirements: 'Requirements',
    next: 'Next',
    back: 'Back',
    submit: 'Submit',
    
    // Report Tax
    reportYourTax: 'Report Your Tax',
    loginToReport: 'Please login to report tax',
    dontHaveAccount: "Don't have an account?",
    createOne: 'Create one',
    email: 'Email',
    password: 'Password',
    fullName: 'Full Name',
    companyName: 'Company Name',
    companyAddress: 'Company Address',
    tin: 'TIN Number',
    vat: 'VAT Number',
    uploadLicense: 'Upload Business License',
    uploadVat: 'Upload VAT Certificate',
    uploadTin: 'Upload TIN Certificate',
    register: 'Register',
    signIn: 'Sign In',
    
    // Status
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    inReview: 'In Review',
    completed: 'Completed',
    
    // Admin Dashboard
    adminDashboardTitle: 'Admin Dashboard',
    overview: 'Overview',
    totalRegisteredCompanies: 'Total Registered Companies',
    pendingApprovals: 'Pending Approvals',
    newReportsSubmitted: 'New Reports Submitted',
    companyApprovalQueue: 'Company Approval Queue',
    reportManagement: 'Report Management',
    userSearch: 'User Search',
    searchByTinOrName: 'Search by TIN or Company Name',
    viewDocuments: 'View Documents',
    approve: 'Approve',
    reject: 'Reject',
    companyName: 'Company Name',
    tinNumber: 'TIN Number',
    status: 'Status',
    action: 'Action',
    reportType: 'Report Type',
    submittedDate: 'Submitted Date',
    vat: 'VAT',
    withhold: 'Withhold',
    businessProfitsTax: 'Business Profits Tax',
    search: 'Search',
    noResults: 'No results found',
  },
  am: {
    // Navbar
    findInformation: 'መረጃ ፈልግ',
    reportTax: 'ታክስ አስታውቅ',
    news: 'ዜና',
    adminDashboard: 'አስተዳደር ዳሽቦርድ',
    logout: 'ውጣ',
    login: 'ግባ',
    
    // Home page
    professionalTaxSolutions: 'አሚስ ፊናንሺያል፡ ፕሮፌሽናል ታክስ እና ሒሳብ ስልጠናዎች',
    welcome: 'ወደ አሚስ ፊናንሺያል እንኳን በደህና መጡ',
    getStarted: 'ጀምር',
    
    // Find Information
    findInformationWizard: 'መረጃ ፈልግ ውይዝ',
    licenseType: 'ፈቃድ ዓይነት',
    businessType: 'ሥራ ዓይነት',
    subcity: 'ክፍለ ከተማ',
    requirements: 'ያስፈልጋሉ',
    next: 'ተግባር',
    back: 'ተመለስ',
    submit: 'ልክ',
    
    // Report Tax
    reportYourTax: 'ታክስህን አስታውቅ',
    loginToReport: 'ታክስ ለማስታወቅ እባክህ ግባ',
    dontHaveAccount: '계정이 없으신가요?',
    createOne: 'አንድ ፍጠር',
    email: 'ኢሜይል',
    password: 'ይለፍ ቃል',
    fullName: 'ሙሉ ስም',
    companyName: 'ኩባንያ ስም',
    companyAddress: 'ኩባንያ አድራሻ',
    tin: 'ታክስ መለያ ቁጥር',
    vat: 'ዋጋ ተጨማሪ ግብር ቁጥር',
    uploadLicense: 'የንግድ ፈቃድ ስቅ',
    uploadVat: 'ዋጋ ተጨማሪ ግብር ሰertificate ስቅ',
    uploadTin: 'ታክስ መለያ ቁጥር ሰertificate ስቅ',
    register: 'ተመዝገብ',
    signIn: 'ግባ',
    
    // Status
    pending: 'በጥበቃ ላይ',
    approved: 'ጸድቋል',
    rejected: 'ተወሰደ',
    inReview: 'በመገምገም ላይ',
    completed: 'ተጠናቋል',
    
    // Admin Dashboard
    adminDashboardTitle: 'አስተዳደር ዳሽቦርድ',
    overview: 'ጠቅላላ እይታ',
    totalRegisteredCompanies: 'በጠቅላላ የተመዘገቡ ኩባንያዎች',
    pendingApprovals: 'በመጠበቅ ላይ ያሉ ማጽደቂያዎች',
    newReportsSubmitted: 'ሊገቡ የሚችሉ አዲስ ሪፖርቶች',
    companyApprovalQueue: 'ኩባንያ ማጽደቂያ ረድፍ',
    reportManagement: 'ሪፖርት አመራር',
    userSearch: 'ተጠቃሚ ፍለጋ',
    searchByTinOrName: 'ታክስ ቁጥር ወይም ስም ቪ ፍለግ',
    viewDocuments: 'ሰነዶች ይመልከቱ',
    approve: 'ፈቅድ',
    reject: 'ተካ',
    companyName: 'ኩባንያ ስም',
    tinNumber: 'ታክስ ቁጥር',
    status: 'ሁኔታ',
    action: 'ድርጊት',
    reportType: 'ሪፖርት ዓይነት',
    submittedDate: 'የገቢ ቀን',
    vat: 'ዋጋ ተጨማሪ ግብር',
    withhold: 'ማስቆም',
    businessProfitsTax: 'ሥራ ትርፍ ታክስ',
    search: 'ፍለግ',
    noResults: 'ምንም ውጤቶች አልተገኘም',
  },
};

export const useLanguage = () => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: keyof typeof translations.en): string => {
    return translations[language][key as keyof typeof translations[language]] || key;
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'am' : 'en'));
  };

  return { language, t, toggleLanguage };
};
