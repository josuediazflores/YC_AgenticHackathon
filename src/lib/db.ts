import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), process.env.DATABASE_URL || './spending.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  -- Categories table
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    budget_limit DECIMAL(10,2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Expenses table  
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    company_name TEXT,
    amount DECIMAL(10,2) NOT NULL,
    sales_email TEXT,
    due_date DATE,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'cancelled')),
    invoice_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  -- Payment history
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    recipient_email TEXT,
    amount DECIMAL(10,2) NOT NULL,
    memo TEXT,
    transaction_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
  );

  -- Create indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
  CREATE INDEX IF NOT EXISTS idx_expenses_due_date ON expenses(due_date);
  CREATE INDEX IF NOT EXISTS idx_payments_expense ON payments(expense_id);
`);

// Category operations
export const categoryOperations = {
  create: (name: string, description?: string, budgetLimit?: number) => {
    const stmt = db.prepare(`
      INSERT INTO categories (name, description, budget_limit) 
      VALUES (?, ?, ?)
    `);
    return stmt.run(name, description || null, budgetLimit || null);
  },

  getAll: () => {
    const stmt = db.prepare('SELECT * FROM categories ORDER BY created_at DESC');
    return stmt.all();
  },

  getById: (id: number) => {
    const stmt = db.prepare('SELECT * FROM categories WHERE id = ?');
    return stmt.get(id);
  },

  update: (id: number, name: string, description?: string, budgetLimit?: number) => {
    const stmt = db.prepare(`
      UPDATE categories 
      SET name = ?, description = ?, budget_limit = ?
      WHERE id = ?
    `);
    return stmt.run(name, description || null, budgetLimit || null, id);
  },

  delete: (id: number) => {
    const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
    return stmt.run(id);
  },

  getWithSpending: () => {
    const stmt = db.prepare(`
      SELECT 
        c.*,
        COALESCE(SUM(e.amount), 0) as total_spent
      FROM categories c
      LEFT JOIN expenses e ON c.id = e.category_id AND e.status = 'paid'
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    return stmt.all();
  }
};

// Expense operations
export const expenseOperations = {
  create: (data: {
    category_id?: number;
    company_name?: string;
    amount: number;
    sales_email?: string;
    due_date?: string;
    status?: string;
    invoice_url?: string;
  }) => {
    const stmt = db.prepare(`
      INSERT INTO expenses (category_id, company_name, amount, sales_email, due_date, status, invoice_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      data.category_id || null,
      data.company_name || null,
      data.amount,
      data.sales_email || null,
      data.due_date || null,
      data.status || 'pending',
      data.invoice_url || null
    );
  },

  getAll: (filters?: { category_id?: number; status?: string }) => {
    let query = 'SELECT * FROM expenses WHERE 1=1';
    const params: any[] = [];
    
    if (filters?.category_id) {
      query += ' AND category_id = ?';
      params.push(filters.category_id);
    }
    
    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const stmt = db.prepare(query);
    return stmt.all(...params);
  },

  getById: (id: number) => {
    const stmt = db.prepare('SELECT * FROM expenses WHERE id = ?');
    return stmt.get(id);
  },

  update: (id: number, data: {
    category_id?: number;
    company_name?: string;
    amount?: number;
    sales_email?: string;
    due_date?: string;
    status?: string;
    invoice_url?: string;
  }) => {
    const fields: string[] = [];
    const values: any[] = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    if (fields.length === 0) return;
    
    values.push(id);
    const stmt = db.prepare(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  },

  delete: (id: number) => {
    const stmt = db.prepare('DELETE FROM expenses WHERE id = ?');
    return stmt.run(id);
  }
};

// Payment operations
export const paymentOperations = {
  create: (data: {
    expense_id: number;
    payment_method: string;
    recipient_email?: string;
    amount: number;
    memo?: string;
    transaction_id?: string;
  }) => {
    const stmt = db.prepare(`
      INSERT INTO payments (expense_id, payment_method, recipient_email, amount, memo, transaction_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      data.expense_id,
      data.payment_method,
      data.recipient_email || null,
      data.amount,
      data.memo || null,
      data.transaction_id || null
    );
  },

  getByExpenseId: (expenseId: number) => {
    const stmt = db.prepare('SELECT * FROM payments WHERE expense_id = ? ORDER BY created_at DESC');
    return stmt.all(expenseId);
  },

  getAll: () => {
    const stmt = db.prepare(`
      SELECT p.*, e.company_name, e.amount as expense_amount
      FROM payments p
      JOIN expenses e ON p.expense_id = e.id
      ORDER BY p.created_at DESC
    `);
    return stmt.all();
  }
};

export default db;
