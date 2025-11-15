# Quick Start: Python MCP Server

This is a **standalone Python MCP server** built with [FastMCP](https://gofastmcp.com) that provides expense management tools to your AI assistant.

## 🚀 One-Command Setup

```bash
cd mcp_server
pip install fastmcp
python server.py
```

That's it! The server will connect to your Next.js app's SQLite database.

## 📋 What You Need

- **Python 3.9+** installed
- **Next.js app** running first (to create the database)

## ⚡ Quick Test

Test all 8 MCP tools:

```bash
python test_mcp.py
```

This will:
1. Create 2 test categories (Software, Marketing)
2. Create a test expense for TechSupplies Inc
3. List all expenses
4. Get spending summary
5. Update expense status to "paid"
6. Show updated spending totals

## 🔧 Integration with Next.js

### Local Development

**Step 1**: Start the Python MCP server (in one terminal):
```bash
cd mcp_server
python server.py
```

**Step 2**: Configure `.env.local` in your Next.js project:
```env
EXPENSES_MCP_URL=http://localhost:8000/sse
```

**Step 3**: Start Next.js (in another terminal):
```bash
npm run dev
```

The Next.js app will connect to the Python server via **HTTP SSE (Server-Sent Events)** for streaming MCP responses!

### Deployed Server

Deploy to FastMCP Cloud, Railway, Fly.io, or your own server, then:
```env
EXPENSES_MCP_URL=https://your-mcp-server.com/sse
```

## 🎯 Available Tools

The AI can now use these 8 tools:

| Tool | Description |
|------|-------------|
| `list_categories` | List all spending categories |
| `create_category` | Create new category with budget |
| `list_expenses` | List/filter expenses |
| `create_expense` | Create new expense |
| `get_expense` | Get expense details |
| `update_expense` | Update existing expense |
| `delete_expense` | Delete an expense |
| `get_spending_summary` | Get spending breakdown |

## 💬 Example Conversations

**User**: "Show me all my expenses"
→ AI calls `list_expenses`

**User**: "Create an expense for that invoice"
→ AI calls `create_expense` with extracted data

**User**: "How much have we spent on Software?"
→ AI calls `get_spending_summary`

**User**: "Pay the TechSupplies invoice"
→ AI:
  1. Finds expense: `list_expenses`
  2. Sends payment: `mcp__locus__send_to_email` (Locus MCP)
  3. Updates status: `update_expense`

## 🐛 Debugging

### Check Server Status
```bash
# Test if FastMCP is installed
python -c "import fastmcp; print('FastMCP OK')"

# Check if database exists
ls -la ../spending.db
```

### Common Issues

**Database not found**
→ Run `npm run dev` in parent directory first

**Import errors**
→ Install FastMCP: `pip install fastmcp`

**Connection issues**
→ Check `.env.local` settings

## 📚 Learn More

- [FastMCP Documentation](https://gofastmcp.com)
- [Full README](./README.md)
- [Main Project README](../README.md)

## 🎉 You're Ready!

The Python MCP server gives you:
- ✅ Independent debugging
- ✅ Better performance  
- ✅ Standard MCP protocol
- ✅ Easy deployment options
- ✅ Clean separation of concerns

Start your Next.js app and the MCP server will automatically provide expense management tools to Claude! 🚀

