import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody, html, from } = body;

    if (!to || !subject || (!emailBody && !html)) {
      return NextResponse.json(
        { error: 'To, subject, and body (or html) are required' },
        { status: 400 }
      );
    }

    // Use provided from email or default
    const fromEmail = from || process.env.RESEND_FROM_EMAIL || 'YC@testing.james.baby';

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      text: emailBody || undefined,
      html: html || undefined,
    });

    if (error) {
      console.error('Resend API error:', error);
      return NextResponse.json(
        { error: 'Failed to send email', details: error.message || 'Unknown error' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: data?.id,
      message: 'Email sent successfully'
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

