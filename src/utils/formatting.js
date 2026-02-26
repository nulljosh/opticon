/**
 * Shared currency formatting utility.
 * Handles USD/CAD with compact notation for large values.
 */
export function formatCurrency(n, currency = 'USD') {
  if (typeof n !== 'number' || isNaN(n)) return '$0.00';
  const prefix = currency === 'CAD' ? 'CA$' : '$';
  if (Math.abs(n) >= 1e6) return `${prefix}${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${prefix}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${prefix}${n.toFixed(2)}`;
}
