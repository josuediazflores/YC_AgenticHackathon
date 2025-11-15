# Expense Management MCP Server (Python)

A standalone **FastMCP** server for expense and category management, designed to work alongside Locus for payments.

## Why Separate Python Server?

- **Independent Debugging**: Run and debug separately from Next.js app
- **Better Performance**: FastMCP is optimized for MCP protocol
- **Easy Deployment**: Can deploy to different infrastructure than web app
- **Standard Protocol**: Built with FastMCP, the standard MCP framework

## Setup

### 1. Install Dependencies

```bash
cd mcp_server
pip install -r requirements.txt
```

Or using a virtual environment (recommended):

```bash
cd mcp_server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Run the Server

The server connects to the same SQLite database used by the Next.js app:

```bash
# Make sure you're in the mcp_server directory
python server.py
```

The server will start and print:

```
🚀 Starting Expense Management MCP Server...
📁 Database: /path/to/spending.db
🔧 Tools available: 8

✨ Server ready!
   HTTP SSE: http://localhost:8000/sse
   Health:   http://localhost:8000/health
   Tools:    http://localhost:8000/tools
```

The server uses **SSE (Server-Sent Events)** for streaming MCP responses over HTTP.

## Available Tools

The server provides **8 MCP tools**:

### Categories
- `list_categories` - List all categories with spending totals
- `create_category` - Create new spending category

### Expenses
- `list_expenses` - List/filter expenses by category or status
- `create_expense` - Create new expense entry
- `get_expense` - Get specific expense details
- `update_expense` - Update existing expense
- `delete_expense` - Delete an expense

### Analytics
- `get_spending_summary` - Get spending breakdown by category

## Testing

### Option 1: Test Script

Run the included test script:

```bash
python test_mcp.py
```

### Option 2: Manual Testing with FastMCP Client

Test the MCP server using the FastMCP client:

```python
import asyncio
from fastmcp import Client

async def test_mcp():
    # Connect to HTTP SSE server
    async with Client("http://localhost:8000/sse") as client:
        # List categories
        result = await client.call_tool("list_categories")
        print(result)
        
        # Create a category
        result = await client.call_tool(
            "create_category",
            name="Software",
            description="Software subscriptions",
            budget=5000
        )
        print(result)

asyncio.run(test_mcp())
```

### Option 3: HTTP Requests

Test individual endpoints:

```bash
# Health check
curl http://localhost:8000/health

# List available tools
curl http://localhost:8000/tools

# Connect to SSE stream (requires MCP client)
curl http://localhost:8000/sse
```

## Configuration with Next.js App

Update your `.env.local` in the Next.js project:

```env
# For local MCP server (when running python server.py)
EXPENSES_MCP_URL=http://localhost:8000/sse

# OR for deployed server
EXPENSES_MCP_URL=https://your-mcp-server.com/sse
```

**Note**: The URL should point to the `/sse` endpoint for Server-Sent Events streaming.

## Deployment Options

### Option 1: Local (Development)
Just run `python server.py` alongside your Next.js app.

### Option 2: FastMCP Cloud (Free for Personal)
Deploy to FastMCP Cloud:

```bash
fastmcp deploy
```

Follow the prompts to deploy your server to https://fastmcp.cloud

### Option 3: Custom Server
Deploy to any server that supports Python. The server uses HTTP with SSE (Server-Sent Events) for streaming:

Deploy with:
- **Docker**: Containerize the app and deploy to any cloud
- **Fly.io**: `fly deploy` with a Dockerfile
- **Railway**: Connect GitHub repo and deploy
- **Any Python hosting**: Ensure port 8000 is exposed
- **Custom VPS**: Run with `python server.py` behind nginx/caddy

**Example Docker setup**:
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY server.py .
ENV MCP_PORT=8000
CMD ["python", "server.py"]
```

## Database

The MCP server connects to the same SQLite database as the Next.js app:

```
company-spending-manager/
├── spending.db          # Shared database
├── mcp_server/
│   └── server.py       # Python MCP server
└── src/                # Next.js app
```

**Important**: Make sure the Next.js app has created the database before running the MCP server. Run `npm run dev` at least once to initialize the database schema.

## Architecture

```
┌─────────────────────────────────────────┐
│         Claude Agent SDK                │
│         (Next.js Backend)               │
│                                         │
│  ┌───────────────┐  ┌───────────────┐  │
│  │  Locus MCP    │  │ Expenses MCP  │  │
│  │   (External)  │  │  (Python)     │  │
│  └───────────────┘  └───────────────┘  │
└─────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   Locus Payments        SQLite DB
                       (spending.db)
```

## Troubleshooting

### Database not found
Make sure you run the Next.js app first to create the database:
```bash
cd ..
npm run dev
```

### Import errors
Make sure FastMCP is installed:
```bash
pip install fastmcp
```

### Connection issues
Check that the server is running and the URL in `.env.local` is correct.

## Learn More

- [FastMCP Documentation](https://gofastmcp.com)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP Specification](https://spec.modelcontextprotocol.io/)

