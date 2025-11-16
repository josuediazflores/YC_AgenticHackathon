"""
Test script for the Expense Management MCP Server

This script tests the MCP server tools independently.
Run with: python test_mcp.py
"""

import asyncio
import json
from fastmcp import Client

async def test_mcp_server():
    """Test all MCP tools"""
    
    print("🧪 Testing flowcoin MCP Server\n")
    print("📡 Connecting to http://localhost:8000/sse")
    print("   (Make sure the server is running: python server.py)\n")
    
    # Connect to the local HTTP SSE server
    async with Client("http://localhost:8000/sse") as client:
        
        # Test 1: List categories (should be empty initially)
        print("1️⃣  Testing list_categories...")
        try:
            result = await client.call_tool("list_categories")
            categories = json.loads(result[0].text)
            print(f"   ✅ Found {len(categories)} categories")
            print(f"   {json.dumps(categories, indent=2)}\n")
        except Exception as e:
            print(f"   ❌ Error: {e}\n")
        
        # Test 2: Create a category
        print("2️⃣  Testing create_category...")
        try:
            result = await client.call_tool(
                "create_category",
                arguments={
                    "name": "Software",
                    "description": "Software subscriptions and licenses",
                    "budget": 5000
                }
            )
            print(f"   ✅ {result[0].text}\n")
        except Exception as e:
            print(f"   ❌ Error: {e}\n")
        
        # Test 3: Create another category
        print("3️⃣  Testing create_category (Marketing)...")
        try:
            result = await client.call_tool(
                "create_category",
                arguments={
                    "name": "Marketing",
                    "description": "Marketing and advertising expenses",
                    "budget": 10000
                }
            )
            print(f"   ✅ {result[0].text}\n")
        except Exception as e:
            print(f"   ❌ Error: {e}\n")
        
        # Test 4: List categories again
        print("4️⃣  Testing list_categories (after creation)...")
        try:
            result = await client.call_tool("list_categories")
            categories = json.loads(result[0].text)
            print(f"   ✅ Found {len(categories)} categories:")
            for cat in categories:
                print(f"      - {cat['name']} (ID: {cat['id']}, Budget: ${cat['budget_limit']})")
            print()
        except Exception as e:
            print(f"   ❌ Error: {e}\n")
        
        # Test 5: Create an expense
        print("5️⃣  Testing create_expense...")
        try:
            result = await client.call_tool(
                "create_expense",
                arguments={
                    "company_name": "TechSupplies Inc",
                    "amount": 891.00,
                    "category_id": 1,
                    "sales_email": "billing@techsupplies.com",
                    "due_date": "2024-12-15"
                }
            )
            print(f"   ✅ {result[0].text}\n")
        except Exception as e:
            print(f"   ❌ Error: {e}\n")
        
        # Test 6: List expenses
        print("6️⃣  Testing list_expenses...")
        try:
            result = await client.call_tool("list_expenses")
            expenses = json.loads(result[0].text)
            print(f"   ✅ Found {len(expenses)} expenses:")
            for exp in expenses:
                print(f"      - {exp['company_name']}: ${exp['amount']} ({exp['status']})")
            print()
        except Exception as e:
            print(f"   ❌ Error: {e}\n")
        
        # Test 7: Get expense by ID
        print("7️⃣  Testing get_expense...")
        try:
            result = await client.call_tool("get_expense", arguments={"id": 1})
            expense = json.loads(result[0].text)
            print(f"   ✅ Expense Details:")
            print(f"      Company: {expense['company_name']}")
            print(f"      Amount: ${expense['amount']}")
            print(f"      Email: {expense['sales_email']}")
            print()
        except Exception as e:
            print(f"   ❌ Error: {e}\n")
        
        # Test 8: Get spending summary
        print("8️⃣  Testing get_spending_summary...")
        try:
            result = await client.call_tool("get_spending_summary")
            summary = json.loads(result[0].text)
            print(f"   ✅ Spending Summary:")
            print(f"      Total: ${summary['total_spending']}")
            for cat in summary['by_category']:
                print(f"      - {cat['category']}: ${cat['total_spent']} / ${cat['budget']} budget")
            print()
        except Exception as e:
            print(f"   ❌ Error: {e}\n")
        
        # Test 9: Update expense status
        print("9️⃣  Testing update_expense...")
        try:
            result = await client.call_tool(
                "update_expense",
                arguments={"id": 1, "status": "paid"}
            )
            print(f"   ✅ {result[0].text}\n")
        except Exception as e:
            print(f"   ❌ Error: {e}\n")
        
        # Test 10: Get spending summary again (should show paid expense)
        print("🔟 Testing get_spending_summary (after payment)...")
        try:
            result = await client.call_tool("get_spending_summary")
            summary = json.loads(result[0].text)
            print(f"   ✅ Spending Summary:")
            print(f"      Total: ${summary['total_spending']}")
            for cat in summary['by_category']:
                print(f"      - {cat['category']}: ${cat['total_spent']} / ${cat['budget']} budget")
            print()
        except Exception as e:
            print(f"   ❌ Error: {e}\n")
    
    print("✨ All tests completed!\n")

if __name__ == "__main__":
    asyncio.run(test_mcp_server())

