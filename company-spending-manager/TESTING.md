# Testing the Company Spending Manager

## Testing Invoice Upload & Extraction

### Sample Invoice
We've included a sample invoice HTML file (`sample-invoice.html`) that you can use for testing:

1. **Convert HTML to PDF** (if needed):
   - Open `sample-invoice.html` in your browser
   - Print to PDF (Cmd+P on Mac, Ctrl+P on Windows)
   - Save as `sample-invoice.pdf`

2. **Test Upload**:
   - Drag and drop the PDF onto the chat interface
   - Or click the upload button to select the file

### Expected Extraction Results
The AI should extract:
- **Company:** TechSupplies Inc.
- **Amount:** $891.00
- **Email:** billing@techsupplies.com
- **Due Date:** 2024-12-15
- **Category:** Office Supplies (or similar)

## Testing Chat Persistence

1. **Send Messages**: Have a conversation with the AI
2. **Refresh Page**: Press F5 or Cmd+R
3. **Check History**: Messages should persist after refresh
4. **Clear Chat**: Click the trash icon to clear history

## Testing Payment Commands

### Example Commands:
- "Pay expense #1"
- "Send $500 to vendor@email.com"
- "What's our total spending this month?"
- "Show me all pending expenses"

## Troubleshooting

### PDF Extraction Not Working?
- Ensure the PDF contains text (not a scanned image)
- Check console for errors
- Try a different PDF file

### Messages Not Persisting?
- Check browser's localStorage settings
- Ensure cookies/storage is enabled
- Try a different browser

### Upload Button Not Working?
- Check file size (should be under 10MB)
- Ensure file type is PDF or image
- Check browser console for errors
