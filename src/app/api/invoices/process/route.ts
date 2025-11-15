import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { categoryOperations, expenseOperations } from '@/lib/db';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an image or PDF.' },
        { status: 400 }
      );
    }
    
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
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);
    
    const fileUrl = `/uploads/${filename}`;
    
    // Extract text from PDF if it's a PDF (important for better extraction)
    let extractedText = '';
    if (file.type === 'application/pdf') {
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
      if (file.type.startsWith('image/')) {
        const fileBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(fileBuffer).toString('base64');
        const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data,
          },
        });
      } else if (file.type === 'application/pdf') {
        // For PDFs, if we have good text extraction, we can use that
        // Otherwise, try to send as image (though Claude may not support PDFs directly)
        // For now, we'll primarily rely on extracted text for PDFs
        if (extractedText && extractedText.length > 100) {
          // We have good text extraction, use that primarily
          console.log('Using extracted PDF text for analysis');
        } else {
          // Try sending PDF as base64 image (may not work, but worth trying)
          try {
            const fileBuffer = await file.arrayBuffer();
            const base64Data = Buffer.from(fileBuffer).toString('base64');
            
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Data,
              },
            });
            console.log('Attempting to send PDF as image to Claude Vision');
          } catch (pdfError) {
            console.error('Error preparing PDF for Claude Vision:', pdfError);
          }
        }
      }
      
      // For PDFs, we also include extracted text if available for better context
      
      // Add text prompt
      const categoriesList = categoryNames.length > 0 
        ? categoryNames.join(', ') 
        : 'No existing categories';
      
      const prompt = `You are an expert at extracting information from invoices and receipts. Analyze this ${file.type === 'application/pdf' ? 'PDF invoice/receipt document' : 'invoice/receipt image'} carefully and extract the following information:

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

${extractedText && extractedText.length > 50 ? `\n\n=== EXTRACTED TEXT FROM PDF ===\n${extractedText}\n=== END OF EXTRACTED TEXT ===\n\nUse this extracted text to find all the required information. The text above contains all the information from the invoice.` : file.type === 'application/pdf' && (!extractedText || extractedText.length < 50) ? '\n\nNote: PDF text extraction was limited or unavailable. Please analyze the document carefully.' : ''}

CRITICAL: You MUST extract company_name and amount. If you cannot find these, return them as null but explain why in a comment.

Return ONLY a valid JSON object with these exact keys: company_name, amount (as number, not string), sales_email, due_date (YYYY-MM-DD format or null), category (string), isNewCategory (boolean).
Example response: {"company_name": "Acme Corp", "amount": 1500.00, "sales_email": "billing@acme.com", "due_date": "2024-01-15", "category": "Software", "isNewCategory": false}`;
      
      content.push({
        type: 'text',
        text: prompt,
      });
      
      // Call Claude API
      console.log('Sending request to Claude with content types:', content.map(c => c.type));
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
      return NextResponse.json(
        { error: 'Failed to process invoice with AI', details: error instanceof Error ? error.message : String(error) },
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
    return NextResponse.json(
      { error: 'Failed to process invoice', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

