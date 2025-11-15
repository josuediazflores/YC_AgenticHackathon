import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

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
      
      // Check if it's a PDF (by extension for now)
      if (filename.toLowerCase().endsWith('.pdf')) {
        // Parse PDF - using pdf-parse-fork which has better Node.js compatibility
        try {
          const pdfParse = require('pdf-parse-fork');
          
          // Try parsing with lenient options for malformed PDFs
          const pdfData = await pdfParse(fileBuffer, {
            max: 0, // Parse all pages
            version: 'default'
          });
          
          extractedText = pdfData.text;
          
          if (!extractedText || extractedText.trim().length === 0) {
            extractedText = `PDF_PARSE_EMPTY: No text content found in the PDF. This might be a scanned image or an empty document.

For testing purposes, you can manually paste invoice text like:
"Invoice from TechSupplies Inc.
Amount Due: $891.00
Email: billing@techsupplies.com
Due Date: 2024-12-15"`;
          }
        } catch (pdfError: any) {
          console.error('PDF parsing error:', pdfError);
          
          // Provide helpful error message based on error type
          const errorMsg = pdfError?.message || 'Unknown error';
          
          if (errorMsg.includes('XRef') || errorMsg.includes('bad') || errorMsg.includes('FormatError')) {
            extractedText = `PDF_PARSE_ERROR: This PDF has formatting issues and cannot be parsed automatically.

For now, please manually paste the invoice text like:
"Invoice from TechSupplies Inc.
Amount Due: $891.00
Email: billing@techsupplies.com
Due Date: 2024-12-15"

Then I can extract the information for you!`;
          } else {
            extractedText = `PDF_PARSE_ERROR: Could not parse PDF. ${errorMsg}

Please manually paste the invoice text and I'll extract the information.`;
          }
        }
      } else {
        // For images, we'll need OCR (for now, return a message)
        extractedText = `[Image file: ${filename}. Note: OCR is not yet implemented. Please upload a PDF for text extraction.]`;
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
