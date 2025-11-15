"use client";

import { useState } from "react";
import { FileText, Check, X, Loader2, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface InvoiceData {
  company_name?: string;
  amount?: number;
  sales_email?: string;
  due_date?: string;
  category?: string;
  isNewCategory?: boolean;
}

interface InvoiceProcessorProps {
  invoiceUrl: string;
  invoiceName: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function InvoiceProcessor({
  invoiceUrl,
  invoiceName,
  onComplete,
  onCancel,
}: InvoiceProcessorProps) {
  const [step, setStep] = useState<"extracting" | "reviewing" | "creating">("extracting");
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({});
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract invoice data on mount
  useState(() => {
    extractInvoiceData();
  });

  const extractInvoiceData = async () => {
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract_invoice",
          data: {
            text: `Extract data from invoice at: ${invoiceUrl}`,
          },
        }),
      });

      const result = await response.json();
      if (result.success && result.data) {
        setInvoiceData(result.data);
        setStep("reviewing");
      } else {
        setError("Failed to extract invoice data");
      }
    } catch (err) {
      setError("Error processing invoice");
      console.error(err);
    }
  };

  const createExpense = async () => {
    setStep("creating");
    try {
      // Create category if needed
      let categoryId = null;
      if (invoiceData.category && invoiceData.isNewCategory) {
        const catResponse = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: invoiceData.category,
            description: `Created from invoice: ${invoiceName}`,
          }),
        });

        if (catResponse.ok) {
          const newCategory = await catResponse.json();
          categoryId = newCategory.id;
        }
      } else if (invoiceData.category) {
        // Find existing category
        const catResponse = await fetch("/api/categories");
        const categories = await catResponse.json();
        const existingCategory = categories.find(
          (c: any) => c.name.toLowerCase() === invoiceData.category?.toLowerCase()
        );
        if (existingCategory) {
          categoryId = existingCategory.id;
        }
      }

      // Create expense
      const expenseResponse = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: categoryId,
          company_name: invoiceData.company_name,
          amount: invoiceData.amount,
          sales_email: invoiceData.sales_email,
          due_date: invoiceData.due_date,
          status: "pending",
          invoice_url: invoiceUrl,
        }),
      });

      if (expenseResponse.ok) {
        onComplete();
      } else {
        setError("Failed to create expense");
      }
    } catch (err) {
      setError("Error creating expense");
      console.error(err);
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    createExpense();
  };

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
          <X className="h-5 w-5" />
          <p className="font-medium">{error}</p>
        </div>
        <button
          onClick={onCancel}
          className="mt-3 text-sm text-red-600 dark:text-red-400 hover:underline"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (step === "extracting") {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
          <div>
            <p className="font-medium text-blue-700 dark:text-blue-300">
              Processing Invoice
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Extracting information from {invoiceName}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "creating") {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-green-600 dark:text-green-400" />
          <p className="font-medium text-green-700 dark:text-green-300">
            Creating expense...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <FileText className="h-6 w-6 text-blue-500" />
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Invoice Review
        </h3>
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={invoiceData.company_name || ""}
              onChange={(e) =>
                setInvoiceData({ ...invoiceData, company_name: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Amount
            </label>
            <input
              type="number"
              value={invoiceData.amount || ""}
              onChange={(e) =>
                setInvoiceData({ ...invoiceData, amount: parseFloat(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={invoiceData.sales_email || ""}
              onChange={(e) =>
                setInvoiceData({ ...invoiceData, sales_email: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={invoiceData.due_date || ""}
              onChange={(e) =>
                setInvoiceData({ ...invoiceData, due_date: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Category
            </label>
            <input
              type="text"
              value={invoiceData.category || ""}
              onChange={(e) =>
                setInvoiceData({ ...invoiceData, category: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {invoiceData.company_name && (
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Company:
              </span>
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {invoiceData.company_name}
              </span>
            </div>
          )}
          {invoiceData.amount && (
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Amount:
              </span>
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                ${invoiceData.amount.toFixed(2)}
              </span>
            </div>
          )}
          {invoiceData.sales_email && (
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Email:
              </span>
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {invoiceData.sales_email}
              </span>
            </div>
          )}
          {invoiceData.due_date && (
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Due Date:
              </span>
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {new Date(invoiceData.due_date).toLocaleDateString()}
              </span>
            </div>
          )}
          {invoiceData.category && (
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Category:
              </span>
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {invoiceData.category}
                {invoiceData.isNewCategory && (
                  <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">
                    (new)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        {isEditing ? (
          <>
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center gap-2"
            >
              <Check className="h-4 w-4" />
              Save & Create
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700"
            >
              Cancel
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700"
            >
              Edit
            </button>
            <button
              onClick={createExpense}
              className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center gap-2"
            >
              <Check className="h-4 w-4" />
              Create Expense
            </button>
          </>
        )}
      </div>
    </div>
  );
}
