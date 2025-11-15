import { NextRequest, NextResponse } from 'next/server';
import { expenseOperations, paymentOperations } from '@/lib/db';

type Params = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const id = parseInt(params.id);
    const expense = expenseOperations.getById(id);
    
    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }
    
    const payments = paymentOperations.getByExpenseId(id);
    
    return NextResponse.json({ ...expense, payments });
  } catch (error) {
    console.error('Error fetching expense:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expense' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const id = parseInt(params.id);
    const body = await request.json();
    
    if (body.amount !== undefined && body.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }
    
    const result = expenseOperations.update(id, body);
    
    if (!result || result.changes === 0) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }
    
    const updatedExpense = expenseOperations.getById(id);
    return NextResponse.json(updatedExpense);
  } catch (error) {
    console.error('Error updating expense:', error);
    return NextResponse.json(
      { error: 'Failed to update expense' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const id = parseInt(params.id);
    const result = expenseOperations.delete(id);
    
    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 }
    );
  }
}
