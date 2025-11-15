import 'dotenv/config';
import { query } from '@anthropic-ai/claude-agent-sdk';

// MCP Server configuration for Locus + our custom Expenses server
const mcpServers = {
  'locus': {
    type: 'http' as const,
    url: 'https://mcp.paywithlocus.com/mcp',
    headers: {
      'Authorization': `Bearer ${process.env.LOCUS_API_KEY}`
    }
  },
  'expenses': {
    type: 'http' as const,
    url: process.env.EXPENSES_MCP_URL || 'http://localhost:3000/api/mcp',
    headers: {
      'Content-Type': 'application/json'
    }
  }
};

// Claude SDK options
const options = {
  mcpServers,
  allowedTools: [
    'mcp__locus__*',      // Allow all Locus payment tools
    'mcp__expenses__*',   // Allow all expense management tools
    'mcp__list_resources',
    'mcp__read_resource'
  ],
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Auto-approve tool usage for both Locus and Expenses
  canUseTool: async (toolName: string, input: Record<string, unknown>) => {
    if (toolName.startsWith('mcp__locus__') || toolName.startsWith('mcp__expenses__')) {
      return {
        behavior: 'allow' as const,
        updatedInput: input
      };
    }
    return {
      behavior: 'deny' as const,
      message: 'Only Locus and Expenses tools are allowed'
    };
  }
};

export async function sendClaudeMessage(prompt: string): Promise<string> {
  let finalResult = '';
  let locusConnected = false;
  let expensesConnected = false;

  for await (const message of query({ prompt, options })) {
    if (message.type === 'system' && message.subtype === 'init') {
      // Check MCP connection status for both servers
      const mcpServersInfo = (message as any).mcp_servers;
      const locusStatus = mcpServersInfo?.find((s: any) => s.name === 'locus');
      const expensesStatus = mcpServersInfo?.find((s: any) => s.name === 'expenses');
      
      locusConnected = locusStatus?.status === 'connected';
      expensesConnected = expensesStatus?.status === 'connected';
      
      console.log('MCP Status:', {
        locus: locusConnected ? 'connected' : 'disconnected',
        expenses: expensesConnected ? 'connected' : 'disconnected'
      });
    } else if (message.type === 'result' && message.subtype === 'success') {
      finalResult = (message as any).result;
    }
  }

  if (!locusConnected) {
    console.warn('MCP connection to Locus failed');
  }
  if (!expensesConnected) {
    console.warn('MCP connection to Expenses server failed');
  }

  return finalResult;
}

// Helper function to extract invoice data
export async function extractInvoiceData(invoiceText: string, existingCategories: string[]): Promise<{
  company_name?: string;
  amount?: number;
  sales_email?: string;
  due_date?: string;
  category?: string;
  isNewCategory?: boolean;
}> {
  const categoriesList = existingCategories.length > 0 
    ? existingCategories.join(', ') 
    : 'No existing categories';

  const prompt = `
    You are an invoice data extraction assistant. Extract the following information from the provided invoice text:
    
    Information to extract:
    1. Company/Vendor name (the company issuing the invoice)
    2. Total amount due (in USD, look for total, amount due, balance due)
    3. Sales/billing email address (look for contact emails, billing@, sales@, info@, support@)
    4. Due date (convert to YYYY-MM-DD format)
    5. Category (suggest from existing or create new)

    Existing categories: ${categoriesList}

    Instructions:
    - Look for common invoice patterns like "Invoice From:", "Bill To:", "Total:", "Amount Due:", etc.
    - For emails, look for any email addresses in the document, especially those with domains matching the company
    - For dates, look for "Due Date:", "Payment Due:", "Due By:" patterns
    - If the invoice fits an existing category, use that. Otherwise, suggest a descriptive new category.
    - Be thorough in scanning the entire text for relevant information.

    Invoice text:
    ${invoiceText}

    Return ONLY a JSON object with these exact keys: company_name, amount (as number), sales_email, due_date (YYYY-MM-DD), category, isNewCategory (boolean).
    If any field cannot be determined from the text, set it to null.
    Example: {"company_name": "Acme Corp", "amount": 1500.00, "sales_email": "billing@acme.com", "due_date": "2024-01-15", "category": "Software", "isNewCategory": false}
  `;

  const response = await sendClaudeMessage(prompt);
  
  try {
    // Extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return {
        company_name: data.company_name || undefined,
        amount: data.amount ? parseFloat(data.amount) : undefined,
        sales_email: data.sales_email || undefined,
        due_date: data.due_date || undefined,
        category: data.category || undefined,
        isNewCategory: data.isNewCategory || false
      };
    }
  } catch (error) {
    console.error('Error parsing invoice data:', error);
  }

  return {};
}

// Helper function to process natural language queries using MCP tools
export async function processExpenseQuery(query: string, context: {
  categories: any[];
  expenses: any[];
  payments: any[];
  chatHistory?: Array<{ role: string; content: string }>;
}): Promise<string> {
  let chatHistoryText = '';
  if (context.chatHistory && context.chatHistory.length > 0) {
    chatHistoryText = '\n\nRecent Conversation:\n';
    context.chatHistory.forEach(msg => {
      chatHistoryText += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    });
  }

  const prompt = `
    You are a helpful spending management assistant with access to MCP tools for managing expenses and categories.
    
    Current User Query: ${query}
    ${chatHistoryText}
    
    Available MCP Tools:
    - mcp__expenses__list_categories - List all spending categories with totals
    - mcp__expenses__create_category - Create a new spending category
    - mcp__expenses__list_expenses - List all expenses (can filter by category or status)
    - mcp__expenses__create_expense - Create a new expense entry
    - mcp__expenses__get_expense - Get details of a specific expense
    - mcp__expenses__update_expense - Update an existing expense
    - mcp__expenses__delete_expense - Delete an expense
    - mcp__expenses__get_spending_summary - Get a summary of spending by category
    
    Instructions:
    - Use the MCP tools to fetch or modify expense data as needed
    - Reference information from the conversation history when relevant (especially invoice details from uploads)
    - If the user asks about expenses, categories, or spending, use the appropriate MCP tool
    - If asked to create an expense from a recently uploaded invoice, extract the data from chat history and use mcp__expenses__create_expense
    - For payment-related questions, check the expense payment status
    - Provide clear, helpful, and concise responses
    - When creating expenses, make sure to use an existing category_id or create a new category first
    
    Example flows:
    1. "Show me my expenses" → Use mcp__expenses__list_expenses
    2. "Create an expense for that invoice" → Extract invoice data from chat history, create category if needed, then use mcp__expenses__create_expense
    3. "How much did we spend on Software?" → Use mcp__expenses__get_spending_summary and filter results
    4. "Add a new category called Marketing" → Use mcp__expenses__create_category
  `;

  return sendClaudeMessage(prompt);
}

// Helper function to get payment context from Locus
export async function getLocusPaymentContext() {
  const prompt = "Use the mcp__locus__get_payment_context tool to get the current payment context including budget and whitelisted contacts.";
  return sendClaudeMessage(prompt);
}

// Helper function to send payment via Locus
export async function sendLocusPayment(email: string, amount: number, memo: string) {
  const prompt = `Use the mcp__locus__send_to_email tool to send ${amount} USDC to ${email} with memo: "${memo}"`;
  return sendClaudeMessage(prompt);
}
