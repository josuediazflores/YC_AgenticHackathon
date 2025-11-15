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
});

export async function sendClaudeMessage(prompt: string): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
    });

    const textContent = message.content.find(block => block.type === 'text');
    return textContent && textContent.type === 'text' ? textContent.text : '';
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw error;
  }
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

// Helper function to process natural language queries
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
    You are a helpful spending management assistant with access to the company's expense data and conversation history.
    Answer the following query based on the provided data and previous conversation context:

    Current Query: ${query}
    ${chatHistoryText}

    Available Data:
    - Categories: ${JSON.stringify(context.categories, null, 2)}
    - Expenses: ${JSON.stringify(context.expenses, null, 2)}
    - Recent Payments: ${JSON.stringify(context.payments, null, 2)}

    Instructions:
    - Reference information from the conversation history when relevant (especially invoice details)
    - If the user asks about a recently uploaded invoice, use the invoice data from the chat history
    - Provide clear, concise, and helpful answers
    - If asked to create an expense, confirm the details first
    - For payment questions, check the expenses and payment status
  `;

  return sendClaudeMessage(prompt);
}

// Helper function to get payment context from Locus
export async function getLocusPaymentContext() {
  // Note: This requires MCP integration with Locus via Claude Agent SDK
  // For now, return a placeholder response
  return "Locus payment context: MCP integration required for real-time data. Please use the direct Locus API or configure MCP servers.";
}

// Helper function to send payment via Locus
export async function sendLocusPayment(email: string, amount: number, memo: string) {
  // Note: This requires MCP integration with Locus via Claude Agent SDK
  // For now, return a simulated response
  console.log(`[Simulated] Would send ${amount} USDC to ${email} with memo: "${memo}"`);
  return `Payment simulation: Would send ${amount} USDC to ${email}. For actual payments, please integrate with Locus MCP server or use direct API calls.`;
}
