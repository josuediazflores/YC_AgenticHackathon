import { NextRequest, NextResponse } from 'next/server';
import { expenseOperations, paymentOperations } from '@/lib/db';

type Params = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const expenseId = parseInt(params.id);
    const expense = expenseOperations.getById(expenseId);
    
    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }
    
    if (expense.status === 'paid') {
      return NextResponse.json(
        { error: 'Expense is already paid' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { payment_method, recipient_email, memo, transaction_id } = body;
    
    if (!payment_method) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      );
    }
    
    // Create payment record
    const paymentResult = paymentOperations.create({
      expense_id: expenseId,
      payment_method,
      recipient_email: recipient_email || expense.sales_email,
      amount: expense.amount,
      memo,
      transaction_id
    });
    
    // Update expense status to paid
    expenseOperations.update(expenseId, { status: 'paid' });
    
    const payment = {
      id: paymentResult.lastInsertRowid,
      expense_id: expenseId,
      payment_method,
      recipient_email: recipient_email || expense.sales_email,
      amount: expense.amount,
      memo,
      transaction_id,
      created_at: new Date().toISOString()
    };
    
    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Error processing payment:', error);
    return NextResponse.json(
      { error: 'Failed to process payment' },
      { status: 500 }
    );
  }
}
