import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { categoryOperations, expenseOperations } from '@/lib/db';

// Configure route for file uploads
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for AI processing

// Check for API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set in environment variables');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }
    
    // Validate file type (check both MIME type and file extension)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    const isValidType = allowedTypes.includes(file.type) || 
                       (file.type === '' && allowedExtensions.includes(fileExtension)) ||
                       (file.type === 'application/octet-stream' && fileExtension === '.pdf');
    
    if (!isValidType) {
      console.error('Invalid file type:', { 
        fileName: file.name, 
        fileType: file.type, 
        fileExtension,
        fileSize: file.size 
      });
      return NextResponse.json(
        { error: `Invalid file type. Please upload an image or PDF. Received: ${file.type || 'unknown'} (${fileExtension})` },
        { status: 400 }
      );
    }
    
    // Check file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.` },
        { status: 400 }
      );
    }
    
    console.log('Processing file:', { 
      name: file.name, 
      type: file.type, 
      size: file.size,
      extension: fileExtension 
    });
    
    // Get existing categories for AI context
    const categories = categoryOperations.getAll();
    const categoryNames = categories.map(c => c.name);
    
    // Save file temporarily
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const filename = `invoice_${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filepath = join(uploadsDir, filename);
    
    // Read file data
    let bytes: ArrayBuffer;
    try {
      bytes = await file.arrayBuffer();
      if (!bytes || bytes.byteLength === 0) {
        return NextResponse.json(
          { error: 'File is empty or could not be read' },
          { status: 400 }
        );
      }
    } catch (readError) {
      console.error('Error reading file:', readError);
      return NextResponse.json(
        { error: 'Failed to read file. Please try again.' },
        { status: 400 }
      );
    }
    
    const buffer = Buffer.from(bytes);
    
    // Save file to disk
    try {
      await writeFile(filepath, buffer);
      console.log('File saved successfully:', filepath);
    } catch (writeError) {
      console.error('Error saving file:', writeError);
      return NextResponse.json(
        { error: 'Failed to save file. Please try again.' },
        { status: 500 }
      );
    }
    
    const fileUrl = `/uploads/${filename}`;
    
    // Extract text from PDF if it's a PDF (important for better extraction)
    // Check both MIME type and file extension
    const isPDF = file.type === 'application/pdf' || 
                  fileExtension === '.pdf' ||
                  (file.type === 'application/octet-stream' && fileExtension === '.pdf');
    
    let extractedText = '';
    if (isPDF) {
      try {
        const pdfParse = require('pdf-parse-fork');
        const pdfData = await pdfParse(buffer, { max: 0 });
        extractedText = pdfData.text || '';
        console.log(`Extracted ${extractedText.length} characters from PDF`);
        if (extractedText.length < 50) {
          console.warn('PDF text extraction returned very little text - document might be image-based');
        }
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        extractedText = '';
      }
    }
    
    // Use Claude Vision API for image/PDF processing
    let invoiceData: {
      company_name?: string;
      amount?: number;
      sales_email?: string;
      due_date?: string;
      category?: string;
      isNewCategory?: boolean;
    } = {};
    
    try {
      // Prepare content for Claude
      const content: any[] = [];
      
      // For images, use Vision API
      const isImage = file.type.startsWith('image/') || 
                     ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExtension);
      
      if (isImage) {
        // Reuse the buffer we already have
        const base64Data = buffer.toString('base64');
        // Determine media type from file extension if MIME type is missing
        let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';
        if (file.type) {
          mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        } else {
          if (fileExtension === '.png') mediaType = 'image/png';
          else if (fileExtension === '.gif') mediaType = 'image/gif';
          else if (fileExtension === '.webp') mediaType = 'image/webp';
          else mediaType = 'image/jpeg';
        }
        
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data,
          },
        });
      } else if (isPDF) {
        // For PDFs, we cannot send them directly to Claude Vision API
        // Claude Vision only accepts image types (jpeg, png, gif, webp)
        // Instead, we'll use the extracted text from the PDF
        console.log('PDF detected - using text extraction instead of Vision API');
        
        if (!extractedText || extractedText.length < 50) {
          // If text extraction failed or returned very little text, we can't process it
          throw new Error('Could not extract sufficient text from PDF. The PDF might be image-based or corrupted. Please try uploading a PDF with selectable text or convert it to an image first.');
        }
        
        console.log(`Using ${extractedText.length} characters of extracted text for analysis`);
        // We'll add the extracted text to the prompt below
      }
      
      // For PDFs, we also include extracted text if available for better context
      
      // Add text prompt
      const categoriesList = categoryNames.length > 0 
        ? categoryNames.join(', ') 
        : 'No existing categories';
      
      const prompt = `You are an expert at extracting information from invoices and receipts. ${isPDF ? 'Analyze the extracted text from a PDF invoice/receipt document' : 'Analyze this invoice/receipt image'} carefully and extract the following information:

