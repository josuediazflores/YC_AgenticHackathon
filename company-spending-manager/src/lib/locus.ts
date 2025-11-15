// Locus payment integration utilities
// This file provides helper functions for interacting with Locus through the Claude Agent SDK

export interface LocusPaymentContext {
  budget: {
    total: number;
    spent: number;
    remaining: number;
  };
  whitelistedContacts: Array<{
    contactNumber: number;
    name: string;
    address: string;
  }>;
}

export interface LocusPaymentResult {
  success: boolean;
  transactionId?: string;
  message: string;
  amount?: number;
  recipient?: string;
}

// Helper function to parse Locus payment context from Claude response
export function parsePaymentContext(response: string): LocusPaymentContext | null {
  try {
    // Extract budget information
    const budgetMatch = response.match(/budget[:\s]+\$?([\d,]+\.?\d*)/i);
    const spentMatch = response.match(/spent[:\s]+\$?([\d,]+\.?\d*)/i);
    const remainingMatch = response.match(/remaining[:\s]+\$?([\d,]+\.?\d*)/i);
    
    const budget = {
      total: budgetMatch ? parseFloat(budgetMatch[1].replace(/,/g, '')) : 0,
      spent: spentMatch ? parseFloat(spentMatch[1].replace(/,/g, '')) : 0,
      remaining: remainingMatch ? parseFloat(remainingMatch[1].replace(/,/g, '')) : 0
    };

    // Extract whitelisted contacts
    const contactMatches = response.matchAll(/contact\s*#?(\d+)[:\s]+([^,\n]+)(?:[,\s]+address[:\s]+)?([0-9a-fA-Fx]+)?/gi);
    const whitelistedContacts = [];
    
    for (const match of contactMatches) {
      whitelistedContacts.push({
        contactNumber: parseInt(match[1]),
        name: match[2].trim(),
        address: match[3] || ''
      });
    }

    return {
      budget,
      whitelistedContacts
    };
  } catch (error) {
    console.error('Error parsing payment context:', error);
    return null;
  }
}

// Helper function to parse payment result from Claude response
export function parsePaymentResult(response: string): LocusPaymentResult {
  try {
    const successMatch = response.match(/success|completed|sent/i);
    const transactionMatch = response.match(/transaction[_\s]?id[:\s]+([a-zA-Z0-9-]+)/i);
    const amountMatch = response.match(/\$?([\d,]+\.?\d*)\s*USDC/i);
    const recipientMatch = response.match(/to[:\s]+([^\s,]+@[^\s,]+)/i);
    
    return {
      success: !!successMatch,
      transactionId: transactionMatch ? transactionMatch[1] : undefined,
      message: response,
      amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : undefined,
      recipient: recipientMatch ? recipientMatch[1] : undefined
    };
  } catch (error) {
    console.error('Error parsing payment result:', error);
    return {
      success: false,
      message: response
    };
  }
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Format USDC amount for display
export function formatUSDC(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount).replace('$', '');
}
