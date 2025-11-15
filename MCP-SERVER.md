# Expense Management MCP Server

This project includes a custom **Model Context Protocol (MCP) server** for expense and category management, which runs alongside the Locus MCP server for payments.

## What is MCP?

The Model Context Protocol (MCP) is a standardized way for AI models to interact with external tools and services. Instead of passing data through prompts, the AI can directly call MCP tools to perform actions like creating expenses, listing categories, or sending payments.

## Architecture

```
┌─────────────────────────────────────────┐
│         Claude Agent SDK                │
│                                         │
│  ┌───────────────┐  ┌───────────────┐  │
│  │  Locus MCP    │  │ Expenses MCP  │  │
│  │   (Payments)  │  │  (Categories/ │  │
│  │               │  │   Expenses)   │  │
│  └───────────────┘  └───────────────┘  │
└─────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   External Service      Next.js API
   (Locus Payments)     (/api/mcp)
```

## Available MCP Tools

### Category Management

#### `mcp__expenses__list_categories`
- **Description**: List all spending categories with their total spending amounts
- **Parameters**: None
- **Returns**: Array of categories with spending data

#### `mcp__expenses__create_category`
- **Description**: Create a new spending category
- **Parameters**:
  - `name` (string, required): Category name
  - `description` (string, optional): Category description
  - `budget` (number, optional): Monthly budget limit
- **Returns**: Created category object

### Expense Management

#### `mcp__expenses__list_expenses`
- **Description**: List all expenses, optionally filtered
- **Parameters**:
  - `category_id` (number, optional): Filter by category
  - `status` (string, optional): Filter by status ('pending', 'paid', 'cancelled')
- **Returns**: Array of expenses

#### `mcp__expenses__create_expense`
- **Description**: Create a new expense entry
- **Parameters**:
  - `company_name` (string, required): Vendor/company name
  - `amount` (number, required): Expense amount in dollars
  - `category_id` (number, required): Category ID
  - `sales_email` (string, required): Email for payment
  - `due_date` (string, optional): Due date in YYYY-MM-DD format
- **Returns**: Created expense object

#### `mcp__expenses__get_expense`
- **Description**: Get details of a specific expense
- **Parameters**:
  - `id` (number, required): Expense ID
- **Returns**: Expense object

#### `mcp__expenses__update_expense`
- **Description**: Update an existing expense
- **Parameters**:
  - `id` (number, required): Expense ID
  - `company_name` (string, optional): Updated company name
  - `amount` (number, optional): Updated amount
  - `category_id` (number, optional): Updated category
  - `sales_email` (string, optional): Updated email
  - `due_date` (string, optional): Updated due date
  - `status` (string, optional): Updated status
- **Returns**: Updated expense object

#### `mcp__expenses__delete_expense`
- **Description**: Delete an expense
- **Parameters**:
  - `id` (number, required): Expense ID to delete
- **Returns**: Success message

### Analytics

#### `mcp__expenses__get_spending_summary`
- **Description**: Get a summary of spending by category
- **Parameters**: None
- **Returns**: Object with total spending and per-category breakdown

## Testing the MCP Server

### 1. Check Server Status

Visit `http://localhost:3000/api/mcp` (GET) to see available tools:

```bash
curl http://localhost:3000/api/mcp
```

### 2. Test Tool Execution

```bash
# List all categories
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "expenses__list_categories",
      "arguments": {}
    }
  }'

# Create a new category
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "expenses__create_category",
      "arguments": {
        "name": "Software",
        "description": "Software subscriptions and licenses",
        "budget": 5000
      }
    }
  }'

# Create an expense
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "expenses__create_expense",
      "arguments": {
        "company_name": "Acme Corp",
        "amount": 1500,
        "category_id": 1,
        "sales_email": "billing@acme.com",
        "due_date": "2024-12-31"
      }
    }
  }'
```

## Claude Agent Integration

The MCP server is automatically configured in the Claude Agent SDK (see `src/lib/claude.ts`):

```typescript
const mcpServers = {
  'locus': {
    type: 'http',
    url: 'https://mcp.paywithlocus.com/mcp',
    headers: {
      'Authorization': `Bearer ${process.env.LOCUS_API_KEY}`
    }
  },
  'expenses': {
    type: 'http',
    url: 'http://localhost:3000/api/mcp',
    headers: {
      'Content-Type': 'application/json'
    }
  }
};
```

The AI can now use tools from both servers:
- **Locus tools**: `mcp__locus__send_to_email`, `mcp__locus__get_payment_context`, etc.
- **Expenses tools**: `mcp__expenses__*` (all tools listed above)

## Example AI Interactions

User: **"Show me all my expenses"**
→ AI calls `mcp__expenses__list_expenses`

User: **"Create an expense for that invoice"**
→ AI calls `mcp__expenses__create_expense` with extracted data

User: **"How much did we spend on Software?"**
→ AI calls `mcp__expenses__get_spending_summary` and filters results

User: **"Pay the TechSupplies invoice"**
→ AI:
  1. Finds expense using `mcp__expenses__list_expenses`
  2. Sends payment using `mcp__locus__send_to_email`
  3. Updates expense status using `mcp__expenses__update_expense`

## Deployment

When deploying to production:

1. Set the `EXPENSES_MCP_URL` environment variable to your deployed URL:
   ```
   EXPENSES_MCP_URL=https://your-app.vercel.app/api/mcp
   ```

2. The MCP server will be accessible at that URL for the Claude Agent SDK

3. Ensure your API routes are protected if needed (add authentication middleware)

## Benefits of MCP Architecture

1. **Standardized Interface**: Tools follow a consistent protocol
2. **Automatic Tool Discovery**: AI knows what tools are available
3. **Type Safety**: Input schemas ensure correct parameters
4. **Separation of Concerns**: Business logic separated from AI prompting
5. **Reusability**: MCP tools can be used by other AI applications
6. **Multi-Server Support**: Can combine tools from multiple MCP servers (Locus + Expenses)

