"use client";

import { useState, useEffect, useMemo } from "react";
import { Receipt, Building, Mail, FileText, Send, Loader2, Filter, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAvailableYears, getQuarterOptions, filterExpensesByQuarter, getCurrentQuarterInfo, type Quarter } from "@/lib/quarters";

interface Expense {
  id: number;
  category_id?: number;
  company_name?: string;
  amount: number;
  sales_email?: string;
  invoice_date?: string;
  due_date?: string;
  status: "pending" | "paid" | "cancelled";
  invoice_url?: string;
  created_at: string;
}

interface Category {
  id: number;
  name: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentEmail, setPaymentEmail] = useState("");
  const [paymentMemo, setPaymentMemo] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterQuarter, setFilterQuarter] = useState<Quarter | null>(null);

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, filterStatus]);

  const fetchExpenses = async () => {
    try {
      let url = "/api/expenses?";
      if (filterCategory) url += `category_id=${filterCategory}&`;
      if (filterStatus) url += `status=${filterStatus}`;
      
      const response = await fetch(url);
      const data = await response.json();
      setExpenses(data);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const getCategoryName = (categoryId?: number) => {
    if (!categoryId) return "Uncategorized";
    const category = categories.find(c => c.id === categoryId);
    return category?.name || "Unknown";
  };

  const exportToCSV = () => {
    // Use filtered expenses
    const expensesToExport = filteredExpenses;

    if (expensesToExport.length === 0) {
      alert("No expenses to export");
      return;
    }

    // Define CSV headers
    const headers = [
      "ID",
      "Company Name",
      "Category",
      "Amount",
      "Sales Email",
      "Invoice Date",
      "Due Date",
      "Status",
      "Invoice URL",
      "Created At"
    ];

    // Convert expenses to CSV rows
    const rows = expensesToExport.map(expense => [
      expense.id,
      expense.company_name || "",
      getCategoryName(expense.category_id),
      expense.amount.toFixed(2),
      expense.sales_email || "",
      expense.invoice_date || "",
      expense.due_date || "",
      expense.status,
      expense.invoice_url || "",
      expense.created_at
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row =>
        row.map(cell =>
          // Escape cells containing commas, quotes, or newlines
          typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))
            ? `"${cell.replace(/"/g, '""')}"`
            : cell
        ).join(",")
      )
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    // Generate filename with current date and filter info
    const date = new Date().toISOString().split('T')[0];
    let filename = `expenses_${date}`;

    if (filterYear || filterQuarter) {
      filename += '_filtered';
      if (filterYear) filename += `_${filterYear}`;
      if (filterQuarter) filename += `_Q${filterQuarter}`;
    }
    filename += '.csv';

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter expenses by quarter/year (client-side filtering)
  const filteredExpenses = useMemo(() => {
    return filterExpensesByQuarter(expenses, filterQuarter, filterYear);
  }, [expenses, filterQuarter, filterYear]);

  const handlePayment = async () => {
    if (!selectedExpense) return;

    setIsProcessingPayment(true);
    try {
      // First, process payment through Locus
      const agentResponse = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_payment",
          data: {
            email: paymentEmail || selectedExpense.sales_email,
            amount: selectedExpense.amount,
            memo: paymentMemo || `Payment for expense #${selectedExpense.id}`,
            expense_id: selectedExpense.id
          }
        })
      });

      const result = await agentResponse.json();
      
      if (result.success) {
        // Payment successful
        alert("Payment sent successfully!");
        setShowPayModal(false);
        setSelectedExpense(null);
        setPaymentEmail("");
        setPaymentMemo("");
        fetchExpenses(); // Refresh the list
      } else {
        alert("Payment failed. Please try again.");
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      alert("Error processing payment. Please try again.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300" },
      paid: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300" },
      cancelled: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300" }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <span className={cn("px-2 py-1 text-xs font-medium rounded-full", config.bg, config.text)}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
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
      <div className="border-b border-neutral-200 dark:border-neutral-700 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Expenses
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Track and manage all your company expenses
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-neutral-500" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Year Filter */}
        <select
          value={filterYear || ""}
          onChange={(e) => setFilterYear(e.target.value ? parseInt(e.target.value) : null)}
          className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Years</option>
          {getAvailableYears().map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        {/* Quarter Filter */}
        <select
          value={filterQuarter || ""}
          onChange={(e) => setFilterQuarter(e.target.value ? parseInt(e.target.value) as Quarter : null)}
          className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Quarters</option>
          {getQuarterOptions().map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Clear Filters Button (show when filters are active) */}
        {(filterCategory || filterStatus || filterYear || filterQuarter) && (
          <button
            onClick={() => {
              setFilterCategory("");
              setFilterStatus("");
              setFilterYear(null);
              setFilterQuarter(null);
            }}
            className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Clear Filters
          </button>
        )}

        {/* Export CSV Button */}
        <button
          onClick={exportToCSV}
          disabled={filteredExpenses.length === 0}
          className="ml-auto px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          title={filteredExpenses.length === 0 ? "No expenses to export" : `Export ${filteredExpenses.length} expense${filteredExpenses.length === 1 ? '' : 's'} to CSV`}
        >
          <Download className="h-4 w-4" />
          Export CSV ({filteredExpenses.length})
        </button>
      </div>

      {/* Expenses Table */}
      {filteredExpenses.length === 0 ? (
        <div className="text-center py-12">
          <Receipt className="h-12 w-12 mx-auto text-neutral-400 mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400">
            {expenses.length === 0
              ? "No expenses found. Upload invoices in the Ask tab to create expenses."
              : "No expenses match the selected filters."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                          <Building className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {expense.company_name || "Unknown Company"}
                          </p>
                          {expense.sales_email && (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {expense.sales_email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-neutral-900 dark:text-neutral-100">
                        {getCategoryName(expense.category_id)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        ${expense.amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {expense.due_date ? new Date(expense.due_date).toLocaleDateString() : "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(expense.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {expense.invoice_url && (
                          <a
                            href={expense.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-neutral-400 hover:text-blue-500 transition-colors"
                            title="View Invoice"
                          >
                            <FileText className="h-4 w-4" />
                          </a>
                        )}
                        {expense.status === "pending" && (
                          <button
                            onClick={() => {
                              setSelectedExpense(expense);
                              setPaymentEmail(expense.sales_email || "");
                              setShowPayModal(true);
                            }}
                            className="p-1 text-neutral-400 hover:text-green-500 transition-colors"
                            title="Send Payment"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayModal && selectedExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Send Payment
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Company</p>
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  {selectedExpense.company_name || "Unknown Company"}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Amount</p>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                  ${selectedExpense.amount.toFixed(2)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={paymentEmail}
                  onChange={(e) => setPaymentEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={selectedExpense.sales_email || "Enter email"}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Memo
                </label>
                <input
                  type="text"
                  value={paymentMemo}
                  onChange={(e) => setPaymentMemo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Payment for expense #${selectedExpense.id}`}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPayModal(false);
                    setSelectedExpense(null);
                    setPaymentEmail("");
                    setPaymentMemo("");
                  }}
                  className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePayment}
                  disabled={isProcessingPayment || !paymentEmail}
                  className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessingPayment ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Send Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