REQUIRED FIELDS (must extract these):
1. company_name: The name of the company/vendor issuing the invoice. Look for:
   - Company name at the top of the invoice (often in letterhead or header)
   - "From:", "Vendor:", "Company:", "Bill From:", "Invoice From:"
   - Business name in the sender/issuer section
   - Example: "SkyTrack Maintenance & Repair", "Acme Corp", "ABC Services LLC"
   
2. amount: The total amount due in USD. Look for:
   - "Total:", "Amount Due:", "Balance Due:", "Grand Total:", "Total Amount:"
   - Final sum (may include taxes, fees, or be a subtotal)
   - Usually the largest number at the bottom of the invoice
   - Extract as a NUMBER (e.g., 3150.00 for "$3,150" or "$3,150.00")

OPTIONAL FIELDS (extract if available):
3. sales_email: Any email address found in the document. Look for:
   - Email addresses near contact information
   - Common patterns: billing@, sales@, info@, support@, accounts@, contact@, ap@, finance@
   - Usually found in the header, footer, or contact section
   
4. due_date: Payment due date in YYYY-MM-DD format. Look for:
   - "Due Date:", "Payment Due:", "Due By:", "Pay By:"
   - If you see "Net 30 days" or similar terms but no specific date, set to null
   - Convert any date format to YYYY-MM-DD (e.g., "Jan 15, 2024" → "2024-01-15", "12/31/2024" → "2024-12-31")
   
5. category: Match to existing categories or suggest a new descriptive category name based on:
   - Service/product descriptions in line items
   - Industry type (e.g., "Maintenance", "Software", "Office Supplies", "Travel")
   - If it matches an existing category (case-insensitive), use that EXACT name and set isNewCategory to false

Existing categories: ${categoriesList}

EXTRACTION INSTRUCTIONS:
- Scan the ENTIRE document from top to bottom - information may be in headers, footers, or body
- For company name: Check the top section, letterhead, or sender information (NOT the "Bill To" recipient)
- For amount: Find the FINAL total - it's usually the last line item or clearly labeled "Total" or "Amount Due"
- For emails: Search the entire document - they may be in headers, footers, or contact sections
- For dates: Look for explicit due dates; if only payment terms are given (like "Net 30"), set due_date to null
- For category: Base it on the services/products listed, not the company name
- Be very thorough - invoices often have information in multiple places
- If information is clearly visible, you MUST extract it - don't return null unless truly not found

${isPDF && extractedText && extractedText.length > 50 ? `\n\n=== EXTRACTED TEXT FROM PDF ===\n${extractedText.substring(0, 5000)}${extractedText.length > 5000 ? '...' : ''}\n=== END OF EXTRACTED TEXT ===\n\nExtract all required information from the text above. This is the complete text content from the PDF invoice.` : isPDF ? '\n\nERROR: PDF text extraction failed. Cannot process this PDF without extracted text.' : ''}

CRITICAL: You MUST extract company_name and amount. If you cannot find these, return them as null but explain why in a comment.

