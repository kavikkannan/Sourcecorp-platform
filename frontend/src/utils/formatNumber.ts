/**
 * Format a number using Indian numbering system (e.g., 2,00,000)
 * @param value - The number to format
 * @param options - Intl.NumberFormatOptions
 * @returns Formatted string
 */
export function formatIndianNumber(
  value: number | string,
  options?: Intl.NumberFormatOptions
): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '0';
  
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    ...options,
  }).format(numValue);
}

/**
 * Format a currency amount in Indian Rupees using Indian numbering system
 * @param amount - The amount to format
 * @param showSymbol - Whether to show ₹ symbol (default: true)
 * @returns Formatted string (e.g., "₹2,00,000" or "2,00,000")
 */
export function formatIndianCurrency(
  amount: number | string,
  showSymbol: boolean = true
): string {
  const numValue = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numValue)) return showSymbol ? '₹0' : '0';
  
  const formatted = formatIndianNumber(numValue, {
    maximumFractionDigits: 0,
  });
  
  return showSymbol ? `₹${formatted}` : formatted;
}

