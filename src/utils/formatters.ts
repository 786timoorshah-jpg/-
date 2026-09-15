import { CurrencyCode } from '../types';

/**
 * Decimal-safe arithmetic to prevent floating-point calculation errors (e.g. 0.1 + 0.2 !== 0.3)
 */
export function roundToTwoDecimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function safeAdd(a: number, b: number): number {
  return Math.round((a * 100 + b * 100)) / 100;
}

export function safeSubtract(a: number, b: number): number {
  return Math.round((a * 100 - b * 100)) / 100;
}

export function safeMultiply(a: number, b: number): number {
  return Math.round((a * b + Number.EPSILON) * 100) / 100;
}

/**
 * Format monetary amount with comma grouping
 * e.g., 25500.5 => "25,500.50" or "25,500"
 */
export function formatAmount(amount: number, options?: { showSign?: boolean; showFraction?: boolean }): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: options?.showFraction ? 2 : (absAmount % 1 !== 0 ? 2 : 0),
    maximumFractionDigits: 2,
  }).format(absAmount);

  if (options?.showSign && amount !== 0) {
    return isNegative ? `-${formatted}` : `+${formatted}`;
  }
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format amount with currency suffix (e.g. "25,500 AFN" or "25,500 افغانی")
 */
export function formatCurrency(amount: number, currency: CurrencyCode = 'AFN', inPersianText = false): string {
  const formatted = formatAmount(amount);
  const currencyLabels: Record<CurrencyCode, { fa: string; en: string }> = {
    AFN: { fa: 'افغانی', en: 'AFN' },
    USD: { fa: 'دالر', en: 'USD' },
    EUR: { fa: 'یورو', en: 'EUR' },
    PKR: { fa: 'کلدار', en: 'PKR' },
    IRR: { fa: 'تومان', en: 'IRR' },
  };

  const label = inPersianText ? currencyLabels[currency]?.fa || currency : currency;
  return `${formatted} ${label}`;
}

/**
 * Convert standard YYYY-MM-DD to Persian Shamsi date string for display (Afghanistan usage)
 */
export function formatToPersianDate(dateString?: string): string {
  if (!dateString) return '';
  try {
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      
      const formatter = new Intl.DateTimeFormat('fa-AF-u-ca-persian', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      return formatter.format(date);
    }
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('fa-AF-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

/**
 * Format current or specific date to standard YYYY-MM-DD for input[type="date"]
 */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format current time to HH:mm
 */
export function getCurrentTimeString(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

/**
 * Sanitize Afghan phone number for WhatsApp
 * Examples: 0799123456 -> 93799123456, +93799123456 -> 93799123456
 */
export function sanitizePhoneNumberForWhatsApp(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.startsWith('0')) {
    cleaned = '93' + cleaned.substring(1);
  }
  if (cleaned.length === 9 && !cleaned.startsWith('93')) {
    cleaned = '93' + cleaned;
  }
  return cleaned;
}

/**
 * Generate a random unique tracking code (e.g. STS-74921)
 */
export function generateUniqueCode(prefix = 'STS'): string {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${randomNum}`;
}

/**
 * Format Hawala Number starting from 01 with no HW prefix and no extra leading zeros.
 * Examples:
 * 'HW-000001' -> '01'
 * 'HW-000002' -> '02'
 * '01' -> '01'
 * 5 -> '05'
 * 12 -> '12'
 */
export function formatHawalaNumber(value?: string | number): string {
  if (value === undefined || value === null || value === '') return '01';
  const str = String(value).trim();
  const digits = str.replace(/\D/g, '');
  if (!digits) return '01';
  const num = parseInt(digits, 10);
  if (isNaN(num) || num <= 0) return '01';
  return String(num).padStart(2, '0');
}
