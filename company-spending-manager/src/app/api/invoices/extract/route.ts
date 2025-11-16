import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileUrl } = body;

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'File URL is required' },
        { status: 400 }
      );
    }

    // Extract filename from URL
    const filename = fileUrl.split('/').pop();
    if (!filename) {
      return NextResponse.json(
        { error: 'Invalid file URL' },
        { status: 400 }
      );
    }

    // Read file from public/uploads directory
    const filepath = join(process.cwd(), 'public', 'uploads', filename);

    let extractedText = '';

    try {
      const fileBuffer = await readFile(filepath);

      // Check if it's a PDF or image
      if (filename.toLowerCase().endsWith('.pdf') ||
          filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)) {

        // Use Claude's Vision API to extract text from PDF or image
        try {
          const base64Data = fileBuffer.toString('base64');
          const isPdf = filename.toLowerCase().endsWith('.pdf');

          const mediaType = isPdf ? 'application/pdf' :
                           filename.toLowerCase().endsWith('.png') ? 'image/png' :
                           filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' :
                           filename.toLowerCase().endsWith('.gif') ? 'image/gif' : 'image/webp';

          // Build content array with proper typing
          const content: any[] = [];
          
          if (isPdf) {
            content.push({
              type: 'document' as const,
              source: {
                type: 'base64' as const,
                media_type: 'application/pdf' as const,
                data: base64Data,
              },
            });
          } else {
            content.push({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64Data,
              },
            });
          }
          
          content.push({
            type: 'text' as const,
            text: 'Please extract all text content from this invoice document. Include company names, amounts, dates, email addresses, and any other relevant invoice information. Return the extracted text in a clear, structured format.'
          });

          const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [
              {
                role: 'user',
                content,
              },
            ],
          });

          extractedText = message.content[0].type === 'text' ? message.content[0].text : '';

          if (!extractedText || extractedText.trim().length === 0) {
            extractedText = `Unable to extract text from this document. It may be empty or unreadable.

For testing purposes, you can manually paste invoice text like:
"Invoice from TechSupplies Inc.
Amount Due: $891.00
Email: billing@techsupplies.com
Due Date: 2024-12-15"`;
          }
        } catch (visionError: any) {
          console.error('Vision API error:', visionError);
          extractedText = `Error processing document with Vision API: ${visionError?.message || 'Unknown error'}

Please try uploading a different document or manually paste the invoice text.`;
        }
      } else {
        extractedText = `[Unsupported file type: ${filename}. Please upload a PDF or image file (JPG, PNG, GIF, WebP).]`;
      }
    } catch (error) {
      console.error('Error reading file:', error);
      return NextResponse.json(
        { error: 'Failed to read file' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      text: extractedText,
      filename: filename
    });
  } catch (error) {
    console.error('Error extracting text:', error);
    return NextResponse.json(
      { error: 'Failed to extract text from file' },
      { status: 500 }
    );
  }
}
