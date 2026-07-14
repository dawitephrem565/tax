'use client';

import { Button } from '@/components/ui/button';
import { Search, FileText, Newspaper, Shield, TrendingUp, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';

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
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: FileText,
      title: 'Report Tax',
      description: 'Submit your tax reports with required documents and certifications',
      action: 'reportTax',
      gradient: 'from-indigo-500 to-purple-500',
    },
    {
      icon: Newspaper,
      title: 'News & Updates',
      description: 'Stay updated with the latest tax and accounting news and updates',
      action: 'news',
      gradient: 'from-sky-500 to-blue-500',
    },
  ];

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-500/10 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6 py-28 md:py-36">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full px-4 py-1.5 mb-6">
              <Shield className="w-4 h-4 text-blue-300" />
              <span className="text-blue-200 text-sm font-medium">Trusted Tax Platform</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Professional Tax &<br />
              <span className="bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent">
                Accounting Solutions
              </span>
            </h1>
            <p className="text-lg md:text-xl text-blue-200/80 mb-10 max-w-2xl leading-relaxed">
              Streamline your tax reporting process with our comprehensive platform designed 
              for businesses and accounting professionals across Ethiopia.
            </p>
            <div className="flex gap-4 flex-wrap">
              <Button
                size="lg"
                onClick={() => onNavigate('findInfo')}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/25 rounded-xl px-8 h-12 text-base"
              >
                Find Information
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => onNavigate('reportTax')}
                className="border-white/20 text-white hover:bg-white/10 rounded-xl px-8 h-12 text-base"
              >
                Report Tax
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Our Services
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Comprehensive tax and accounting solutions tailored for your business needs
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group relative bg-white border border-slate-200 rounded-2xl p-8 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                    <IconComponent className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-slate-500 mb-6 leading-relaxed">{feature.description}</p>
                  <Button
                    variant="ghost"
                    onClick={() => onNavigate(feature.action)}
                    className="group-hover:text-blue-600 p-0 h-auto text-slate-600"
                  >
                    Learn more
                    <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Shield, label: 'Secure & Compliant', desc: 'Enterprise-grade security for all your tax data' },
              { icon: TrendingUp, label: 'Fast Processing', desc: 'Quick turnaround on tax report submissions' },
              { icon: Users, label: 'Expert Support', desc: 'Dedicated team to help you every step of the way' },
            ].map((item) => (
              <div key={item.label} className="text-center p-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-200">
                  <item.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.label}</h3>
                <p className="text-slate-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-blue-200 text-lg mb-8 max-w-xl mx-auto">
            Register your company today and streamline your tax reporting process
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              size="lg"
              onClick={() => onNavigate('reportTax')}
              className="bg-white text-blue-700 hover:bg-blue-50 rounded-xl px-8 h-12 text-base font-semibold shadow-xl"
            >
              Register Now
            </Button>
            <Link href="/admin-login">
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 rounded-xl px-8 h-12 text-base"
              >
                <Shield className="w-4 h-4 mr-2" />
                Admin Login
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
