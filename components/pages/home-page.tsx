'use client';

import { Button } from '@/components/ui/button';
import { Search, FileText, Newspaper } from 'lucide-react';

interface HomePageProps {
  onNavigate: (page: any) => void;
}

export default function HomePage({ onNavigate }: HomePageProps) {
  const features = [
    {
      icon: Search,
      title: 'Find Information',
      description: 'Search for tax information by license type and subcity government office',
      action: 'findInfo',
    },
    {
      icon: FileText,
      title: 'Report Tax',
      description: 'Submit your tax reports with required documents and certifications',
      action: 'reportTax',
    },
    {
      icon: Newspaper,
      title: 'News',
      description: 'Stay updated with the latest tax and accounting news and updates',
      action: 'news',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary to-background">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-24 text-center">
        <h2 className="text-5xl font-bold text-foreground mb-6 text-balance">
          Amis Financial: Professional Tax & Accounting Solutions
        </h2>
        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto text-pretty">
          Streamline your tax reporting process with our comprehensive platform designed for businesses
          and accounting professionals.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Button
            size="lg"
            onClick={() => onNavigate('findInfo')}
            className="px-8"
          >
            Find Information
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => onNavigate('reportTax')}
            className="px-8"
          >
            Report Tax
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h3 className="text-3xl font-bold text-foreground mb-12 text-center">
          Our Services
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => {
            const IconComponent = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-card border border-border rounded-lg p-8 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-accent rounded-lg mb-6">
                  <IconComponent className="w-6 h-6 text-accent-foreground" />
                </div>
                <h4 className="text-xl font-semibold text-foreground mb-4">
                  {feature.title}
                </h4>
                <p className="text-muted-foreground mb-6">
                  {feature.description}
                </p>
                <Button
                  variant="outline"
                  onClick={() => onNavigate(feature.action)}
                  className="w-full"
                >
                  Learn More
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust Section */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-3xl font-bold mb-4">
            Trusted by Businesses Nationwide
          </h3>
          <p className="text-lg opacity-90 max-w-2xl mx-auto text-pretty">
            Our platform is designed to meet the highest standards of security and compliance for tax reporting.
          </p>
        </div>
      </section>
    </div>
  );
}
