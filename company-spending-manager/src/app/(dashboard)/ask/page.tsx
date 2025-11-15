"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Upload, Loader2, Bot, User, Paperclip, X, FileText, Trash2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { InvoiceProcessor } from "@/components/invoice-processor";
import { TextShimmer } from "@/components/ui/text-shimmer";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachment?: {
    name: string;
    url: string;
    processing?: boolean;
  };
  expense?: {
    company: string;
    amount: string;
    email: string;
    status: string;
  } | null;
}

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processingFile, setProcessingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thinkingMessageIdRef = useRef<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem("chat-messages");
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        // Convert date strings back to Date objects
        const messagesWithDates = parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDates);
      } catch (error) {
        console.error("Error loading saved messages:", error);
      }
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("chat-messages", JSON.stringify(messages));
    }
    scrollToBottom();
  }, [messages]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setUploadedFile(file);
      setProcessingFile(true);
      
      // Add user message with attachment (showing loading)
      const userMessage: Message = {
        id: Date.now().toString(),
        type: "user",
        content: `Uploading invoice: ${file.name}...`,
        timestamp: new Date(),
        attachment: {
          name: file.name,
          url: "",
          processing: true
        }
      };
      setMessages(prev => [...prev, userMessage]);
      
      try {
        // Process invoice directly using the improved processing endpoint (handles upload + processing)
        setIsLoading(true);
        
        // Add thinking message
        const thinkingMessageId = `thinking-${Date.now()}`;
        thinkingMessageIdRef.current = thinkingMessageId;
        const thinkingMessage: Message = {
          id: thinkingMessageId,
          type: "assistant",
          content: "thinking...",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, thinkingMessage]);
        
        // Use the improved invoice processing endpoint that uses Claude Vision
        const processFormData = new FormData();
        processFormData.append("file", file);
        
        const processRes = await fetch("/api/invoices/process", {
          method: "POST",
          body: processFormData,
        });
        
        if (!processRes.ok) {
          let errorData;
          try {
            errorData = await processRes.json();
          } catch {
            errorData = { error: `Server error: ${processRes.status} ${processRes.statusText}` };
          }
          
          const errorMsg = errorData.error || `Failed to process invoice (${processRes.status})`;
          const errorDetails = errorData.details || '';
          const suggestion = errorData.suggestion || '';
          const details = errorData.details && typeof errorData.details === 'object' ? errorData.details : {};
          
          let fullError = errorMsg;
          if (errorDetails && typeof errorDetails === 'string') {
            fullError += `\n\n${errorDetails}`;
          }
          if (suggestion) {
            fullError += `\n\n${suggestion}`;
          }
          if (details.hasCompanyName === false || details.hasAmount === false) {
            fullError += `\n\nMissing:`;
            if (!details.hasCompanyName) fullError += ` Company name`;
            if (!details.hasAmount) fullError += ` Amount`;
          }
          
          throw new Error(fullError);
        }
        
        const processData = await processRes.json();
        
        // Update user message with file URL if available
        if (processData.expense && processData.expense.invoice_url) {
          setMessages(prev => prev.map(msg => 
            msg.id === userMessage.id 
              ? { 
                  ...msg, 
                  content: `I've uploaded an invoice: ${file.name}`,
                  attachment: { ...msg.attachment!, url: processData.expense.invoice_url, processing: false }
                }
              : msg
          ));
        }
        
        // Create assistant response with structured data
        let response = "";
        let expenseData = null;
        
        if (processRes.ok && processData.success && processData.extracted) {
          const extracted = processData.extracted;
          
          // Create expense object for the card display
          if (extracted.company_name && extracted.amount) {
            expenseData = {
              company: extracted.company_name,
              amount: extracted.amount.toFixed(2),
              email: extracted.sales_email || "N/A",
              status: "created"
            };
          }
          
          response = "✅ I've successfully extracted and created the expense!";
          
          if (processData.categoryCreated) {
            response += `\n\n📁 A new category "${extracted.category}" was automatically created.`;
          }
        } else {
          // Handle errors
          const errorMsg = processData.error || "Failed to process invoice";
          const suggestion = processData.suggestion || "";
          const details = processData.details || {};
          
          response = `⚠️ ${errorMsg}`;
          
          if (suggestion) {
            response += `\n\n${suggestion}`;
          }
          
          if (details.hasCompanyName === false || details.hasAmount === false) {
            response += `\n\nMissing required information:`;
            if (!details.hasCompanyName) response += `\n- Company name`;
            if (!details.hasAmount) response += `\n- Amount`;
          }
          
          if (processData.extracted) {
            response += `\n\nI was able to extract:`;
            const extracted = processData.extracted;
            if (extracted.company_name) response += `\n- Company: ${extracted.company_name}`;
            if (extracted.amount) response += `\n- Amount: $${extracted.amount}`;
            if (extracted.sales_email) response += `\n- Email: ${extracted.sales_email}`;
            if (extracted.category) response += `\n- Category: ${extracted.category}`;
          }
        }
        
        // Replace thinking message with final response
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: response,
          expense: expenseData,
          timestamp: new Date(),
        };
        
        setMessages(prev => {
          const thinkingId = thinkingMessageIdRef.current;
          const updated = thinkingId 
            ? prev.map(msg => msg.id === thinkingId ? assistantMessage : msg)
            : [...prev, assistantMessage];
          return updated.filter(msg => msg.content !== "thinking...");
        });
        
      } catch (error: any) {
        console.error("Error processing invoice:", error);
        
        // Try to get error details from response
        let errorContent = "❌ This PDF has formatting issues and can't be processed automatically.\n\n";
        errorContent += "💡 **Try this instead:**\n";
        errorContent += "1. Open the PDF and copy the text\n";
        errorContent += "2. Paste it here in the chat\n";
        errorContent += "3. I'll extract the invoice details from your pasted text!";
        
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: errorContent,
          timestamp: new Date(),
        };
        
        setMessages(prev => {
          const thinkingId = thinkingMessageIdRef.current;
          const updated = thinkingId 
            ? prev.map(msg => msg.id === thinkingId ? errorMessage : msg)
            : [...prev, errorMessage];
          return updated.filter(msg => msg.content !== "thinking...");
        });
      } finally {
        setIsLoading(false);
        setUploadedFile(null);
        setProcessingFile(false);
        thinkingMessageIdRef.current = null;
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Add thinking message
    const thinkingMessageId = `thinking-${Date.now()}`;
    thinkingMessageIdRef.current = thinkingMessageId;
    const thinkingMessage: Message = {
      id: thinkingMessageId,
      type: "assistant",
      content: "thinking...",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, thinkingMessage]);

    try {
      // Check if this is a payment command
      const paymentMatch = input.match(/pay\s+(expense|invoice)\s+#?(\d+)/i);
      const emailPaymentMatch = input.match(/send\s+\$?([\d,]+\.?\d*)\s+(?:usdc\s+)?to\s+([^\s@]+@[^\s@]+)/i);
      
      if (paymentMatch) {
        // Handle payment by expense ID
        const expenseId = parseInt(paymentMatch[2]);
        
        // Fetch expense details
        const expenseRes = await fetch(`/api/expenses/${expenseId}`);
        if (!expenseRes.ok) {
          throw new Error("Expense not found");
        }
        
        const expense = await expenseRes.json();
        
        if (expense.status === "paid") {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: "assistant",
            content: `Expense #${expenseId} has already been paid.`,
            timestamp: new Date(),
          };
          setMessages(prev => {
            const thinkingId = thinkingMessageIdRef.current;
            // Replace thinking message with actual response, and filter out any remaining thinking messages
            const updated = thinkingId 
              ? prev.map(msg => msg.id === thinkingId ? assistantMessage : msg)
              : [...prev, assistantMessage];
            // Remove any remaining thinking messages (safety check)
            return updated.filter(msg => msg.content !== "thinking...");
          });
        } else {
          // Process payment
          const paymentRes = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "send_payment",
              data: {
                email: expense.sales_email,
                amount: expense.amount,
                memo: `Payment for expense #${expenseId} - ${expense.company_name || "Invoice"}`,
                expense_id: expenseId
              }
            })
          });
          
          const result = await paymentRes.json();
          
                  const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    type: "assistant",
                    content: result.success 
                      ? `✅ Payment of $${expense.amount} sent successfully to ${expense.sales_email} for expense #${expenseId}`
                      : `❌ Payment failed: ${result.result || "Unknown error"}`,
                    timestamp: new Date(),
                  };
                  setMessages(prev => {
                    const thinkingId = thinkingMessageIdRef.current;
                    return thinkingId ? prev.map(msg => msg.id === thinkingId ? assistantMessage : msg) : [...prev, assistantMessage];
                  });
        }
      } else if (emailPaymentMatch) {
        // Handle direct email payment
        const amount = parseFloat(emailPaymentMatch[1].replace(/,/g, ''));
        const email = emailPaymentMatch[2];
        
        const paymentRes = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send_payment",
            data: {
              email,
              amount,
              memo: `Direct payment via chat`
            }
          })
        });
        
        const result = await paymentRes.json();
        
                const assistantMessage: Message = {
                  id: (Date.now() + 1).toString(),
                  type: "assistant",
                  content: result.success 
                    ? `✅ Payment of $${amount} sent successfully to ${email}`
                    : `❌ Payment failed: ${result.result || "Unknown error"}`,
                  timestamp: new Date(),
                };
                setMessages(prev => {
                  const thinkingId = thinkingMessageIdRef.current;
                  return thinkingId ? prev.map(msg => msg.id === thinkingId ? assistantMessage : msg) : [...prev, assistantMessage];
                });
      } else {
        // Check if user is pasting invoice text (contains typical invoice keywords)
        const isInvoiceText = input.length > 50 && (
          input.toLowerCase().includes('invoice') || 
          input.toLowerCase().includes('amount') ||
          input.toLowerCase().includes('due date') ||
          (input.includes('$') && input.match(/\d+/))
        );
        
        if (isInvoiceText) {
          // Process as invoice extraction
          const agentRes = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "extract_invoice",
              data: { text: input },
            }),
          });
          
          const agentData = await agentRes.json();
          
          let response = "I've extracted the following information from your text:\n\n";
          let invoiceContext = "";
          
          if (agentData.data) {
            if (agentData.data.company_name) {
              response += `**Company:** ${agentData.data.company_name}\n`;
              invoiceContext += `Company: ${agentData.data.company_name}. `;
            }
            if (agentData.data.amount) {
              response += `**Amount:** $${agentData.data.amount}\n`;
              invoiceContext += `Amount: $${agentData.data.amount}. `;
            }
            if (agentData.data.sales_email) {
              response += `**Email:** ${agentData.data.sales_email}\n`;
              invoiceContext += `Email: ${agentData.data.sales_email}. `;
            }
            if (agentData.data.due_date) {
              response += `**Due Date:** ${agentData.data.due_date}\n`;
              invoiceContext += `Due Date: ${agentData.data.due_date}. `;
            }
            if (agentData.data.category) {
              response += `**Category:** ${agentData.data.category}`;
              if (agentData.data.isNewCategory) response += " (new category)";
              response += "\n";
              invoiceContext += `Category: ${agentData.data.category}. `;
            }
            
            response += `\n[Invoice Data: ${invoiceContext}]\n\nWould you like me to create this expense?`;
          } else {
            response = "I couldn't extract invoice information from that text. Please include details like company name, amount, and email.";
          }
          
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: "assistant",
            content: response,
            timestamp: new Date(),
          };
          
          setMessages(prev => {
            const thinkingId = thinkingMessageIdRef.current;
            // Replace thinking message with actual response, and filter out any remaining thinking messages
            const updated = thinkingId 
              ? prev.map(msg => msg.id === thinkingId ? assistantMessage : msg)
              : [...prev, assistantMessage];
            // Remove any remaining thinking messages (safety check)
            return updated.filter(msg => msg.content !== "thinking...");
          });
        } else {
          // Check if this is an email sending request (more flexible patterns)
          const emailPatterns = [
            // "send a test email to email@example.com"
            /send\s+(?:a\s+)?(?:test\s+)?email\s+(?:to\s+)?([^\s@]+@[^\s@]+)(?:\s+(?:about|regarding|with|saying|that|:)?\s*(.+))?/i,
            // "email email@example.com about something"
            /email\s+([^\s@]+@[^\s@]+)(?:\s+(?:about|regarding|with|saying|that|:)?\s*(.+))?/i,
            // "send email@example.com an email"
            /send\s+([^\s@]+@[^\s@]+)\s+(?:an\s+)?(?:test\s+)?email(?:\s+(?:about|regarding|with|saying|that|:)?\s*(.+))?/i,
            // "write an email to email@example.com"
            /write\s+(?:an\s+)?(?:test\s+)?email\s+(?:to\s+)?([^\s@]+@[^\s@]+)(?:\s+(?:about|regarding|with|saying|that|:)?\s*(.+))?/i,
            // "send email to email@example.com"
            /send\s+email\s+to\s+([^\s@]+@[^\s@]+)(?:\s+(?:about|regarding|with|saying|that|:)?\s*(.+))?/i,
            // "just send [email]"
            /just\s+send\s+(?:a\s+)?(?:test\s+)?email\s+(?:to\s+)?([^\s@]+@[^\s@]+)/i,
          ];
          
          let emailMatch = null;
          for (const pattern of emailPatterns) {
            const match = input.match(pattern);
            if (match) {
              emailMatch = match;
              break;
            }
          }
          
          // If no direct email match but user mentions "send email" or "test email", check recent messages for email addresses
          if (!emailMatch && ((input.toLowerCase().includes('send') && input.toLowerCase().includes('email')) || input.toLowerCase().includes('test email'))) {
            // Look for email addresses in recent messages
            const recentMessages = messages.slice(-10);
            const emailRegex = /([^\s@]+@[^\s@]+)/g;
            let foundEmail = null;
            
            for (let i = recentMessages.length - 1; i >= 0; i--) {
              const msg = recentMessages[i];
              const emailMatches = msg.content.match(emailRegex);
              if (emailMatches && emailMatches.length > 0) {
                foundEmail = emailMatches[0];
                break;
              }
            }
            
            if (foundEmail) {
              emailMatch = [null, foundEmail, input.toLowerCase().includes('test') ? 'This is a test email to verify the email sending functionality.' : ''];
            }
          }
          
          if (emailMatch) {
            const recipientEmail = emailMatch[1];
            const emailContent = emailMatch[2] || (input.toLowerCase().includes('test') ? 'This is a test email to verify the email sending functionality.' : '');
            
            // Ask Claude to format the email professionally
            const recentMessages = messages.slice(-10).map(msg => ({
              role: msg.type === "user" ? "user" : "assistant",
              content: msg.content
            }));
            
            // Determine email content based on context
            let emailPrompt = '';
            if (emailContent && emailContent.trim()) {
              emailPrompt = `The user wants to send an email to ${recipientEmail}. Content: "${emailContent}".`;
            } else if (input.toLowerCase().includes('test')) {
              emailPrompt = `The user wants to send a test email to ${recipientEmail} to verify email functionality.`;
            } else {
              // Check recent conversation for context
              const lastUserMessage = recentMessages.filter(m => m.role === 'user').pop();
              if (lastUserMessage && lastUserMessage.content.toLowerCase().includes('email')) {
                emailPrompt = `The user wants to send an email to ${recipientEmail} based on the conversation context.`;
              } else {
                emailPrompt = `The user wants to send an email to ${recipientEmail}.`;
              }
            }
            
            const formatResponse = await fetch("/api/agent", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "process_query",
                data: { 
                  query: `${emailPrompt}

Please format this as a professional email with:
1. A clear, professional subject line (use "Test Email" if it's a test)
2. Appropriate greeting (Dear/Hi/Hello based on context)
3. Well-structured body paragraph(s)
4. Professional closing with contact information (YC@testing.james.baby)

Return ONLY a JSON object in this exact format:
{
  "subject": "Subject line here",
  "body": "Full email text here with line breaks",
  "html": "<p>HTML formatted email here</p>"
}`,
                  chatHistory: recentMessages 
                },
              }),
            });
            
            const formatData = await formatResponse.json();
            
            // Try to extract email details from Claude's response
            let emailSubject = `Message from YC@testing.james.baby`;
            let emailBody = emailContent;
            let emailHtml = '';
            
            try {
              // Try to parse JSON from response
              const jsonMatch = formatData.response?.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                emailSubject = parsed.subject || emailSubject;
                emailBody = parsed.body || emailContent;
                emailHtml = parsed.html || `<p>${emailBody.replace(/\n/g, '<br>')}</p>`;
              } else {
                // If no JSON, try to extract subject and body from text
                const subjectMatch = formatData.response?.match(/subject[:\s]+(.+?)(?:\n|$)/i);
                if (subjectMatch) emailSubject = subjectMatch[1].trim();
                emailBody = formatData.response || emailContent;
                emailHtml = `<p>${emailBody.replace(/\n/g, '<br>')}</p>`;
              }
            } catch (e) {
              // Use defaults if parsing fails
              emailBody = formatData.response || emailContent;
              emailHtml = `<p>${emailBody.replace(/\n/g, '<br>')}</p>`;
            }
            
            // Send the email
            const emailRes = await fetch("/api/agent", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "send_email",
                data: {
                  to: recipientEmail,
                  subject: emailSubject,
                  body: emailBody,
                  html: emailHtml,
                  from: 'YC@testing.james.baby'
                }
              }),
            });
            
            const emailResult = await emailRes.json();
            
            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              type: "assistant",
              content: emailResult.success 
                ? `✅ Email sent successfully to ${recipientEmail}!\n\n**Subject:** ${emailSubject}\n\n**Message:** ${emailBody.substring(0, 200)}${emailBody.length > 200 ? '...' : ''}`
                : `❌ Failed to send email: ${emailResult.error || "Unknown error"}`,
              timestamp: new Date(),
            };
            
            setMessages(prev => {
              const thinkingId = thinkingMessageIdRef.current;
              const updated = thinkingId 
                ? prev.map(msg => msg.id === thinkingId ? assistantMessage : msg)
                : [...prev, assistantMessage];
              return updated.filter(msg => msg.content !== "thinking...");
            });
          } else {
            // Regular query processing - include recent chat history for context
            const recentMessages = messages.slice(-10).map(msg => ({
              role: msg.type === "user" ? "user" : "assistant",
              content: msg.content
            }));
            
            const response = await fetch("/api/agent", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "process_query",
                data: { 
                  query: input,
                  chatHistory: recentMessages 
                },
              }),
            });

            const data = await response.json();

            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              type: "assistant",
              content: data.response || "I couldn't process that request. Please try again.",
              timestamp: new Date(),
              expense: data.expense || null,
            };

            setMessages(prev => {
              const thinkingId = thinkingMessageIdRef.current;
              // Replace thinking message with actual response, and filter out any remaining thinking messages
              const updated = thinkingId 
                ? prev.map(msg => msg.id === thinkingId ? assistantMessage : msg)
                : [...prev, assistantMessage];
              // Remove any remaining thinking messages (safety check)
              return updated.filter(msg => msg.content !== "thinking...");
            });
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => {
        const thinkingId = thinkingMessageIdRef.current;
        // Replace thinking message with error, and filter out any remaining thinking messages
        const updated = thinkingId 
          ? prev.map(msg => msg.id === thinkingId ? errorMessage : msg)
          : [...prev, errorMessage];
        // Remove any remaining thinking messages (safety check)
        return updated.filter(msg => msg.content !== "thinking...");
      });
    } finally {
      setIsLoading(false);
      thinkingMessageIdRef.current = null;
    }
  };

  const clearChat = () => {
    if (confirm("Are you sure you want to clear the chat history?")) {
      setMessages([]);
      localStorage.removeItem("chat-messages");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-700 pb-4 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
              Ask Your Spending Assistant
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Chat with AI about expenses, upload invoices, or manage payments
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
              title="Clear chat history"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="h-12 w-12 mx-auto text-neutral-400 mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400">
              Start a conversation or drag an invoice here to begin
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.type === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.type === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[70%] rounded-lg px-4 py-2",
                  message.type === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                )}
              >
                {message.content === "thinking..." ? (
                  <TextShimmer className="text-sm font-medium">
                    thinking...
                  </TextShimmer>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
                
                {/* Expense Card */}
                {message.expense && (
                  <div className="mt-3 p-4 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                        <span className="text-xl">💼</span>
                        {message.expense.company}
                      </h3>
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        message.expense.status === "paid" 
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : message.expense.status === "created"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      )}>
                        {message.expense.status === "paid" 
                          ? "✓ Paid" 
                          : message.expense.status === "created"
                          ? "📋 Created"
                          : "⏳ Pending"}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-600 dark:text-neutral-400">Amount</span>
                        <span className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
                          ${message.expense.amount}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-600 dark:text-neutral-400">Email</span>
                        <span className="text-neutral-900 dark:text-neutral-100 font-mono text-xs">
                          {message.expense.email}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {message.attachment && (
                  <div className="mt-2">
                    {message.attachment.processing ? (
                      <div className="flex items-center gap-2 p-2 rounded bg-white/10 dark:bg-black/10">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">{message.attachment.name}</span>
                      </div>
                    ) : (
                      <a
                        href={message.attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded bg-white/10 dark:bg-black/10 hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        <span className="text-sm underline">{message.attachment.name}</span>
                      </a>
                    )}
                  </div>
                )}
                {message.content !== "thinking..." && (
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                )}
              </div>
              {message.type === "user" && (
                <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-600 flex items-center justify-center">
                  <User className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Dropzone overlay */}
      <div
        {...getRootProps()}
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity pointer-events-none",
          isDragActive
            ? "opacity-100 bg-blue-50/90 dark:bg-blue-900/20 z-50 pointer-events-auto"
            : "opacity-0"
        )}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          <Upload className="h-12 w-12 mx-auto text-blue-500 mb-2" />
          <p className="text-lg font-medium text-blue-600 dark:text-blue-400">
            Drop your invoice here
          </p>
          <p className="text-sm text-blue-500 dark:text-blue-300">
            Supports PDF and images
          </p>
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about expenses, payments, or upload an invoice..."
            className="w-full px-4 py-3 pr-12 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading || processingFile}
          />
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*,.pdf"
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                onDrop([files[0]]);
              }
            }}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || processingFile}
          >
            {processingFile ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
          </button>
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isLoading || processingFile}
          className="px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </form>
    </div>
  );
}
