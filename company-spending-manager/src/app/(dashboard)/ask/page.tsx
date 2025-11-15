"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Upload, Loader2, Bot, User, Paperclip, X, FileText, Trash2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { InvoiceProcessor } from "@/components/invoice-processor";

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
}

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processingFile, setProcessingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        content: `Uploading invoice...`,
        timestamp: new Date(),
        attachment: {
          name: file.name,
          url: "",
          processing: true
        }
      };
      setMessages(prev => [...prev, userMessage]);
      
      try {
        // Upload file
        const formData = new FormData();
        formData.append("file", file);
        
        const uploadRes = await fetch("/api/invoices/upload", {
          method: "POST",
          body: formData,
        });
        
        if (!uploadRes.ok) throw new Error("Upload failed");
        
        const uploadData = await uploadRes.json();
        
        // Update message with uploaded file URL
        setMessages(prev => prev.map(msg => 
          msg.id === userMessage.id 
            ? { 
                ...msg, 
                content: `I've uploaded an invoice: ${file.name}`,
                attachment: { ...msg.attachment!, url: uploadData.url, processing: false }
              }
            : msg
        ));
        
        // Process with agent
        setIsLoading(true);
        
        // Add processing message
        const processingMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: "Processing your invoice...",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, processingMessage]);
        
        // First extract text from PDF/image
        const extractRes = await fetch("/api/invoices/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl: uploadData.url }),
        });
        
        if (!extractRes.ok) {
          throw new Error("Failed to extract text from invoice");
        }
        
        const extractData = await extractRes.json();
        
        // Check if PDF parsing failed
        if (extractData.text && (extractData.text.includes('PDF_PARSE_ERROR') || extractData.text.includes('PDF_PARSE_EMPTY'))) {
          // Update processing message with error and instructions
          setMessages(prev => prev.map(msg => 
            msg.id === processingMessage.id 
              ? { 
                  ...msg, 
                  content: extractData.text.replace('PDF_PARSE_ERROR: ', '⚠️ ').replace('PDF_PARSE_EMPTY: ', '⚠️ ')
                }
              : msg
          ));
          setIsLoading(false);
          setUploadedFile(null);
          setProcessingFile(false);
          return;
        }
        
        // Then send extracted text to agent
        const agentRes = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "extract_invoice",
            data: { 
              text: extractData.text || "Could not extract text from invoice",
              file_url: uploadData.url 
            },
          }),
        });
        
        const agentData = await agentRes.json();
        
        // Create assistant response with structured data for AI context
        let response = "I've extracted the following information from your invoice:\n\n";
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
          
          // Store the extracted data in the response for future AI reference
          response += `\n[Invoice Data: ${invoiceContext}]\n\nWould you like me to create this expense?`;
        } else {
          response = "I couldn't extract information from this invoice. Please try uploading a clearer image or PDF.";
        }
        
        // Update processing message with final response
        setMessages(prev => prev.map(msg => 
          msg.id === processingMessage.id 
            ? { ...msg, content: response }
            : msg
        ));
        
      } catch (error) {
        console.error("Error processing invoice:", error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: "Sorry, I couldn't process that invoice. Please try again.",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        setUploadedFile(null);
        setProcessingFile(false);
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
          setMessages(prev => [...prev, assistantMessage]);
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
          setMessages(prev => [...prev, assistantMessage]);
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
        setMessages(prev => [...prev, assistantMessage]);
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
          
          setMessages(prev => [...prev, assistantMessage]);
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
          };

          setMessages(prev => [...prev, assistantMessage]);
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
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
                <p className="whitespace-pre-wrap">{message.content}</p>
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
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
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
