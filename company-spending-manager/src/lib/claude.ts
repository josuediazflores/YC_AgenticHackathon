import 'dotenv/config';
import { query } from '@anthropic-ai/claude-agent-sdk';

// MCP Server configuration for Locus + our custom Expenses server
const mcpServers: any = {
  'locus': {
    type: 'http' as const,
    url: 'https://mcp.paywithlocus.com/mcp',
    headers: {
      'Authorization': `Bearer ${process.env.LOCUS_API_KEY}`
    }
  },
  'expenses': {
    type: 'sse' as const,
    url: 'https://dev.excused.ai/sse'
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
    You are a helpful spending management assistant with access to MCP tools for managing expenses and making payments.
    
    Current User Query: ${query}
    ${chatHistoryText}
    
    Available Expense Management Tools (mcp__expenses__*):
    - list_categories - List all spending categories with totals
    - create_category - Create a new spending category
    - update_category_budget - Update the budget limit for a category
    - list_expenses - List all expenses (can filter by category or status)
    - create_expense - Create a new expense entry
    - get_expense - Get details of a specific expense
    - update_expense - Update an existing expense (including status change to 'paid')
    - delete_expense - Delete an expense
    - get_spending_summary - Get a summary of spending by category
    
    Available Payment Tools (mcp__locus__*):
    - send_to_email - Send USDC payment to an email address
      Arguments: {amount: number, recipient_email: string, memo?: string}
    - get_payment_context - Get current payment budget and whitelisted contacts
    
    Email Sending Capability:
    - You CAN send emails on behalf of the user using the send_email action
    - When the user asks to send an email (including "test email", "send email to [address]", etc.), format it professionally
    - The user's email address is: YC@testing.james.baby
    - Format emails with:
      * Clear, professional subject line (use "Test Email" for test emails)
      * Appropriate greeting (Dear/Hi/Hello based on formality)
      * Well-structured body with clear purpose
      * Professional closing with contact information
    - For test emails, use a simple, friendly message
    - Include relevant context from the conversation when appropriate
    - If the user asks to send an email, DO NOT say you can't - the system can send emails
    
    Instructions:
    - Use MCP tools to fetch or modify expense data
    - Reference conversation history for context (especially invoice details)
    - When user asks to PAY an expense:
      1. Find the expense using list_expenses or get_expense
      2. Use mcp__locus__send_to_email to send payment
      3. Update expense status to 'paid' using update_expense
    - When creating expenses, ensure category exists or create it first
    - When user asks to change/update a category budget, use update_category_budget
    
    CRITICAL: You MUST respond with ONLY valid JSON in this exact format:
    {
      "response": "your helpful message to the user here",
      "expense": {
        "company": "company name",
        "amount": "1.99",
        "email": "email@example.com",
        "status": "pending|paid"
      }
    }
    
    The "expense" field should be:
    - null if not relevant to current conversation
    - An object with expense details if you're showing/creating/updating an expense
    - Used when user uploads invoice, asks about specific expense, creates expense, or pays
    
    IMPORTANT: When "expense" is NOT null, do NOT repeat the expense details in "response".
    The expense card will display the details automatically. Just say something conversational.
    
    Example responses:
    1. User: "Show me my expenses" → {"response": "You have 3 pending expenses totaling $2,500", "expense": null}
    2. User uploads invoice → {"response": "I've extracted the invoice details for you. Would you like me to create this expense?", "expense": {"company": "TechSupplies", "amount": "891.00", "email": "billing@tech.com", "status": "pending"}}
    3. User: "Pay expense #5" → {"response": "Payment sent successfully! The expense has been marked as paid.", "expense": {"company": "TechSupplies", "amount": "891.00", "email": "billing@tech.com", "status": "paid"}}
    
    BAD: "**Invoice Details:** Company: X, Amount: $Y..." ← DON'T do this when expense object exists
    GOOD: "I've processed the invoice for you!" ← Keep it conversational
    
    Return ONLY the JSON, no markdown, no extra text.
  `;

  const result = await sendClaudeMessage(prompt);
  
  // Extract JSON from response
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return JSON.stringify(parsed);
    }
  } catch (e) {
    // If JSON parsing fails, wrap in default format
    return JSON.stringify({
      response: result,
      expense: null
    });
  }
  
  return result;
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
