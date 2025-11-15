#!/bin/bash

# Quick start script for Expense Management MCP Server

echo "🚀 Starting Expense Management MCP Server..."
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.9+ first."
    exit 1
fi

# Check if FastMCP is installed
if ! python3 -c "import fastmcp" 2>/dev/null; then
    echo "📦 FastMCP not found. Installing dependencies..."
    pip3 install -r requirements.txt
    echo ""
fi

# Check if database exists
if [ ! -f "../spending.db" ]; then
    echo "⚠️  Warning: Database not found at ../spending.db"
    echo "   Please run 'npm run dev' in the parent directory first to initialize the database."
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Run the server
echo "✨ Starting MCP server..."
python3 server.py

