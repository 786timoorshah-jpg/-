import { JournalTransaction, Hawala, Customer, WhatsAppTemplates, CurrencyCode } from '../types';
import { formatAmount, formatCurrency, formatToPersianDate, sanitizePhoneNumberForWhatsApp } from './formatters';

export const DEFAULT_TEMPLATES: WhatsAppTemplates = {
  transaction: `سلام {name} عزیز

ثبت {kind} به مبلغ {amount} {currency}

تاریخ: {date}

توضیح: {note}

بیلانس جدید: {balance} {currency}

STS سادات
خدمات پولی و صرافی`,

  hawala: `سلام {name} عزیز

حواله شما ثبت گردید.

کد حواله: {code}
شماره حواله: {hawalaNumber}
گیرنده: {receiver}
شهر مقصد: {city}
مبلغ: {amount} {currency}
کمیشن: {fee} {currency}
تاریخ: {date}
وضعیت: {status}

STS سادات
خدمات پولی و صرافی`,

  customerBalance: `سلام {name} عزیز

صورتحساب شما در سیستم صرافی و خدمات پولی STS سادات:

وضعیت حساب: {status}
مبلغ بیلانس: {balance} {currency}
تاریخ استعلام: {date}

STS سادات
خدمات پولی و صرافی`
};

export function buildTransactionMessage(
  tx: JournalTransaction,
  newBalance: number,
  template = DEFAULT_TEMPLATES.transaction
): string {
  const kindLabel = tx.type === 'debit' ? 'طلب' : 'گرفت';
  const dateFormatted = formatToPersianDate(tx.date);
  const formattedAmount = formatAmount(tx.amount);
  const formattedBalance = formatAmount(Math.abs(newBalance));
  const balanceNote = newBalance > 0 ? `${formattedBalance} (طلب)` : newBalance < 0 ? `${formattedBalance} (گرفت)` : '0 (تسویه)';

  const cleanTemplate = (template || DEFAULT_TEMPLATES.transaction)
    .replace(/^.*(?:شماره تماس|{managerPhone}).*$\n?/gm, '');

  return cleanTemplate
    .replace(/{name}/g, tx.customerName || 'مشتری')
    .replace(/{kind}/g, kindLabel)
    .replace(/{amount}/g, formattedAmount)
    .replace(/{currency}/g, tx.currency || 'AFN')
    .replace(/{date}/g, dateFormatted)
    .replace(/{note}/g, tx.description || 'بدون توضیح')
    .replace(/{balance}/g, balanceNote);
}

export function buildHawalaMessage(
  hawala: Hawala,
  template = DEFAULT_TEMPLATES.hawala
): string {
  const statusLabel = hawala.status === 'completed' ? 'اجرا شده / تحویل شده' : hawala.status === 'cancelled' ? 'لغو شده' : 'در حال انتظار';
  const dateFormatted = formatToPersianDate(hawala.date);
  const formattedAmount = formatAmount(hawala.amount);
  const formattedFee = formatAmount(hawala.commission);

  const cleanTemplate = (template || DEFAULT_TEMPLATES.hawala)
    .replace(/^.*(?:شماره تماس|{managerPhone}).*$\n?/gm, '');

  return cleanTemplate
    .replace(/{name}/g, hawala.senderName || 'مشتری')
    .replace(/{code}/g, hawala.hawalaCode)
    .replace(/{hawalaNumber}/g, hawala.hawalaNumber)
    .replace(/{receiver}/g, hawala.receiverName)
    .replace(/{city}/g, hawala.destinationCity)
    .replace(/{amount}/g, formattedAmount)
    .replace(/{currency}/g, hawala.currency || 'AFN')
    .replace(/{fee}/g, formattedFee)
    .replace(/{date}/g, dateFormatted)
    .replace(/{status}/g, statusLabel);
}

export function buildCustomerBalanceMessage(
  customer: Customer,
  _managerPhone = '',
  template = DEFAULT_TEMPLATES.customerBalance
): string {
  const statusLabel = customer.balance > 0 
    ? 'طلب' 
    : customer.balance < 0 
      ? 'گرفت' 
      : 'حساب کاملاً تسویه است';
  
  const formattedBalance = formatAmount(Math.abs(customer.balance));
  const today = formatToPersianDate(new Date().toISOString().split('T')[0]);

  // حذف کامل خط شماره تماس از پیام ارسال به واتساپ
  const cleanTemplate = (template || DEFAULT_TEMPLATES.customerBalance)
    .replace(/^.*(?:شماره تماس|{managerPhone}).*$\n?/gm, '')
    .trim();

  return cleanTemplate
    .replace(/{name}/g, customer.name)
    .replace(/{status}/g, statusLabel)
    .replace(/{balance}/g, formattedBalance)
    .replace(/{currency}/g, customer.currency || 'AFN')
    .replace(/{date}/g, today);
}

/**
 * Generate a complete, properly UTF-8 encoded WhatsApp Web URL
 * Uses encodeURIComponent to guarantee Persian/Dari text never turns into "?????"
 */
export function getWhatsAppShareUrl(phoneNumber: string, message: string): string {
  const sanitizedPhone = sanitizePhoneNumberForWhatsApp(phoneNumber);
  const encodedText = encodeURIComponent(message);
  
  if (sanitizedPhone) {
    return `https://wa.me/${sanitizedPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

export function openWhatsApp(phoneNumber: string, message: string): void {
  const url = getWhatsAppShareUrl(phoneNumber, message);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
