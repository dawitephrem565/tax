'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, ArrowRight } from 'lucide-react';

interface NewsPageProps {
  onBack: () => void;
}

const newsArticles = [
  {
    id: 1,
    title: 'New VAT Regulations Effective January 2024',
    excerpt:
      'The Ministry of Finance has announced new VAT filing requirements that will take effect on January 1, 2024.',
    date: 'Dec 15, 2023',
    category: 'Regulations',
  },
  {
    id: 2,
    title: 'Tax Payment Deadline Extended for Small Businesses',
    excerpt:
      'Small businesses can now submit their annual tax reports by March 31st instead of the previous deadline.',
    date: 'Dec 10, 2023',
    category: 'Announcements',
  },
  {
    id: 3,
    title: 'Digital Tax Filing Now Available for All Categories',
    excerpt:
      'The online tax filing system is now open to all business categories, making it easier to submit reports.',
    date: 'Dec 5, 2023',
    category: 'Updates',
  },
  {
    id: 4,
    title: 'Income Tax Rate Changes for 2024',
    excerpt:
      'New income tax brackets have been announced for the 2024 tax year. Review the changes to understand your obligations.',
    date: 'Nov 28, 2023',
    category: 'Regulations',
  },
  {
    id: 5,
    title: 'Withholding Tax Requirements Clarified',
    excerpt:
      'The revenue authority has released new guidelines clarifying withholding tax calculations for different income types.',
    date: 'Nov 20, 2023',
    category: 'Guidance',
  },
  {
    id: 6,
    title: 'Penalty Amnesty Program Launched',
    excerpt:
      'Companies can now settle outstanding tax penalties at a reduced rate through the new amnesty program.',
    date: 'Nov 15, 2023',
    category: 'Announcements',
  },
];

const categoryColors: { [key: string]: string } = {
  Regulations: 'bg-blue-100 text-blue-800',
  Announcements: 'bg-green-100 text-green-800',
  Updates: 'bg-purple-100 text-purple-800',
  Guidance: 'bg-orange-100 text-orange-800',
};

export default function NewsPage({ onBack }: NewsPageProps) {
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

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Tax & Accounting News
          </h1>
          <p className="text-lg text-muted-foreground">
            Stay informed with the latest updates and announcements from the tax
            authority and accounting industry.
          </p>
        </div>

        {/* Featured Article */}
        <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-lg p-8 mb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-primary-foreground/20 px-3 py-1 rounded-full text-sm font-medium">
              {newsArticles[0].category}
            </span>
          </div>
          <h2 className="text-3xl font-bold mb-4">{newsArticles[0].title}</h2>
          <p className="text-lg opacity-90 mb-6 text-pretty">
            {newsArticles[0].excerpt}
          </p>
          <div className="flex items-center gap-4">
            <Calendar className="w-4 h-4" />
            <span>{newsArticles[0].date}</span>
            <Button
              variant="secondary"
              className="ml-auto flex items-center gap-2"
            >
              Read More
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* News Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {newsArticles.slice(1).map((article) => (
            <div
              key={article.id}
              className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    categoryColors[article.category] ||
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {article.category}
                </span>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  {article.date}
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-3 hover:text-primary transition-colors cursor-pointer">
                {article.title}
              </h3>
              <p className="text-muted-foreground mb-4 text-pretty">
                {article.excerpt}
              </p>
              <Button variant="outline" size="sm">
                Read More
              </Button>
            </div>
          ))}
        </div>

        {/* Newsletter Subscription */}
        <div className="bg-secondary border border-border rounded-lg p-8 mt-12 text-center">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            Stay Updated
          </h3>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto text-pretty">
            Subscribe to our newsletter to receive the latest tax updates and
            accounting news directly in your inbox.
          </p>
          <div className="flex gap-3 max-w-md mx-auto flex-col sm:flex-row">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground"
            />
            <Button>Subscribe</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
