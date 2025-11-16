/**
 * Utility functions for handling US financial quarters
 * Q1: January - March
 * Q2: April - June
 * Q3: July - September
 * Q4: October - December
 */

export type Quarter = 1 | 2 | 3 | 4;

export interface QuarterInfo {
  quarter: Quarter;
  year: number;
  label: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Get the quarter number (1-4) for a given date
 */
export function getQuarter(date: Date): Quarter {
  const month = date.getMonth(); // 0-11
  if (month <= 2) return 1; // Jan-Mar
  if (month <= 5) return 2; // Apr-Jun
  if (month <= 8) return 3; // Jul-Sep
  return 4; // Oct-Dec
}

/**
 * Get the quarter for a date string (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS format)
 * Parses date components directly to avoid timezone issues
 */
export function getQuarterFromString(dateString: string): Quarter | null {
  if (!dateString) return null;

  // Parse date components directly to avoid timezone issues
  // Handles both DATE (YYYY-MM-DD) and DATETIME (YYYY-MM-DD HH:MM:SS) formats
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const month = parseInt(match[2], 10) - 1; // 0-11
  if (month <= 2) return 1; // Jan-Mar
  if (month <= 5) return 2; // Apr-Jun
  if (month <= 8) return 3; // Jul-Sep
  return 4; // Oct-Dec
}

/**
 * Get the year from a date string
 * Parses date components directly to avoid timezone issues
 */
export function getYearFromString(dateString: string): number | null {
  if (!dateString) return null;

  // Parse year directly to avoid timezone issues
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  return parseInt(match[1], 10);
}

/**
 * Get the start and end dates for a specific quarter and year
 */
export function getQuarterDateRange(quarter: Quarter, year: number): { startDate: Date; endDate: Date } {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;

  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, endMonth + 1, 0); // Last day of the end month

  return { startDate, endDate };
}

/**
 * Get quarter info for a specific quarter and year
 */
export function getQuarterInfo(quarter: Quarter, year: number): QuarterInfo {
  const { startDate, endDate } = getQuarterDateRange(quarter, year);
  return {
    quarter,
    year,
    label: `Q${quarter} ${year}`,
    startDate,
    endDate
  };
}

/**
 * Get the current quarter and year
 */
export function getCurrentQuarterInfo(): QuarterInfo {
  const now = new Date();
  const quarter = getQuarter(now);
  const year = now.getFullYear();
  return getQuarterInfo(quarter, year);
}

/**
 * Check if a date falls within a specific quarter and year
 * Uses timezone-safe parsing for string dates
 */
export function isDateInQuarter(date: Date | string, quarter: Quarter, year: number): boolean {
  if (typeof date === 'string') {
    // Use timezone-safe parsing for strings
    const dateQuarter = getQuarterFromString(date);
    const dateYear = getYearFromString(date);

    if (dateQuarter === null || dateYear === null) return false;

    return dateQuarter === quarter && dateYear === year;
  } else {
    // For Date objects, use standard methods
    if (isNaN(date.getTime())) return false;

    const dateQuarter = getQuarter(date);
    const dateYear = date.getFullYear();

    return dateQuarter === quarter && dateYear === year;
  }
}

/**
 * Get a list of available years (for dropdown)
 * Returns years from 2020 to current year + 1
 */
export function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear();
  const startYear = 2020;
  const years: number[] = [];

  for (let year = startYear; year <= currentYear + 1; year++) {
    years.push(year);
  }

  return years.reverse(); // Most recent first
}

/**
 * Get all quarters as options
 */
export function getQuarterOptions(): Array<{ value: Quarter; label: string }> {
  return [
    { value: 1, label: 'Q1 (Jan-Mar)' },
    { value: 2, label: 'Q2 (Apr-Jun)' },
    { value: 3, label: 'Q3 (Jul-Sep)' },
    { value: 4, label: 'Q4 (Oct-Dec)' }
  ];
}

/**
 * Format a quarter for display
 */
export function formatQuarter(quarter: Quarter, year: number): string {
  return `Q${quarter} ${year}`;
}

/**
 * Filter expenses by quarter and year
 * This is a client-side filter that uses invoice_date, due_date, or created_at
 * - If both quarter and year are provided, filter by both
 * - If only quarter is provided, filter by that quarter across all years
 * - If only year is provided, filter by all expenses in that year
 * - If neither is provided, return all expenses
 */
export function filterExpensesByQuarter<T extends { invoice_date?: string; due_date?: string; created_at?: string }>(
  expenses: T[],
  quarter: Quarter | null,
  year: number | null
): T[] {
  // If no filters, return all expenses
  if (!quarter && !year) return expenses;

  return expenses.filter(expense => {
    // Prioritize invoice_date, then due_date, then created_at
    const dateString = expense.invoice_date || expense.due_date || expense.created_at;
    if (!dateString) return false;

    const expenseQuarter = getQuarterFromString(dateString);
    const expenseYear = getYearFromString(dateString);

    // If only year filter (no quarter), match year only
    if (!quarter && year) {
      return expenseYear === year;
    }

    // If only quarter filter (no year), match quarter across all years
    if (quarter && !year) {
      return expenseQuarter === quarter;
    }

    // If both filters, match both quarter and year
    return expenseQuarter === quarter && expenseYear === year;
  });
}
