import { NextRequest, NextResponse } from 'next/server';
import { categoryOperations, expenseOperations } from '@/lib/db';

// MCP Server for Expense Management
// Implements the Model Context Protocol for expenses and categories

const MCP_VERSION = '1.0.0';

// Define available MCP tools
const TOOLS = [
  {
    name: 'expenses__list_categories',
    description: 'List all spending categories with their total spending amounts',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'expenses__create_category',
    description: 'Create a new spending category',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Category name (e.g., "Software", "Office Supplies")'
        },
        description: {
          type: 'string',
          description: 'Optional description of the category'
        },
        budget: {
          type: 'number',
          description: 'Optional monthly budget limit for this category'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'expenses__list_expenses',
    description: 'List all expenses, optionally filtered by category',
    inputSchema: {
      type: 'object',
      properties: {
        category_id: {
          type: 'number',
          description: 'Optional category ID to filter expenses'
        },
        status: {
          type: 'string',
          enum: ['pending', 'paid', 'cancelled'],
          description: 'Optional payment status filter'
        }
      },
      required: []
    }
  },
  {
    name: 'expenses__create_expense',
    description: 'Create a new expense entry',
    inputSchema: {
      type: 'object',
      properties: {
        company_name: {
          type: 'string',
          description: 'Name of the company/vendor'
        },
        amount: {
          type: 'number',
          description: 'Expense amount in dollars'
        },
        category_id: {
          type: 'number',
          description: 'ID of the category this expense belongs to'
        },
        sales_email: {
          type: 'string',
          description: 'Email address for payment'
        },
        due_date: {
          type: 'string',
          description: 'Due date in YYYY-MM-DD format'
        }
      },
      required: ['company_name', 'amount', 'category_id', 'sales_email']
    }
  },
  {
    name: 'expenses__get_expense',
    description: 'Get details of a specific expense by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Expense ID'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'expenses__update_expense',
    description: 'Update an existing expense',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Expense ID'
        },
        company_name: {
          type: 'string',
          description: 'Name of the company/vendor'
        },
        amount: {
          type: 'number',
          description: 'Expense amount in dollars'
        },
        category_id: {
          type: 'number',
          description: 'ID of the category'
        },
        sales_email: {
          type: 'string',
          description: 'Email address for payment'
        },
        due_date: {
          type: 'string',
          description: 'Due date in YYYY-MM-DD format'
        },
        status: {
          type: 'string',
          enum: ['pending', 'paid', 'cancelled'],
          description: 'Payment status'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'expenses__delete_expense',
    description: 'Delete an expense by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Expense ID to delete'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'expenses__get_spending_summary',
    description: 'Get a summary of spending by category',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// Handle tool execution
async function executeTool(toolName: string, input: any) {
  try {
    switch (toolName) {
      case 'expenses__list_categories': {
        const categories = categoryOperations.getWithSpending();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(categories, null, 2)
          }]
        };
      }

      case 'expenses__create_category': {
        const result = categoryOperations.create(
          input.name,
          input.description,
          input.budget
        );
        return {
          content: [{
            type: 'text',
            text: `Category created successfully with ID: ${result.lastInsertRowid}`
          }]
        };
      }

      case 'expenses__list_expenses': {
        let expenses = expenseOperations.getAll();
        
        if (input.category_id) {
          expenses = expenses.filter((e: any) => e.category_id === input.category_id);
        }
        
        if (input.status) {
          expenses = expenses.filter((e: any) => e.status === input.status);
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(expenses, null, 2)
          }]
        };
      }

      case 'expenses__create_expense': {
        const expense = expenseOperations.create({
          company_name: input.company_name,
          amount: input.amount,
          category_id: input.category_id,
          sales_email: input.sales_email,
          due_date: input.due_date || null,
          status: 'pending'
        });
        return {
          content: [{
            type: 'text',
            text: `Expense created successfully: ${JSON.stringify(expense, null, 2)}`
          }]
        };
      }

      case 'expenses__get_expense': {
        const expense = expenseOperations.getById(input.id);
        if (!expense) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Expense with ID ${input.id} not found`
            }]
          };
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(expense, null, 2)
          }]
        };
      }

      case 'expenses__update_expense': {
        const { id, ...updates } = input;
        const expense = expenseOperations.update(id, updates);
        if (!expense) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Expense with ID ${id} not found`
            }]
          };
        }
        return {
          content: [{
            type: 'text',
            text: `Expense updated successfully: ${JSON.stringify(expense, null, 2)}`
          }]
        };
      }

      case 'expenses__delete_expense': {
        expenseOperations.delete(input.id);
        return {
          content: [{
            type: 'text',
            text: `Expense ${input.id} deleted successfully`
          }]
        };
      }

      case 'expenses__get_spending_summary': {
        const categories = categoryOperations.getWithSpending();
        const summary = categories.map((cat: any) => ({
          category: cat.name,
          total_spent: cat.total_spent || 0,
          budget: cat.budget_limit || null
        }));
        
        const totalSpending = summary.reduce((sum: number, cat: any) => sum + (cat.total_spent || 0), 0);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              total_spending: totalSpending,
              by_category: summary
            }, null, 2)
          }]
        };
      }

      default:
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Unknown tool: ${toolName}`
          }]
        };
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}

// CORS headers for cross-origin MCP requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// POST endpoint - handle MCP requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jsonrpc, id, method, params } = body;

    // Support both JSON-RPC and simple method calls
    const actualMethod = method || params?.method;
    const actualParams = params?.params || params;

    let result: any;

    switch (actualMethod) {
      case 'initialize':
        result = {
          protocolVersion: MCP_VERSION,
          serverInfo: {
            name: 'expenses-mcp-server',
            version: '1.0.0'
          },
          capabilities: {
            tools: {}
          }
        };
        break;

      case 'tools/list':
        result = {
          tools: TOOLS
        };
        break;

      case 'tools/call': {
        const { name, arguments: toolArgs } = actualParams || params;
        result = await executeTool(name, toolArgs || {});
        break;
      }

      default:
        return NextResponse.json({
          jsonrpc: jsonrpc || '2.0',
          id: id || null,
          error: { 
            code: -32601, 
            message: `Method not found: ${actualMethod}` 
          }
        }, { 
          status: 400, 
          headers: corsHeaders 
        });
    }

    // Return in JSON-RPC format if requested
    if (jsonrpc) {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: id || null,
        result
      }, { headers: corsHeaders });
    }

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    console.error('MCP Server Error:', error);
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal server error'
      }
    }, { 
      status: 500,
      headers: corsHeaders 
    });
  }
}

// GET endpoint - return server info
export async function GET() {
  return NextResponse.json({
    name: 'Expense Management MCP Server',
    version: MCP_VERSION,
    tools: TOOLS.map(t => ({
      name: t.name,
      description: t.description
    }))
  }, { headers: corsHeaders });
}

