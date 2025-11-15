import { NextRequest, NextResponse } from 'next/server';
import { expenseOperations } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('category_id');
    const status = searchParams.get('status');
    
    const filters: any = {};
    if (categoryId) filters.category_id = parseInt(categoryId);
    if (status) filters.status = status;
    
    const expenses = expenseOperations.getAll(filters);
    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category_id, company_name, amount, sales_email, due_date, status, invoice_url } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    const result = expenseOperations.create({
      category_id,
      company_name,
      amount,
      sales_email,
      due_date,
      status,
      invoice_url
    });
    
    const newExpense = expenseOperations.getById(result.lastInsertRowid as number);
    return NextResponse.json(newExpense, { status: 201 });
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json(
      { error: 'Failed to create expense' },
      { status: 500 }
    );
  }
}
