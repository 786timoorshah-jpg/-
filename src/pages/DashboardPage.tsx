import React, { useState, useMemo } from 'react';
import {
  Customer,
  JournalTransaction,
  Hawala,
  AppSettings,
  ActiveTab,
  CurrencyCode,
} from '../types';
import {
  TrendingUp,
  TrendingDown,
  Users,
  SendHorizontal,
  Scale,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Printer,
  MessageCircle,
  PlusCircle,
  FileSpreadsheet,
  Wallet,
  Globe,
  Layers,
  Sparkles,
  Compass,
  Maximize2,
  Minimize2,
  ExternalLink,
  Sun,
  Moon,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { formatAmount, formatToPersianDate, safeAdd, safeSubtract } from '../utils/formatters';
import { openWhatsApp, buildTransactionMessage, buildHawalaMessage } from '../utils/whatsapp';
import { Modal } from '../components/common/Modal';

interface DashboardPageProps {
  customers: Customer[];
  transactions: JournalTransaction[];
  hawalas: Hawala[];
  settings: AppSettings;
  searchQuery?: string;
  onNavigate?: (tab: ActiveTab) => void;
  onSelectTab?: (tab: ActiveTab) => void;
  onOpenNewTransaction: (customerId?: string) => void;
  onOpenNewHawala: () => void;
  onPrintHawala: (hawala: Hawala) => void;
  onUpdateHawalaStatus: (id: string, status: Hawala['status']) => void;
  onDeleteTransaction?: (id: string, permanent?: boolean) => Promise<void>;
  isDetached?: boolean;
  onToggleDetach?: () => void;
  theme?: 'light' | 'dark' | 'system';
  onToggleTheme?: () => void;
}

export interface CurrencyStat {
  code: CurrencyCode;
  nameFa: string;
  symbol: string;
  totalDebit: number; // طلب (خروجی پرداختی به مشتریان / بدهکار)
  totalCredit: number; // گرفت (ورودی دریافتی از مشتریان / بستانکار)
  cashDrawer: number; // موجودی نقد صندوق = گرفت + کمیشن - طلب
  netReceivable: number; // تراز دفتری حساب‌ها = طلب - گرفت
  txCount: number;
  totalHawalaAmount: number;
  totalCommission: number;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  customers,
  transactions,
  hawalas,
  settings,
  searchQuery = '',
  onNavigate,
  onSelectTab,
  onOpenNewTransaction,
  onOpenNewHawala,
  onPrintHawala,
  onUpdateHawalaStatus,
  onDeleteTransaction,
  isDetached = false,
  onToggleDetach,
  theme = 'light',
  onToggleTheme,
}) => {
  const handleNavigate = onNavigate || onSelectTab || (() => {});

  // Selected Currency filter for Dashboard metrics: 'all' or specific currency code
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode | 'all'>(settings.defaultCurrency);
  // Transaction table display count limit (0 = all transactions)
  const [txLimit, setTxLimit] = useState<number>(0);
  const [deleteTargetTx, setDeleteTargetTx] = useState<JournalTransaction | null>(null);

  // Calculate detailed multi-currency statistics
  const currencyBreakdown = useMemo<Record<string, CurrencyStat>>(() => {
    const map: Record<string, CurrencyStat> = {};

    // Initialize all supported currencies from settings
    for (const c of settings.supportedCurrencies) {
      map[c.code] = {
        code: c.code,
        nameFa: c.nameFa,
        symbol: c.symbol,
        totalDebit: 0,
        totalCredit: 0,
        cashDrawer: 0,
        netReceivable: 0,
        txCount: 0,
        totalHawalaAmount: 0,
        totalCommission: 0,
      };
    }

    // Process ALL active journal transactions (without omitting any currency)
    for (const tx of transactions) {
      if (!map[tx.currency]) {
        map[tx.currency] = {
          code: tx.currency,
          nameFa: tx.currency,
          symbol: tx.currency,
          totalDebit: 0,
          totalCredit: 0,
          cashDrawer: 0,
          netReceivable: 0,
          txCount: 0,
          totalHawalaAmount: 0,
          totalCommission: 0,
        };
      }

      map[tx.currency].txCount++;
      if (tx.type === 'debit') {
        map[tx.currency].totalDebit = safeAdd(map[tx.currency].totalDebit, tx.amount);
      } else if (tx.type === 'credit') {
        map[tx.currency].totalCredit = safeAdd(map[tx.currency].totalCredit, tx.amount);
      }
    }

    // Process ALL active hawalas
    for (const h of hawalas) {
      if (!map[h.currency]) {
        map[h.currency] = {
          code: h.currency,
          nameFa: h.currency,
          symbol: h.currency,
          totalDebit: 0,
          totalCredit: 0,
          cashDrawer: 0,
          netReceivable: 0,
          txCount: 0,
          totalHawalaAmount: 0,
          totalCommission: 0,
        };
      }
      map[h.currency].totalHawalaAmount = safeAdd(map[h.currency].totalHawalaAmount, h.amount);
      map[h.currency].totalCommission = safeAdd(map[h.currency].totalCommission, h.commission);
    }

    // Calculate Cash Drawer and Net Receivable for each currency:
    // 1. موجودی نقد صندوق (Cash Drawer):
    //    هر گرفت (Credit) ورودی نقد است (+)
    //    هر کمیشن حواله ورودی نقد صرافی است (+)
    //    هر طلب (Debit) خروجی نقد است (-)
    //    صندوق = (مجموع گرفت + کمیشن) - مجموع طلب
    // 2. تراز دفتری مطالبات (Net Receivable):
    //    طلب - گرفت (اگر مثبت باشد یعنی ما طلبکاریم، اگر منفی باشد یعنی بدهکاریم)
    for (const key of Object.keys(map)) {
      const item = map[key];
      const cashIn = safeAdd(item.totalCredit, item.totalCommission);
      item.cashDrawer = safeSubtract(cashIn, item.totalDebit);
      item.netReceivable = safeSubtract(item.totalDebit, item.totalCredit);
    }

    return map;
  }, [transactions, hawalas, settings.supportedCurrencies]);

  // Overall or Selected stats for the primary top cards
  const activeStats = useMemo(() => {
    let pendingCount = 0;
    let completedCount = 0;
    for (const h of hawalas) {
      if (h.status === 'pending') pendingCount++;
      if (h.status === 'completed') completedCount++;
    }

    if (selectedCurrency !== 'all') {
      const stat: CurrencyStat = currencyBreakdown[selectedCurrency] || {
        code: selectedCurrency,
        nameFa: selectedCurrency,
        symbol: selectedCurrency,
        totalDebit: 0,
        totalCredit: 0,
        cashDrawer: 0,
        netReceivable: 0,
        txCount: 0,
        totalHawalaAmount: 0,
        totalCommission: 0,
      };

      return {
        isAll: false,
        currencyCode: stat.code,
        currencyName: stat.nameFa,
        totalDebit: stat.totalDebit,
        totalCredit: stat.totalCredit,
        cashDrawer: stat.cashDrawer,
        netReceivable: stat.netReceivable,
        totalCommission: stat.totalCommission,
        txCount: stat.txCount,
        customerCount: customers.length,
        hawalaCount: hawalas.length,
        pendingCount,
        completedCount,
      };
    }

    // If 'all' is selected:
    // Aggregate counts and use default currency as the primary figure, but flag as 'all'
    const defaultStat: CurrencyStat = currencyBreakdown[settings.defaultCurrency] || {
      code: settings.defaultCurrency,
      nameFa: 'افغانی',
      symbol: 'AFN',
      totalDebit: 0,
      totalCredit: 0,
      cashDrawer: 0,
      netReceivable: 0,
      txCount: 0,
      totalHawalaAmount: 0,
      totalCommission: 0,
    };

    return {
      isAll: true,
      currencyCode: defaultStat.code,
      currencyName: defaultStat.nameFa,
      totalDebit: defaultStat.totalDebit,
      totalCredit: defaultStat.totalCredit,
      cashDrawer: defaultStat.cashDrawer,
      netReceivable: defaultStat.netReceivable,
      totalCommission: defaultStat.totalCommission,
      txCount: transactions.length,
      customerCount: customers.length,
      hawalaCount: hawalas.length,
      pendingCount,
      completedCount,
    };
  }, [selectedCurrency, currencyBreakdown, transactions.length, hawalas, customers.length, settings.defaultCurrency]);

  // Filtered transactions for the dashboard table (ensuring ALL transactions are accessible)
  const filteredRecentTransactions = useMemo(() => {
    let list = transactions;

    // Filter by currency if specific currency is selected
    if (selectedCurrency !== 'all') {
      list = list.filter((t) => t.currency === selectedCurrency);
    }

    // Filter by search query if any
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.customerName.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          String(t.amount).includes(q) ||
          t.currency.toLowerCase().includes(q)
      );
    }

    return txLimit === 0 ? list : list.slice(0, txLimit);
  }, [transactions, selectedCurrency, searchQuery, txLimit]);

  const totalFilteredTxCount = useMemo(() => {
    let list = transactions;
    if (selectedCurrency !== 'all') {
      list = list.filter((t) => t.currency === selectedCurrency);
    }
    return list.length;
  }, [transactions, selectedCurrency]);

  const filteredRecentHawalas = useMemo(() => {
    let list = hawalas;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (h) =>
          h.hawalaNumber.toLowerCase().includes(q) ||
          h.hawalaCode.toLowerCase().includes(q) ||
          h.senderName.toLowerCase().includes(q) ||
          h.receiverName.toLowerCase().includes(q) ||
          h.destinationCity.toLowerCase().includes(q) ||
          h.currency.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 6);
  }, [hawalas, searchQuery]);

  return (
    <div className="relative h-full w-full overflow-hidden flex flex-col bg-emerald-950 text-slate-100">
      {/* Background: Pure rich emerald green background with subtle light layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-emerald-900 to-teal-950 pointer-events-none" />
      
      {/* Ambient glowing green orbs */}
      <div
        className="absolute -top-16 -right-16 w-[480px] h-[480px] bg-emerald-400/25 rounded-full blur-3xl pointer-events-none animate-pulse"
        style={{ animationDuration: '6s' }}
      />
      <div
        className="absolute -bottom-16 -left-16 w-[480px] h-[480px] bg-teal-400/25 rounded-full blur-3xl pointer-events-none animate-pulse"
        style={{ animationDuration: '7s' }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Independent Scrollable Content Body */}
      <div className="relative z-10 flex-1 overflow-y-auto scroll-smooth dashboard-scroll p-4 sm:p-6 lg:p-7 space-y-6 pb-24">
        {/* Top Bar: Currency Selector & Quick Transaction Action */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-emerald-950/80 backdrop-blur-xl p-4 rounded-2xl border border-emerald-700/60 shadow-lg shadow-emerald-950/30 transition-shadow">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5 ml-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>واحد محاسباتی داشبورد:</span>
            </span>

            <div className="flex flex-wrap items-center gap-1.5 bg-emerald-900/60 p-1 rounded-xl border border-emerald-700/60">
              <button
                onClick={() => setSelectedCurrency('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  selectedCurrency === 'all'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                    : 'text-emerald-200 hover:text-white hover:bg-emerald-800/60'
                }`}
              >
                همه ارزها (خلاصه جامع)
              </button>
              {settings.supportedCurrencies.map((c) => {
                const count = currencyBreakdown[c.code]?.txCount || 0;
                return (
                  <button
                    key={c.code}
                    onClick={() => setSelectedCurrency(c.code)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedCurrency === c.code
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                        : 'text-emerald-200 hover:text-white hover:bg-emerald-800/60'
                    }`}
                  >
                    <span>{c.nameFa}</span>
                    <span className="text-[10px] opacity-80 font-mono">({c.code})</span>
                    {count > 0 && (
                      <span
                        className={`text-[10px] px-1 rounded-full font-mono ${
                          selectedCurrency === c.code
                            ? 'bg-slate-950/30 text-slate-950'
                            : 'bg-emerald-800 text-emerald-200'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <button
              onClick={() => onOpenNewTransaction()}
              className="flex items-center gap-2 px-4 py-2 text-xs font-black text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 rounded-xl shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>ثبت تراکنش روزنامچه</span>
            </button>
            <button
              onClick={onOpenNewHawala}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-100 bg-emerald-800 hover:bg-emerald-700 rounded-xl border border-emerald-600/70 transition-colors cursor-pointer"
            >
              <SendHorizontal className="w-4 h-4 text-emerald-300" />
              <span>صدور حواله</span>
            </button>
          </div>
        </div>

        {/* Primary Financial Metric Cards (Floating Cards with Hover Lift) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Debit (مجموع طلب) */}
          <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl p-5 rounded-2xl border border-emerald-300/50 dark:border-emerald-800/50 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                <span>مجموع طلب</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                  طلب
                </span>
              </div>
              <div className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white font-mono">
                {formatAmount(activeStats.totalDebit)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <span>واحد:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {activeStats.currencyCode} ({activeStats.currencyName})
                </span>
                {activeStats.isAll && <span className="text-[10px] text-slate-400">(ارز پایه)</span>}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          {/* Total Credit (مجموع گرفت) */}
          <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl p-5 rounded-2xl border border-emerald-200/50 dark:border-emerald-900/40 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                <span>مجموع گرفت</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                  گرفت
                </span>
              </div>
              <div className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white font-mono">
                {formatAmount(activeStats.totalCredit)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <span>واحد:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {activeStats.currencyCode} ({activeStats.currencyName})
                </span>
                {activeStats.isAll && <span className="text-[10px] text-slate-400">(ارز پایه)</span>}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>

          {/* Real Cash Drawer Balance (موجودی نقد صندوق) */}
          <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl p-5 rounded-2xl border border-emerald-300/50 dark:border-emerald-800/50 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                <span>موجودی نقد صندوق</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                  گرفت - طلب + کمیشن
                </span>
              </div>
              <div
                className={`text-xl lg:text-2xl font-black font-mono ${
                  activeStats.cashDrawer >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatAmount(activeStats.cashDrawer, { showSign: true })}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <span className="font-medium">
                  {activeStats.cashDrawer >= 0 ? 'موجودی مثبت صندوق' : 'کسری نقدی صندوق'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">({activeStats.currencyCode})</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs border border-emerald-200/40 dark:border-emerald-800/40">
              <Wallet className="w-6 h-6" />
            </div>
          </div>

          {/* Hawala & Commissions */}
          <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl p-5 rounded-2xl border border-emerald-200/50 dark:border-emerald-900/40 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                کمیشن حواله‌ها ({activeStats.currencyCode})
              </div>
              <div className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white font-mono">
                {formatAmount(activeStats.totalCommission)}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                از مجموع {activeStats.hawalaCount} حواله در سیستم
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <Coins className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Quick stats mini ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-3.5 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30 flex items-center justify-between hover:-translate-y-0.5 transition-transform">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">تعداد مشتریان:</span>
              <div className="text-lg font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                {activeStats.customerCount} حساب
              </div>
            </div>
            <Users className="w-5 h-5 text-emerald-500" />
          </div>

          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-3.5 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30 flex items-center justify-between hover:-translate-y-0.5 transition-transform">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">حواله‌های در انتظار:</span>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {activeStats.pendingCount} حواله
              </div>
            </div>
            <Scale className="w-5 h-5 text-emerald-500" />
          </div>

          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-3.5 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30 flex items-center justify-between hover:-translate-y-0.5 transition-transform">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">حواله‌های پرداخت شده:</span>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {activeStats.completedCount} حواله
              </div>
            </div>
            <SendHorizontal className="w-5 h-5 text-emerald-500" />
          </div>

          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-3.5 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30 flex items-center justify-between hover:-translate-y-0.5 transition-transform">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">کل تراکنش‌های ثبت شده:</span>
              <div className="text-lg font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                {transactions.length} ثبت
              </div>
            </div>
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
          </div>
        </div>

        {/* Main split sections: Recent Transactions & Recent Hawalas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Right Column in RTL: Recent Journal Transactions (8 cols - بزرگتر و مجزا) */}
          <div className="lg:col-span-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl border-2 border-emerald-400/50 dark:border-emerald-600/50 p-5 sm:p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    تراکنش‌های روزنامچه در داشبورد
                  </h2>
                  <span className="text-xs bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
                    {totalFilteredTxCount} سند
                  </span>
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                    ثبت آفلاین دائمی (بدون انقضا)
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {selectedCurrency === 'all'
                    ? 'نمایش جامع تراکنش‌ها بدون فیلتر واحد پول'
                    : `فیلتر شده بر اساس واحد پول ${selectedCurrency}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800 p-1 rounded-lg text-xs border border-emerald-100/40 dark:border-emerald-900/30">
                  <button
                    onClick={() => setTxLimit(15)}
                    className={`px-2 py-1 rounded font-bold cursor-pointer ${
                      txLimit === 15 ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    ۱۵ مورد
                  </button>
                  <button
                    onClick={() => setTxLimit(30)}
                    className={`px-2 py-1 rounded font-bold cursor-pointer ${
                      txLimit === 30 ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    ۳۰ مورد
                  </button>
                  <button
                    onClick={() => setTxLimit(0)}
                    className={`px-2 py-1 rounded font-bold cursor-pointer ${
                      txLimit === 0 ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    همه
                  </button>
                </div>

                <button
                  onClick={() => handleNavigate('journal')}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer mr-2"
                >
                  دفتر روزنامچه ←
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[520px] overflow-y-auto dashboard-scroll">
              <table className="w-full text-xs text-right">
                <thead className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10">
                  <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <th className="py-2.5 px-2 font-medium">مشتری</th>
                    <th className="py-2.5 px-2 font-medium">نوع</th>
                    <th className="py-2.5 px-2 font-medium">مبلغ</th>
                    <th className="py-2.5 px-2 font-medium">تاریخ</th>
                    <th className="py-2.5 px-2 font-medium text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredRecentTransactions.map((tx) => {
                    const isDebit = tx.type === 'debit';
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors"
                      >
                        <td className="py-3 px-2">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {tx.customerName}
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1 max-w-[200px]">
                            {tx.description || 'بدون شرح'}
                          </div>
                        </td>

                        <td className="py-3 px-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isDebit
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                          >
                            {isDebit ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownLeft className="w-3 h-3" />
                            )}
                            {isDebit ? 'طلب' : 'گرفت'}
                          </span>
                        </td>

                        <td className="py-3 px-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {formatAmount(tx.amount)}
                          </span>{' '}
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                            {tx.currency}
                          </span>
                        </td>

                        <td className="py-3 px-2 text-slate-500 dark:text-slate-400 text-[11px]">
                          <div>{formatToPersianDate(tx.date)}</div>
                          {tx.time && <div className="text-[10px] text-slate-400 font-mono">{tx.time}</div>}
                        </td>

                        <td className="py-3 px-2 text-left">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                const cust = customers.find((c) => c.id === tx.customerId);
                                const msg = buildTransactionMessage(
                                  tx,
                                  cust?.balance || 0,
                                  settings.templates.transaction
                                );
                                openWhatsApp(tx.customerPhone || cust?.phone || '', msg);
                              }}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
                              title="ارسال رسید در واتساپ"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                            {onDeleteTransaction && (
                              <button
                                onClick={() => setDeleteTargetTx(tx)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                                title="حذف قطعی تراکنش"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredRecentTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        هیچ تراکنشی با فیلتر انتخابی یافت نشد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Left Column in RTL: Recent Hawalas (4 cols - صفحه سمت چپ) */}
          <div className="lg:col-span-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-emerald-300/40 dark:border-emerald-800/40 p-5 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    حواله‌های اخیر صرافی
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">وضعیت و پیگیری حوالجات صادر شده</p>
                </div>
                <button
                  onClick={() => handleNavigate('hawala')}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                >
                  مشاهده همه ←
                </button>
              </div>

              <div className="space-y-3 max-h-[520px] overflow-y-auto custom-scrollbar pr-1 scroll-smooth">
                {filteredRecentHawalas.map((h) => (
                  <div
                    key={h.id}
                    className="p-3.5 rounded-xl border border-emerald-100/60 dark:border-emerald-900/40 hover:border-emerald-400 dark:hover:border-emerald-600 bg-slate-50/50 dark:bg-slate-800/30 transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-300/60 dark:border-emerald-800">
                            {h.hawalaNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {h.senderName} ← {h.receiverName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          مقصد: <span className="font-medium text-slate-700 dark:text-slate-300">{h.destinationCity}</span> | کد: {h.hawalaCode}
                        </div>
                      </div>

                      <div className="text-left">
                        <div className="font-mono font-black text-sm text-slate-900 dark:text-white">
                          {formatAmount(h.amount)} {h.currency}
                        </div>
                        <div className="mt-1">
                          {h.status === 'completed' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              پرداخت شده
                            </span>
                          ) : h.status === 'cancelled' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                              لغو شده
                            </span>
                          ) : (
                            <button
                              onClick={() => onUpdateHawalaStatus(h.id, 'completed')}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 transition-colors cursor-pointer"
                              title="کلیک کنید تا وضعیت به پرداخت شده تغییر کند"
                            >
                              در انتظار (تغییر به پرداخت)
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-400">{formatToPersianDate(h.date)}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const msg = buildHawalaMessage(h, settings.templates.hawala);
                            openWhatsApp(h.senderPhone || h.receiverPhone, msg);
                          }}
                          className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>واتساپ</span>
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={() => onPrintHawala(h)}
                          className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>چاپ رسید</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredRecentHawalas.length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    هیچ حواله‌ای یافت نشد.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={onOpenNewHawala}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 dark:from-emerald-950/40 dark:to-teal-950/40 dark:hover:from-emerald-900/50 dark:hover:to-teal-900/50 text-emerald-900 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>ثبت حواله جدید با شماره اختصاصی</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Transaction Modal */}
      {deleteTargetTx && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTargetTx(null)}
          title="حذف قطعی تراکنش روزنامچه"
          maxWidth="md"
        >
          <div className="space-y-4 text-right">
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 text-xs font-bold leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <span>آیا از حذف دائم این تراکنش اطمینان دارید؟</span>
                <p className="text-[11px] font-normal text-rose-700/80 dark:text-rose-400 mt-1">
                  تراکنش «{deleteTargetTx.customerName}» به مبلغ {formatAmount(deleteTargetTx.amount)} {deleteTargetTx.currency} برای همیشه از حافظه سیستم پاک شده و هرگز بازنخواهد گشت. بیلانس مشتری فوراً به‌روزرسانی می‌شود.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTargetTx(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (onDeleteTransaction && deleteTargetTx) {
                    await onDeleteTransaction(deleteTargetTx.id, true);
                    setDeleteTargetTx(null);
                  }
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف قطعی (عدم بازگشت)</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
