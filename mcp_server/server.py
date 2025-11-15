"""
Expense Management MCP Server
Built with FastMCP - https://gofastmcp.com/

This server provides MCP tools for managing expenses and categories,
designed to work alongside the Locus MCP server for payment processing.
"""

import sqlite3
from pathlib import Path
from typing import Optional, List
from contextlib import contextmanager
from fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("Expense Management", version="1.0.0")

# Database path - looks for the database in the Next.js project
DB_PATH = Path(__file__).parent.parent / "spending.db"

@contextmanager
def get_db():
    """Context manager for database connections"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# ============================================================================
# CATEGORY TOOLS
# ============================================================================

@mcp.tool()
def list_categories() -> str:
    """
    List all spending categories with their total spending amounts.
    
    Returns:
        JSON string with array of categories including id, name, description, 
        budget_limit, and total_spent.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                c.*,
                COALESCE(SUM(e.amount), 0) as total_spent
            FROM categories c
            LEFT JOIN expenses e ON c.id = e.category_id AND e.status = 'paid'
            GROUP BY c.id
            ORDER BY c.created_at DESC
        """)
        
        categories = []
        for row in cursor.fetchall():
            categories.append({
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "budget_limit": row["budget_limit"],
                "created_at": row["created_at"],
                "total_spent": row["total_spent"]
            })
        
        import json
        return json.dumps(categories, indent=2)

@mcp.tool()
def create_category(
    name: str,
    description: Optional[str] = None,
    budget: Optional[float] = None
) -> str:
    """
    Create a new spending category.
    
    Args:
        name: Category name (e.g., "Software", "Office Supplies")
        description: Optional description of the category
        budget: Optional monthly budget limit for this category
    
    Returns:
        Success message with the created category ID
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO categories (name, description, budget_limit) VALUES (?, ?, ?)",
            (name, description, budget)
        )
        conn.commit()
        category_id = cursor.lastrowid
        
        return f"Category '{name}' created successfully with ID: {category_id}"

# ============================================================================
# EXPENSE TOOLS
# ============================================================================

