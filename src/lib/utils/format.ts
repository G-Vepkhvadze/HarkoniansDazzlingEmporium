/**
 * Shared formatting utilities.
 * Used across components to ensure consistent formatting.
 */

/**
 * Format a number as a gold currency string.
 * Example: 1500 -> "1,500 Gold"
 */
export function formatGold(n: number): string {
  return `${n.toLocaleString()} Gold`;
}

/**
 * Calculate the sale price after applying a discount percentage.
 * Rounds to nearest integer.
 */
export function calculateSalePrice(price: number, discountPercent: number): number {
  if (discountPercent <= 0) {
    return price;
  }
  return Math.round(price * (1 - discountPercent / 100));
}

/**
 * Format a number as a percentage string.
 * Example: 25 -> "25%"
 */
export function formatPercent(n: number): string {
  return `${n}%`;
}

/**
 * Format a number with locale-aware formatting.
 * Example: 1500 -> "1,500"
 */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Format a date for display.
 * Example: new Date() -> "September 7, 2026"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a date for relative display (e.g., "2 hours ago").
 */
export function formatDateRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 7) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  }
  return 'Just now';
}

/**
 * Format a price range.
 * Example: formatPriceRange(100, 200) -> "100 - 200 Gold"
 */
export function formatPriceRange(min: number, max: number): string {
  return `${formatNumber(min)} - ${formatNumber(max)} Gold`;
}

/**
 * Format stock availability.
 */
export function formatStock(stock: number): string {
  if (stock <= 0) return 'Out of stock';
  if (stock === -1) return 'Unlimited';
  return `${stock} in stock`;
}
