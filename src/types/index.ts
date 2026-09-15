export type CurrencyCode = 'AFN' | 'USD' | 'EUR' | 'PKR' | 'IRR';

export interface CurrencyConfig {
  code: CurrencyCode;
  nameFa: string;
  symbol: string;
  isDefault?: boolean;
}

export type TransactionType = 'debit' | 'credit'; // debit = طلب (receivable / owed by customer), credit = گرفت (payable / received)

export interface Customer {
  id: string;
  name: string;
  phone: string;
  currency: CurrencyCode;
  balance: number; // Positive = طلب (Customer owes us or has debit), Negative = گرفت (We owe customer)
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface JournalTransaction {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  type: TransactionType; // debit (طلب) or credit (گرفت)
  amount: number;
  currency: CurrencyCode;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  description: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export type HawalaStatus = 'pending' | 'completed' | 'cancelled';

export interface Hawala {
  id: string;
  hawalaNumber: string; // Sequential: 01, 02, 03... (Starts from 01, no HW prefix, no extra zeros)
  hawalaCode: string;   // Unique tracking code e.g. STS-83921
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  destinationCity: string;
  amount: number;
  currency: CurrencyCode;
  commission: number;
  date: string;
  description?: string;
  status: HawalaStatus;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actionType: 'customer' | 'transaction' | 'hawala' | 'backup' | 'restore' | 'settings' | 'system';
  description: string;
  recordId?: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface TrashItem {
  id: string;
  itemType: 'customer' | 'transaction' | 'hawala';
  originalId: string;
  deletedAt: string;
  data: any;
}

export interface WhatsAppTemplates {
  transaction: string;
  customerBalance: string;
  hawala: string;
}

export interface AppSettings {
  appName: string;
  companyName: string;
  subtitle: string;
  managerName: string;
  managerPhone: string;
  address?: string;
  receiptFooterText?: string;
  defaultCurrency: CurrencyCode;
  supportedCurrencies: CurrencyConfig[];
  templates: WhatsAppTemplates;
  theme: 'light' | 'dark' | 'system';
  autoBackupEnabled: boolean;
  backupRetentionDays: number;
  lastBackupDate?: string;
  version: string;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  appName: string;
  customers: Customer[];
  transactions: JournalTransaction[];
  hawalas: Hawala[];
  auditLogs: AuditLog[];
  settings: AppSettings;
  hawalaCounter: number;
}

export type ActiveTab = 
  | 'dashboard'
  | 'journal'
  | 'hawala'
  | 'customers'
  | 'reports'
  | 'recycle_bin'
  | 'audit_log'
  | 'settings';