@mcp.tool()
def list_expenses(
    category_id: Optional[int] = None,
    status: Optional[str] = None
) -> str:
    """
    List all expenses, optionally filtered by category and/or status.
    
    Args:
        category_id: Optional category ID to filter expenses
        status: Optional payment status filter ('pending', 'paid', 'cancelled')
    
    Returns:
        JSON string with array of expenses
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        query = "SELECT * FROM expenses WHERE 1=1"
        params = []
        
        if category_id is not None:
            query += " AND category_id = ?"
            params.append(category_id)
        
        if status:
            query += " AND status = ?"
            params.append(status)
        
        query += " ORDER BY created_at DESC"
        
        cursor.execute(query, params)
        
        expenses = []
        for row in cursor.fetchall():
            expenses.append({
                "id": row["id"],
                "category_id": row["category_id"],
                "company_name": row["company_name"],
                "amount": row["amount"],
                "sales_email": row["sales_email"],
                "due_date": row["due_date"],
                "status": row["status"],
                "invoice_url": row["invoice_url"],
                "created_at": row["created_at"]
            })
        
        import json
        return json.dumps(expenses, indent=2)

@mcp.tool()
def create_expense(
    company_name: str,
    amount: float,
    category_id: int,
    sales_email: str,
    due_date: Optional[str] = None
) -> str:
    """
    Create a new expense entry.
    
    Args:
        company_name: Name of the company/vendor
        amount: Expense amount in dollars
        category_id: ID of the category this expense belongs to
        sales_email: Email address for payment
        due_date: Due date in YYYY-MM-DD format (optional)
    
    Returns:
        Success message with the created expense ID
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO expenses (category_id, company_name, amount, sales_email, due_date, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
            """,
            (category_id, company_name, amount, sales_email, due_date)
        )
        conn.commit()
        expense_id = cursor.lastrowid
        
        return f"Expense for {company_name} (${amount}) created successfully with ID: {expense_id}"

@mcp.tool()
def get_expense(id: int) -> str:
    """
    Get details of a specific expense by ID.
    
    Args:
        id: Expense ID
    
    Returns:
        JSON string with expense details or error message if not found
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM expenses WHERE id = ?", (id,))
        row = cursor.fetchone()
        
        if not row:
            return f"Error: Expense with ID {id} not found"
        
        expense = {
            "id": row["id"],
            "category_id": row["category_id"],
            "company_name": row["company_name"],
            "amount": row["amount"],
            "sales_email": row["sales_email"],
            "due_date": row["due_date"],
            "status": row["status"],
            "invoice_url": row["invoice_url"],
            "created_at": row["created_at"]
        }
        
        import json
        return json.dumps(expense, indent=2)

@mcp.tool()
def update_expense(
    id: int,
    company_name: Optional[str] = None,
    amount: Optional[float] = None,
    category_id: Optional[int] = None,
    sales_email: Optional[str] = None,
    due_date: Optional[str] = None,
    status: Optional[str] = None
) -> str:
    """
    Update an existing expense.
    
    Args:
        id: Expense ID to update
        company_name: Updated company name (optional)
        amount: Updated expense amount (optional)
        category_id: Updated category ID (optional)
        sales_email: Updated email address (optional)
        due_date: Updated due date in YYYY-MM-DD format (optional)
        status: Updated status - 'pending', 'paid', or 'cancelled' (optional)
    
    Returns:
        Success message or error if expense not found
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # First check if expense exists
        cursor.execute("SELECT id FROM expenses WHERE id = ?", (id,))
        if not cursor.fetchone():
            return f"Error: Expense with ID {id} not found"
        
        # Build update query dynamically
        updates = []
        params = []
        
        if company_name is not None:
            updates.append("company_name = ?")
            params.append(company_name)
        if amount is not None:
            updates.append("amount = ?")
            params.append(amount)
        if category_id is not None:
            updates.append("category_id = ?")
            params.append(category_id)
        if sales_email is not None:
            updates.append("sales_email = ?")
            params.append(sales_email)
        if due_date is not None:
            updates.append("due_date = ?")
            params.append(due_date)
        if status is not None:
            updates.append("status = ?")
            params.append(status)
        
        if not updates:
            return "No fields to update"
        
        params.append(id)
        query = f"UPDATE expenses SET {', '.join(updates)} WHERE id = ?"
        
        cursor.execute(query, params)
        conn.commit()
        
        return f"Expense {id} updated successfully"

@mcp.tool()
def delete_expense(id: int) -> str:
    """
    Delete an expense by ID.
    
    Args:
        id: Expense ID to delete
    
    Returns:
        Success message or error if expense not found
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM expenses WHERE id = ?", (id,))
        conn.commit()
        
        if cursor.rowcount == 0:
            return f"Error: Expense with ID {id} not found"
        
        return f"Expense {id} deleted successfully"

# ============================================================================
# ANALYTICS TOOLS
# ============================================================================

@mcp.tool()
def get_spending_summary() -> str:
    """
    Get a summary of spending by category.
    
    Returns:
        JSON string with total spending and breakdown by category
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                c.name as category,
                c.budget_limit as budget,
                COALESCE(SUM(e.amount), 0) as total_spent,
                COUNT(e.id) as expense_count
            FROM categories c
            LEFT JOIN expenses e ON c.id = e.category_id AND e.status = 'paid'
            GROUP BY c.id
            ORDER BY total_spent DESC
        """)
        
        summary = []
        total_spending = 0
        
        for row in cursor.fetchall():
            total_spent = row["total_spent"] or 0
            total_spending += total_spent
            
            summary.append({
                "category": row["category"],
                "total_spent": total_spent,
                "expense_count": row["expense_count"],
                "budget": row["budget"]
            })
        
        result = {
            "total_spending": total_spending,
            "by_category": summary
        }
        
        import json
        return json.dumps(result, indent=2)

# ============================================================================
# SERVER STARTUP
# ============================================================================

if __name__ == "__main__":
    import os
    
    # Get port from environment or use default
    port = int(os.getenv("MCP_PORT", "8000"))
    
    # Ensure database exists
    if not DB_PATH.exists():
        print(f"⚠️  Warning: Database not found at {DB_PATH}")
        print("   The database will be created automatically when the Next.js app runs.")
        print("   Make sure to run `npm run dev` in the Next.js project first.\n")
    
    # Run the MCP server with SSE (Server-Sent Events) transport
    print("🚀 Starting Expense Management MCP Server...")
    print(f"📁 Database: {DB_PATH}")
    print(f"🔧 Tools available: {len(mcp._tool_manager._tools)}")
    print(f"\n✨ Server ready!")
    print(f"   HTTP SSE: http://localhost:{port}/sse")
    print(f"   Health:   http://localhost:{port}/health")
    print(f"   Tools:    http://localhost:{port}/tools\n")
    
    # Use SSE transport for HTTP streaming
    mcp.run(transport="sse", port=port)

