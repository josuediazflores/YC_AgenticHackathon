"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Upload, Loader2, Bot, User } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { InvoiceProcessor } from "@/components/invoice-processor";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setUploadedFile(file);
      
      // Upload file
      const formData = new FormData();
      formData.append("file", file);
      
      try {
        const uploadRes = await fetch("/api/invoices/upload", {
          method: "POST",
          body: formData,
        });
        
        if (!uploadRes.ok) throw new Error("Upload failed");
        
        const uploadData = await uploadRes.json();
        
        // Add user message
        const userMessage: Message = {
          id: Date.now().toString(),
          type: "user",
          content: `I've uploaded an invoice: ${file.name}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        
        // Process with agent
        setIsLoading(true);
        const agentRes = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "extract_invoice",
            data: { 
              text: "Please extract data from the uploaded invoice",
              file_url: uploadData.url 
            },
          }),
        });
        
        const agentData = await agentRes.json();
        
        // Create assistant response
        let response = "I've extracted the following information from your invoice:\n\n";
        if (agentData.data) {
          if (agentData.data.company_name) response += `**Company:** ${agentData.data.company_name}\n`;
          if (agentData.data.amount) response += `**Amount:** $${agentData.data.amount}\n`;
          if (agentData.data.sales_email) response += `**Email:** ${agentData.data.sales_email}\n`;
          if (agentData.data.due_date) response += `**Due Date:** ${agentData.data.due_date}\n`;
          if (agentData.data.category) {
            response += `**Category:** ${agentData.data.category}`;
            if (agentData.data.isNewCategory) response += " (new category)";
            response += "\n";
          }
          response += "\nWould you like me to create this expense?";
        } else {
          response = "I couldn't extract information from this invoice. Please try uploading a clearer image or PDF.";
        }
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: response,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        
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
        // Regular query processing
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "process_query",
            data: { query: input },
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-700 pb-4 mb-4">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Ask Your Spending Assistant
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
          Chat with AI about expenses, upload invoices, or manage payments
        </p>
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
            disabled={isLoading}
          />
          <button
            type="button"
            {...getRootProps()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            onClick={(e) => e.stopPropagation()}
          >
            <input {...getInputProps()} />
            <Upload className="h-5 w-5" />
          </button>
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
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
