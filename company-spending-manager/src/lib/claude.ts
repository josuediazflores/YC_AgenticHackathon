import 'dotenv/config';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { IterableResponse } from '@anthropic-ai/claude-agent-sdk';

// MCP Server configuration for Locus
const mcpServers = {
  'locus': {
    type: 'http' as const,
    url: 'https://mcp.paywithlocus.com/mcp',
    headers: {
      'Authorization': `Bearer ${process.env.LOCUS_API_KEY}`
    }
  }
};

// Claude SDK options
const options = {
  mcpServers,
  allowedTools: [
    'mcp__locus__*',      // Allow all Locus tools
    'mcp__list_resources',
    'mcp__read_resource'
  ],
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Auto-approve Locus tool usage
  canUseTool: async (toolName: string, input: Record<string, unknown>) => {
    if (toolName.startsWith('mcp__locus__')) {
      return {
        behavior: 'allow' as const,
        updatedInput: input
      };
    }
    return {
      behavior: 'deny' as const,
      message: 'Only Locus tools are allowed'
    };
  }
};

export async function sendClaudeMessage(prompt: string): Promise<string> {
  let finalResult = '';
  let mcpConnected = false;

  for await (const message of query({ prompt, options })) {
    if (message.type === 'system' && message.subtype === 'init') {
      // Check MCP connection status
      const mcpServersInfo = (message as any).mcp_servers;
      const mcpStatus = mcpServersInfo?.find((s: any) => s.name === 'locus');
      mcpConnected = mcpStatus?.status === 'connected';
    } else if (message.type === 'result' && message.subtype === 'success') {
      finalResult = (message as any).result;
    }
  }

  if (!mcpConnected) {
    console.warn('MCP connection to Locus failed');
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
    Extract the following information from this invoice text:
    1. Company name
    2. Total amount (in USD)
    3. Sales/billing email
    4. Due date (format as YYYY-MM-DD)
    5. Suggested category

    Existing categories: ${categoriesList}

    If the invoice fits an existing category, use that. Otherwise, suggest a new category name.

    Invoice text:
    ${invoiceText}

    Return the data as a JSON object with these keys: company_name, amount, sales_email, due_date, category, isNewCategory (boolean).
    If any field cannot be determined, set it to null.
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

// Helper function to process natural language queries
export async function processExpenseQuery(query: string, context: {
  categories: any[];
  expenses: any[];
  payments: any[];
}): Promise<string> {
  const prompt = `
    You are a helpful spending management assistant. Answer the following query based on the provided data:
    
    Query: ${query}
    
    Context:
    - Categories: ${JSON.stringify(context.categories, null, 2)}
    - Expenses: ${JSON.stringify(context.expenses, null, 2)}
    - Recent Payments: ${JSON.stringify(context.payments, null, 2)}
    
    Provide a clear and concise answer.
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