Return ONLY a valid JSON object with these exact keys: company_name, amount (as number, not string), sales_email, due_date (YYYY-MM-DD format or null), category (string), isNewCategory (boolean).
Example response: {"company_name": "Acme Corp", "amount": 1500.00, "sales_email": "billing@acme.com", "due_date": "2024-01-15", "category": "Software", "isNewCategory": false}`;
      
      content.push({
        type: 'text',
        text: prompt,
      });
      
      // Check API key before making request
      if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.trim() === '') {
        console.error('ANTHROPIC_API_KEY is missing or empty');
        throw new Error('ANTHROPIC_API_KEY is not configured. Please create a .env.local file in the project root with: ANTHROPIC_API_KEY=your_api_key_here');
      }
      
      // Call Claude API
      console.log('Sending request to Claude with content types:', content.map(c => c.type));
      console.log('Content length:', JSON.stringify(content).length, 'bytes');
      
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: content,
        }],
      });
      
      console.log('Claude API response received');
      
      // Extract JSON from response
      const textContent = response.content.find((block: any) => block.type === 'text')?.text || '';
      
      // Try to find JSON in the response (handle cases where Claude adds explanation text)
      let jsonMatch = textContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          invoiceData = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.error('Error parsing JSON from Claude response:', parseError);
          console.error('Response text:', textContent);
          // Try to extract just the JSON part more carefully
          const jsonStart = textContent.indexOf('{');
          const jsonEnd = textContent.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            try {
              invoiceData = JSON.parse(textContent.substring(jsonStart, jsonEnd + 1));
            } catch (e) {
              console.error('Failed to parse extracted JSON:', e);
            }
          }
        }
      } else {
        console.error('No JSON found in Claude response');
        console.error('Full response:', textContent);
      }
      
      // Log extracted data for debugging
      console.log('Extracted invoice data:', invoiceData);
    } catch (error) {
      console.error('Error processing with Claude:', error);
      
      // Check for specific error types
      let errorMessage = 'Failed to process invoice with AI';
      let errorDetails = error instanceof Error ? error.message : String(error);
      
      if (error instanceof Error) {
        // Check for API key errors
        if (error.message.includes('api_key') || error.message.includes('API key')) {
          errorMessage = 'Claude API key is missing or invalid';
          errorDetails = 'Please check your ANTHROPIC_API_KEY environment variable';
        }
        // Check for rate limit errors
        else if (error.message.includes('rate_limit') || error.message.includes('429')) {
          errorMessage = 'Claude API rate limit exceeded';
          errorDetails = 'Please try again in a few moments';
        }
        // Check for authentication errors
        else if (error.message.includes('401') || error.message.includes('authentication')) {
          errorMessage = 'Claude API authentication failed';
          errorDetails = 'Please check your API key configuration';
        }
        // Check for file size errors
        else if (error.message.includes('too large') || error.message.includes('size')) {
          errorMessage = 'File is too large for Claude API';
          errorDetails = 'Please try a smaller file or compress the image/PDF';
        }
        else {
          errorDetails = error.message;
        }
      }
      
      return NextResponse.json(
        { 
          error: errorMessage, 
          details: errorDetails,
          suggestion: 'Please check the server logs for more details or try uploading the invoice again.'
        },
        { status: 500 }
      );
    }
    
    // Validate extracted data
    if (!invoiceData.company_name || !invoiceData.amount) {
      return NextResponse.json(
        { 
          error: 'Could not extract required information from invoice',
          extracted: invoiceData,
          suggestion: 'The AI could not extract the company name or amount from the invoice. Please ensure the invoice is clear and try again, or manually create the expense.',
          details: {
            hasCompanyName: !!invoiceData.company_name,
            hasAmount: !!invoiceData.amount,
            hasEmail: !!invoiceData.sales_email,
            hasCategory: !!invoiceData.category
          }
        },
        { status: 400 }
      );
    }
    
    // Handle category - find existing or create new
    let categoryId: number | undefined;
    if (invoiceData.category) {
      const existingCategory = categories.find(c => 
        c.name.toLowerCase() === invoiceData.category!.toLowerCase()
      );
      
      if (existingCategory) {
        categoryId = existingCategory.id;
        invoiceData.isNewCategory = false;
      } else if (invoiceData.isNewCategory) {
        // Create new category
        const result = categoryOperations.create(
          invoiceData.category,
          `Auto-created from invoice: ${invoiceData.company_name}`
        );
        categoryId = result.lastInsertRowid as number;
      }
    }
    
    // Create expense
    const expenseResult = expenseOperations.create({
      category_id: categoryId,
      company_name: invoiceData.company_name,
      amount: invoiceData.amount,
      sales_email: invoiceData.sales_email || undefined,
      due_date: invoiceData.due_date || undefined,
      status: 'pending',
      invoice_url: fileUrl,
    });
    
    const newExpense = expenseOperations.getById(expenseResult.lastInsertRowid as number);
    
    return NextResponse.json({
      success: true,
      expense: newExpense,
      extracted: invoiceData,
      categoryCreated: invoiceData.isNewCategory,
    });
    
  } catch (error) {
    console.error('Error processing invoice:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        error: 'Failed to process invoice', 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

