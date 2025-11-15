"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, FolderOpen, DollarSign, Edit, Trash2, Loader2, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Category {
  id: number;
  name: string;
  description?: string;
  budget_limit?: number;
  total_spent?: number;
  created_at: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    budget_limit: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories?includeSpending=true");
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          budget_limit: formData.budget_limit ? parseFloat(formData.budget_limit) : null,
        }),
      });

      if (response.ok) {
        setShowAddModal(false);
        setFormData({ name: "", description: "", budget_limit: "" });
        fetchCategories();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create category");
      }
    } catch (error) {
      console.error("Error creating category:", error);
      alert("Failed to create category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the category "${name}"?`)) return;

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchCategories();
      }
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  const calculatePercentage = (spent?: number, budget?: number) => {
    if (!spent || !budget) return 0;
    return Math.min((spent / budget) * 100, 100);
  };

  // Calculate aggregate statistics
  const summary = useMemo(() => {
    const totalSpent = categories.reduce((sum, cat) => sum + (cat.total_spent || 0), 0);
    const totalBudget = categories.reduce((sum, cat) => sum + (cat.budget_limit || 0), 0);
    const categoriesWithBudget = categories.filter(cat => cat.budget_limit);
    const categoriesOverBudget = categories.filter(cat => {
      if (!cat.budget_limit || !cat.total_spent) return false;
      return cat.total_spent > cat.budget_limit;
    });
    const avgBudgetUtilization = categoriesWithBudget.length > 0
      ? categoriesWithBudget.reduce((sum, cat) => sum + calculatePercentage(cat.total_spent, cat.budget_limit), 0) / categoriesWithBudget.length
      : 0;
    
    return {
      totalSpent,
      totalBudget,
      categoriesWithBudget: categoriesWithBudget.length,
      categoriesOverBudget: categoriesOverBudget.length,
      avgBudgetUtilization,
      remainingBudget: totalBudget - totalSpent,
    };
  }, [categories]);

  // Animated counter component
  const AnimatedNumber = ({ value, duration = 1.5 }: { value: number; duration?: number }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
      let startTime: number;
      const startValue = displayValue;
      const endValue = value;
      
      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / (duration * 1000), 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setDisplayValue(startValue + (endValue - startValue) * easeOutQuart);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setDisplayValue(endValue);
        }
      };
      
      requestAnimationFrame(animate);
    }, [value]);

    return <span>${displayValue.toFixed(2)}</span>;
  };

  // Get category colors for visualization
  const getCategoryColor = (index: number) => {
    const colors = [
      'from-blue-500 to-cyan-500',
      'from-purple-500 to-pink-500',
      'from-orange-500 to-red-500',
      'from-green-500 to-emerald-500',
      'from-indigo-500 to-blue-500',
      'from-rose-500 to-pink-500',
      'from-amber-500 to-orange-500',
      'from-teal-500 to-cyan-500',
    ];
    return colors[index % colors.length];
  };

  // Sort categories by spending for better visualization
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0));
  }, [categories]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-700 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Spending Categories
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Organize your expenses by category
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Category
        </button>
      </div>

      {/* Creative Summary Section */}
      {categories.length > 0 && (
        <div className="mb-8 space-y-6">
          {/* Total Spending Hero Card */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-8 text-white shadow-2xl"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Total Spending</p>
                    <h2 className="text-4xl font-bold">
                      <AnimatedNumber value={summary.totalSpent} />
                    </h2>
                  </div>
                </div>
                <div className="text-right">
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-2">
                    <PieChart className="h-8 w-8" />
                  </div>
                  <p className="text-blue-100 text-xs">{categories.length} Categories</p>
                </div>
              </div>

              {/* Budget Progress Bar */}
              {summary.totalBudget > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-blue-100 text-sm">Budget Utilization</span>
                    <span className="text-white font-semibold">
                      {summary.totalSpent > 0 
                        ? ((summary.totalSpent / summary.totalBudget) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                  <div className="relative h-3 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((summary.totalSpent / summary.totalBudget) * 100, 100)}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className={cn(
                        "absolute left-0 top-0 h-full rounded-full",
                        (summary.totalSpent / summary.totalBudget) > 0.9
                          ? "bg-red-400"
                          : (summary.totalSpent / summary.totalBudget) > 0.7
                          ? "bg-yellow-400"
                          : "bg-green-400"
                      )}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-blue-100">
                    <span>Spent: <AnimatedNumber value={summary.totalSpent} duration={1} /></span>
                    <span>Remaining: <AnimatedNumber value={Math.max(0, summary.remainingBudget)} duration={1} /></span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Visual Category Breakdown */}
          {summary.totalSpent > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-lg"
            >
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-blue-500" />
                Category Breakdown
              </h3>
              
              <div className="space-y-3">
                {sortedCategories.slice(0, 5).map((category, index) => {
                  const percent = summary.totalSpent > 0 
                    ? ((category.total_spent || 0) / summary.totalSpent) * 100 
                    : 0;
                  const colorClass = getCategoryColor(index);
                  
                  return (
                    <div key={category.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-3 h-3 rounded-full bg-gradient-to-r", colorClass)} />
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {category.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-neutral-600 dark:text-neutral-400">
                            {percent.toFixed(1)}%
                          </span>
                          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            ${(category.total_spent || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="relative h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 1, delay: 0.1 * index, ease: "easeOut" }}
                          className={cn("absolute left-0 top-0 h-full rounded-full bg-gradient-to-r", colorClass)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 mx-auto text-neutral-400 mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            No categories yet. Create your first category to start organizing expenses.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Plus className="h-5 w-5" />
            Create Category
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => {
            const percentage = calculatePercentage(category.total_spent, category.budget_limit);
            
            return (
              <div
                key={category.id}
                className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                      <FolderOpen className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleDelete(category.id, category.name)}
                      className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">Spent</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      ${(category.total_spent || 0).toFixed(2)}
                    </span>
                  </div>

                  {category.budget_limit && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-600 dark:text-neutral-400">Budget</span>
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          ${category.budget_limit.toFixed(2)}
                        </span>
                      </div>

                      <div className="relative w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "absolute left-0 top-0 h-full rounded-full transition-all",
                            percentage > 90
                              ? "bg-red-500"
                              : percentage > 70
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {percentage.toFixed(0)}% of budget
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            percentage > 90
                              ? "text-red-500"
                              : percentage > 70
                              ? "text-yellow-500"
                              : "text-green-500"
                          )}
                        >
                          ${((category.budget_limit || 0) - (category.total_spent || 0)).toFixed(2)} left
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Add New Category
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Marketing"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Budget Limit
                </label>
                <input
                  type="number"
                  value={formData.budget_limit}
                  onChange={(e) => setFormData({ ...formData, budget_limit: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ name: "", description: "", budget_limit: "" });
                  }}
                  className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.name.trim()}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Create Category"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
