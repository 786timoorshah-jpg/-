import { Customer, JournalTransaction, Hawala, BackupData, AppSettings } from '../types';
import { formatAmount, formatToPersianDate } from './formatters';

/**
 * Downloads a string content as a file with UTF-8 BOM prefix
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convert customers array to UTF-8 CSV
 */
export function exportCustomersToCSV(customers: Customer[]): void {
  const headers = ['کد شناسایی', 'نام مشتری', 'شماره تماس', 'واحد پول', 'بیلانس فعلی', 'نوع حساب', 'تاریخ ثبت'];
  const rows = customers.map(c => [
    `"${c.id}"`,
    `"${c.name.replace(/"/g, '""')}"`,
    `"${c.phone}"`,
    `"${c.currency}"`,
    `"${formatAmount(c.balance)}"`,
    `"${c.balance > 0 ? 'طلب' : c.balance < 0 ? 'گرفت' : 'تسویه'}"`,
    `"${formatToPersianDate(c.createdAt)}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  downloadFile(csvContent, `STS_Customers_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Convert journal transactions array to UTF-8 CSV
 */
export function exportTransactionsToCSV(transactions: JournalTransaction[]): void {
  const headers = ['شماره تراکنش', 'نام مشتری', 'نوع تراکنش', 'مبلغ', 'واحد پول', 'تاریخ', 'زمان', 'شرح و توضیح'];
  const rows = transactions.map(tx => [
    `"${tx.id}"`,
    `"${tx.customerName.replace(/"/g, '""')}"`,
    `"${tx.type === 'debit' ? 'طلب' : 'گرفت'}"`,
    `"${formatAmount(tx.amount)}"`,
    `"${tx.currency}"`,
    `"${formatToPersianDate(tx.date)}"`,
    `"${tx.time || ''}"`,
    `"${(tx.description || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  downloadFile(csvContent, `STS_Journal_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Convert hawalas array to UTF-8 CSV
 */
export function exportHawalasToCSV(hawalas: Hawala[]): void {
  const headers = ['شماره حواله', 'کد پیگیری', 'نام فرستنده', 'تلفن فرستنده', 'نام گیرنده', 'تلفن گیرنده', 'شهر مقصد', 'مبلغ', 'واحد پول', 'کمیشن', 'وضعیت', 'تاریخ', 'توضیحات'];
  const rows = hawalas.map(h => [
    `"${h.hawalaNumber}"`,
    `"${h.hawalaCode}"`,
    `"${h.senderName.replace(/"/g, '""')}"`,
    `"${h.senderPhone}"`,
    `"${h.receiverName.replace(/"/g, '""')}"`,
    `"${h.receiverPhone}"`,
    `"${h.destinationCity.replace(/"/g, '""')}"`,
    `"${formatAmount(h.amount)}"`,
    `"${h.currency}"`,
    `"${formatAmount(h.commission)}"`,
    `"${h.status === 'completed' ? 'اجرا شده' : h.status === 'cancelled' ? 'لغو شده' : 'در حال انتظار'}"`,
    `"${formatToPersianDate(h.date)}"`,
    `"${(h.description || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  downloadFile(csvContent, `STS_Hawalas_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Export full JSON Backup
 */
export function exportFullBackupJSON(backupData: BackupData): void {
  const jsonContent = JSON.stringify(backupData, null, 2);
  const filename = `STS_Sadat_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  downloadFile(jsonContent, filename, 'application/json;charset=utf-8;');
}

/**
 * Validate backup file structure
 */
export function validateBackupFile(data: any): { isValid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'فایل بکاپ نامعتبر است (ساختار داده‌ای یافت نشد).' };
  }
  if (!Array.isArray(data.customers)) {
    return { isValid: false, error: 'بخش اطلاعات مشتریان در فایل بکاپ نامعتبر است.' };
  }
  if (!Array.isArray(data.transactions)) {
    return { isValid: false, error: 'بخش تراکنش‌های روزنامچه در فایل بکاپ نامعتبر است.' };
  }
  if (!Array.isArray(data.hawalas)) {
    return { isValid: false, error: 'بخش حواله‌ها در فایل بکاپ نامعتبر است.' };
  }
  return { isValid: true };
}

/**
 * Simple CSV parser for customer import
 */
export function parseCSVToRows(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, ''); // remove BOM if present
  const lines = cleanText.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);
  
  return lines.map(line => {
    const row: string[] = [];
    let insideQuotes = false;
    let currentVal = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          currentVal += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    row.push(currentVal.trim());
    return row;
  });
}

/**
 * Reads a File object as text
 */
export function readJSONFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}

