# flowcoin

AI-powered spending management with seamless USDC payments. Upload invoices, auto-categorize expenses, and send payments instantly through an intelligent chatbot interface.

## Features

- **AI Chatbot Interface**: Natural language interaction for managing expenses and payments
- **Invoice Processing**: Drag-and-drop invoice upload with AI-powered data extraction
- **Expense Management**: Organize expenses by categories with budget tracking
- **Payment Automation**: Send USDC payments directly to vendors via email
- **Real-time Analytics**: Track spending across categories with visual insights
- **Dark/Light Mode**: Beautiful UI with theme toggle support

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components, Framer Motion
- **AI Integration**: Claude Agents SDK with Model Context Protocol (MCP)
  - Custom MCP Server for expense/category management
  - Locus MCP Server for USDC payments
- **Database**: SQLite with better-sqlite3
- **Payments**: Locus for USDC transactions

## Architecture

This app uses a **dual MCP (Model Context Protocol) server architecture**:

1. **Custom Expenses MCP Server** (Python with FastMCP) - Provides tools for:
   - Creating and managing categories
   - Creating, updating, and deleting expenses
   - Querying spending summaries
   - Filtering expenses by category and status
   - **Location**: `mcp_server/server.py`
   - **Framework**: [FastMCP](https://gofastmcp.com/) - The standard Python MCP framework

2. **Locus MCP Server** (external) - Provides tools for:
   - Sending USDC payments to email addresses
   - Checking payment context and balances
   - Managing whitelisted contacts

### Why Separate Python MCP Server?

- **Standard Implementation**: Built with FastMCP, the official Python MCP framework
- **Independent Operation**: Run and debug separately from the Next.js app
- **Better Performance**: Optimized for MCP protocol
- **Easy Deployment**: Deploy to different infrastructure than the web app
- **Flexible Transport**: Supports both stdio (local) and HTTP (deployed)

### Connection Flow

```
┌─────────────────────────────────────────┐
│    Next.js App (localhost:3000)         │
│                                         │
│    ┌─────────────────────────────┐     │
│    │   Claude Agent SDK          │     │
│    │                             │     │
│    │  ┌────────┐   ┌──────────┐ │     │
│    │  │ Locus  │   │ Expenses │ │     │
│    │  │  MCP   │   │   MCP    │ │     │
│    │  └────────┘   └──────────┘ │     │
│    └─────────────────────────────┘     │
└─────────────────────────────────────────┘
         │                    │
         │ HTTPS              │ HTTP SSE (streaming)
         ▼                    ▼
   Locus API          Python FastMCP Server
  (External)          (localhost:8000/sse)
                              │
                              ▼
                        SQLite Database
                        (spending.db)
```

The Claude Agent SDK connects to both servers simultaneously, allowing the AI to seamlessly perform both expense management and payment operations. For detailed information about the Python MCP implementation, see [mcp_server/README.md](./mcp_server/README.md).

## Prerequisites

- **Node.js 18+** and npm
- **Python 3.9+** and pip (for the MCP server)
- **Anthropic API key** for Claude
- **Locus API key** for payment processing

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd company-spending-manager
```

2. Install dependencies:
```bash
npm install
```

3. Set up Python MCP Server (for expense management):
```bash
cd mcp_server
pip install -r requirements.txt
cd ..
```

4. Set up environment variables:
```bash
cp env.example .env.local
```

Edit `.env.local` and add your API keys:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key
LOCUS_API_KEY=your_locus_api_key

# Python MCP server URL (runs on port 8000 by default)
# For local: http://localhost:8000/sse
# For deployed: https://your-mcp-server.com/sse
EXPENSES_MCP_URL=http://localhost:8000/sse

DATABASE_URL=./spending.db
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

5. Start the Python MCP Server (in a separate terminal):
```bash
cd mcp_server
python server.py
```

You should see:
```
🚀 Starting Expense Management MCP Server...
📁 Database: /path/to/spending.db
🔧 Tools available: 8

✨ Server ready!
   HTTP SSE: http://localhost:8000/sse
   Health:   http://localhost:8000/health
   Tools:    http://localhost:8000/tools
```

6. Start the Next.js development server (in another terminal):
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

The Next.js app will connect to the Python MCP server via HTTP SSE for streaming responses.

### Testing the MCP Server Independently

To test the Python MCP server on its own:

```bash
cd mcp_server
python test_mcp.py
```

This will run through all 8 MCP tools and verify they're working correctly.

## Usage

### Chat Interface (Ask Tab)

The main interface is a conversational AI assistant that helps you:

- **Upload Invoices**: Drag and drop invoice files (PDF/images) to automatically extract data
- **Query Expenses**: Ask questions like "What's our marketing spend this month?"
- **Make Payments**: Use commands like "pay expense #123" or "send $500 to vendor@email.com"

Example commands:
- "Show me all pending payments"
- "What's our total spending this month?"
- "Pay expense #5"
- "Send $1000 USDC to accounting@vendor.com"

### Categories Management

- Create spending categories with optional budget limits
- View aggregated spending per category
- Track budget utilization with visual indicators
- Automatic alerts when approaching budget limits

### Expenses Tracking

- View all expenses in a sortable, filterable table
- Filter by category, status (pending/paid/cancelled)
- One-click payment processing
- Direct invoice viewing

## API Endpoints

### REST APIs
- `GET/POST /api/categories` - Category management
- `GET/POST /api/expenses` - Expense operations
- `POST /api/expenses/[id]/pay` - Process payments
- `POST /api/invoices/upload` - Invoice file upload
- `POST /api/invoices/extract` - Extract text from PDF invoices
- `POST /api/agent` - Claude AI agent interactions

### MCP Server
- `GET /api/mcp` - View available MCP tools
- `POST /api/mcp` - Execute MCP tools (used by Claude Agent SDK)
  - Method: `tools/list` - List available tools with schemas
  - Method: `tools/call` - Execute a specific tool
  - Method: `initialize` - Initialize MCP connection

Example MCP tool call:
```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "expenses__list_categories",
      "arguments": {}
    }
  }'
```

See [MCP-SERVER.md](./MCP-SERVER.md) for detailed MCP documentation.

## Project Structure

```
src/
├── app/
│   ├── api/          # API routes
│   ├── (dashboard)/  # Dashboard pages
│   └── layout.tsx    # Root layout
├── components/
│   └── ui/          # Reusable UI components
└── lib/             # Utilities and configurations
    ├── claude.ts    # Claude Agent setup
    ├── db.ts        # Database operations
    └── locus.ts     # Payment utilities
```

## Payment Processing

The app integrates with Locus to enable USDC payments:

1. **Email Payments**: Send directly to vendor email addresses
2. **Escrow System**: Payments held until claimed by recipient
3. **Transaction History**: Full audit trail of all payments
4. **Budget Controls**: Check available balance before sending

## Security Notes

- Store API keys securely in environment variables
- Invoice uploads are stored locally in `/public/uploads/`
- Database file is gitignored by default
- All payments require explicit user confirmation

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## License

This project is part of the YC Agentic Hackathon.