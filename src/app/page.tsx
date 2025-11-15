import { Hero } from "@/components/ui/animated-hero";
import { Upload, Sparkles, DollarSign, FolderOpen, Receipt, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      {/* Hero Section */}
      <Hero />

      {/* Features Section */}
      <section className="py-20 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              Everything you need to manage expenses
            </h2>
            <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
              Powerful features that save time and reduce errors
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <FeatureCard
              icon={<Upload className="w-6 h-6" />}
              title="AI Invoice Processing"
              description="Upload invoices and receipts. Our AI automatically extracts company names, amounts, due dates, and categorizes expenses."
            />
            <FeatureCard
              icon={<Sparkles className="w-6 h-6" />}
              title="Smart Categorization"
              description="AI automatically categorizes expenses based on your existing categories or suggests new ones. No manual tagging needed."
            />
            <FeatureCard
              icon={<DollarSign className="w-6 h-6" />}
              title="One-Click Payments"
              description="Send USDC payments directly to vendors via email. Track all payments and expenses in one place."
            />
            <FeatureCard
              icon={<FolderOpen className="w-6 h-6" />}
              title="Category Management"
              description="Organize expenses by category, set budget limits, and track spending across different expense types."
            />
            <FeatureCard
              icon={<Receipt className="w-6 h-6" />}
              title="Expense Tracking"
              description="View all expenses in one place. Filter by category, status, or date. See what's pending, paid, or overdue."
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Chat Interface"
              description="Ask questions about your expenses, upload invoices via chat, and get instant answers from your AI assistant."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
        {title}
      </h3>
      <p className="text-neutral-600 dark:text-neutral-400">
        {description}
      </p>
    </div>
  );
}

