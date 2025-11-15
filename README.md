# Company Spending Manager

An AI-powered expense management and payment system for companies, featuring a conversational chatbot interface, automated invoice processing, and seamless USDC payments through Locus.

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
- **AI Integration**: Claude Agents SDK with Locus MCP tools
- **Database**: SQLite with better-sqlite3
- **Payments**: Locus for USDC transactions

## Prerequisites

- Node.js 18+ and npm
- Anthropic API key for Claude
- Locus API key for payment processing

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

3. Set up environment variables:
```bash
cp env.example .env.local
```

Edit `.env.local` and add your API keys:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key
LOCUS_API_KEY=your_locus_api_key
DATABASE_URL=./spending.db
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

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

- `GET/POST /api/categories` - Category management
- `GET/POST /api/expenses` - Expense operations
- `POST /api/expenses/[id]/pay` - Process payments
- `POST /api/invoices/upload` - Invoice file upload
- `POST /api/agent` - Claude AI agent interactions

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