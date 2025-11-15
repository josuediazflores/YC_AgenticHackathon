"use client";

import { useState, useEffect } from "react";
import { Plus, FolderOpen, DollarSign, TrendingUp, Edit, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
