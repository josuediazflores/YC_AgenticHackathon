import { NextRequest, NextResponse } from 'next/server';
import { 
  extractInvoiceData, 
  processExpenseQuery, 
  getLocusPaymentContext,
  sendLocusPayment,
  sendClaudeMessage 
} from '@/lib/claude';
import { categoryOperations, expenseOperations, paymentOperations } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'extract_invoice': {
        if (!data?.text) {
          return NextResponse.json(
            { error: 'Invoice text is required' },
            { status: 400 }
          );
        }

        const categories = categoryOperations.getAll();
        const categoryNames = categories.map((c: any) => c.name);
        const extractedData = await extractInvoiceData(data.text, categoryNames);

        return NextResponse.json({ 
          success: true, 
          data: extractedData 
        });
      }

      case 'process_query': {
        if (!data?.query) {
          return NextResponse.json(
            { error: 'Query is required' },
            { status: 400 }
          );
        }

        const categories = categoryOperations.getWithSpending();
        const expenses = expenseOperations.getAll();
        const payments = paymentOperations.getAll();

        // Include chat history if provided
        const chatHistory = data.chatHistory || [];

        const response = await processExpenseQuery(data.query, {
          categories,
          expenses,
          payments: payments.slice(0, 10), // Last 10 payments
          chatHistory
        });

        // Parse JSON response
        try {
          const parsed = JSON.parse(response);
          return NextResponse.json({ 
            success: true, 
            response: parsed.response,
            expense: parsed.expense || null
          });
        } catch (e) {
          // Fallback if JSON parsing fails
          return NextResponse.json({ 
            success: true, 
            response,
            expense: null
          });
        }
      }

      case 'get_payment_context': {
        const context = await getLocusPaymentContext();
        return NextResponse.json({ 
          success: true, 
          context 
        });
      }

      case 'send_payment': {
        const { email, amount, memo, expense_id } = data;
        
        if (!email || !amount || !memo) {
          return NextResponse.json(
            { error: 'Email, amount, and memo are required' },
            { status: 400 }
          );
        }

        // Send payment via Locus
        const paymentResult = await sendLocusPayment(email, amount, memo);
        
        // If expense_id provided, update the expense and create payment record
        if (expense_id) {
          // Extract transaction ID from payment result if available
          let transactionId = null;
          try {
            const resultMatch = paymentResult.match(/transaction[_\s]?id[:\s]+([a-zA-Z0-9-]+)/i);
            transactionId = resultMatch ? resultMatch[1] : null;
          } catch (e) {
            // Ignore parsing errors
          }

          // Create payment record
          paymentOperations.create({
            expense_id,
            payment_method: 'locus_usdc',
            recipient_email: email,
            amount,
            memo,
            transaction_id: transactionId || undefined
          });

          // Update expense status
          expenseOperations.update(expense_id, { status: 'paid' });
        }

        return NextResponse.json({ 
          success: true, 
          result: paymentResult 
        });
      }

      case 'send_email': {
        const { to, subject, body: emailBody, html, from } = data;
        
        if (!to || !subject || (!emailBody && !html)) {
          return NextResponse.json(
            { error: 'To, subject, and body (or html) are required' },
            { status: 400 }
          );
        }

        // Import Resend directly to avoid fetch issues
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        console.log('Sending email to:', to);

        try {
          const fromEmail = from || process.env.RESEND_FROM_EMAIL || 'YC@testing.james.baby';
          
          const { data: emailData, error: emailError } = await resend.emails.send({
            from: fromEmail,
            to: Array.isArray(to) ? to : [to],
            subject,
            text: emailBody || undefined,
            html: html || undefined,
          });

          if (emailError) {
            console.error('Resend API error:', emailError);
            return NextResponse.json(
              { error: 'Failed to send email', details: emailError.message || 'Unknown error' },
              { status: 500 }
            );
          }

          return NextResponse.json({ 
            success: true, 
            result: `Email sent successfully to ${Array.isArray(to) ? to.join(', ') : to}. Message ID: ${emailData?.id || 'N/A'}`,
            messageId: emailData?.id
          });
        } catch (error) {
          console.error('Error sending email:', error);
          return NextResponse.json(
            { error: 'Failed to send email', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
          );
        }
      }

      case 'chat': {
        if (!data?.message) {
          return NextResponse.json(
            { error: 'Message is required' },
            { status: 400 }
          );
        }

        const response = await sendClaudeMessage(data.message);
        return NextResponse.json({ 
          success: true, 
          response 
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
