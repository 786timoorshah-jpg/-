import React, { useState, useMemo } from 'react';
import {
  Customer,
  JournalTransaction,
  Hawala,
  AppSettings,
  TransactionType,
} from '../types';
import {
  BarChart3,
  Calendar,
  Printer,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  SendHorizontal,
  FileSpreadsheet,
  Coins,
} from 'lucide-react';
import {
  formatAmount,
  formatCurrency,
  formatToPersianDate,
  getTodayDateString,
  safeAdd,
  safeSubtract,
} from '../utils/formatters';
import { downloadFile } from '../utils/exportImport';

interface ReportsPageProps {
  customers: Customer[];
  transactions: JournalTransaction[];
  hawalas: Hawala[];
  settings: AppSettings;
}

type ReportPreset = 'today' | 'this_week' | 'this_month' | 'custom' | 'customer_balances';

export const ReportsPage: React.FC<ReportsPageProps> = ({
  customers,
  transactions,
  hawalas,
  settings,
}) => {
  const [preset, setPreset] = useState<ReportPreset>('this_month');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(getTodayDateString());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [reportView, setReportView] = useState<'all' | 'transactions' | 'hawalas'>('all');

  // Compute active date boundaries based on preset
  const dateRange = useMemo(() => {
    const today = getTodayDateString();
    if (preset === 'today') {
      return { start: today, end: today };
    }
    if (preset === 'this_week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      const start = d.toISOString().split('T')[0];
      return { start, end: today };
    }
    if (preset === 'this_month') {
      const d = new Date();
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      return { start, end: today };
    }
    return { start: startDate, end: endDate };
  }, [preset, startDate, endDate]);

  // Filtered transactions for the report
  const reportTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchDate = t.date >= dateRange.start && t.date <= dateRange.end;
      const matchCust = selectedCustomerId === 'all' || t.customerId === selectedCustomerId;
      return matchDate && matchCust;
    });
  }, [transactions, dateRange, selectedCustomerId]);

  // Filtered hawalas for the report
  const reportHawalas = useMemo(() => {
    return hawalas.filter((h) => {
      const matchDate = h.date >= dateRange.start && h.date <= dateRange.end;
      return matchDate;
    });
  }, [hawalas, dateRange]);

  // Financial aggregates
  const metrics = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let debitCount = 0;
    let creditCount = 0;

    for (const t of reportTransactions) {
      if (t.type === 'debit') {
        totalDebit = safeAdd(totalDebit, t.amount);
        debitCount++;
      } else {
        totalCredit = safeAdd(totalCredit, t.amount);
        creditCount++;
      }
    }

    let hawalaTotal = 0;
    let commissionTotal = 0;
    const byCurrency: Record<string, {
      currency: string;
      debit: number;
      credit: number;
      debitCount: number;
      creditCount: number;
      hawalaTotal: number;
      commissionTotal: number;
      hawalaCount: number;
    }> = {};

    for (const t of reportTransactions) {
      if (!byCurrency[t.currency]) {
        byCurrency[t.currency] = {
          currency: t.currency,
          debit: 0,
          credit: 0,
          debitCount: 0,
          creditCount: 0,
          hawalaTotal: 0,
          commissionTotal: 0,
          hawalaCount: 0,
        };
      }
      if (t.type === 'debit') {
        totalDebit = safeAdd(totalDebit, t.amount);
        debitCount++;
        byCurrency[t.currency].debit = safeAdd(byCurrency[t.currency].debit, t.amount);
        byCurrency[t.currency].debitCount++;
      } else {
        totalCredit = safeAdd(totalCredit, t.amount);
        creditCount++;
        byCurrency[t.currency].credit = safeAdd(byCurrency[t.currency].credit, t.amount);
        byCurrency[t.currency].creditCount++;
      }
    }

    for (const h of reportHawalas) {
      hawalaTotal = safeAdd(hawalaTotal, h.amount);
      commissionTotal = safeAdd(commissionTotal, h.commission);

      if (!byCurrency[h.currency]) {
        byCurrency[h.currency] = {
          currency: h.currency,
          debit: 0,
          credit: 0,
          debitCount: 0,
          creditCount: 0,
          hawalaTotal: 0,
          commissionTotal: 0,
          hawalaCount: 0,
        };
      }
      byCurrency[h.currency].hawalaTotal = safeAdd(byCurrency[h.currency].hawalaTotal, h.amount);
      byCurrency[h.currency].commissionTotal = safeAdd(byCurrency[h.currency].commissionTotal, h.commission);
      byCurrency[h.currency].hawalaCount++;
    }

    return {
      totalDebit,
      totalCredit,
      debitCount,
      creditCount,
      netFlow: safeSubtract(totalDebit, totalCredit),
      hawalaTotal,
      commissionTotal,
      hawalaCount: reportHawalas.length,
      byCurrency,
    };
  }, [reportTransactions, reportHawalas]);

  // Handle Export CSV
  const handleExportCSV = () => {
    const headers = ['نوع سرفصل', 'کد/شماره', 'نام طرف حساب', 'نوع/مقصد', 'مبلغ', 'واحد پول', 'تاریخ', 'توضیحات'];
    const rows: string[][] = [];

    for (const t of reportTransactions) {
      rows.push([
        'تراکنش روزنامچه',
        `"${t.id}"`,
        `"${t.customerName.replace(/"/g, '""')}"`,
        `"${t.type === 'debit' ? 'طلب' : 'گرفت'}"`,
        `"${formatAmount(t.amount)}"`,
        `"${t.currency}"`,
        `"${formatToPersianDate(t.date)}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
      ]);
    }

    for (const h of reportHawalas) {
      rows.push([
        'حواله ارزی',
        `"${h.hawalaNumber}"`,
        `"${(h.senderName + ' -> ' + h.receiverName).replace(/"/g, '""')}"`,
        `"مقصد: ${h.destinationCity}"`,
        `"${formatAmount(h.amount)}"`,
        `"${h.currency}"`,
        `"${formatToPersianDate(h.date)}"`,
        `"کمیشن: ${h.commission}"`,
      ]);
    }

    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    downloadFile(csv, `STS_Financial_Report_${dateRange.start}_to_${dateRange.end}.csv`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs no-print">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">گزارش‌های جامع مالی و صرافی</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            تحلیل گردش طلب و گرفت، خلاصه کمیشن‌ها و صورت وضعیت دوره‌ای
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>خروجی اکسل / CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ گزارش (Print)</span>
          </button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 no-print">
        {/* Presets */}
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-2">دوره گزارش:</span>
          {[
            { id: 'today', label: 'امروز' },
            { id: 'this_week', label: 'هفت روز اخیر' },
            { id: 'this_month', label: 'این ماه' },
            { id: 'custom', label: 'بازه زمانی دلخواه' },
            { id: 'customer_balances', label: 'بیلانس کل مشتریان' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPreset(item.id as ReportPreset)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                preset === item.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Custom filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
          {preset === 'custom' && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">از تاریخ:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">تا تاریخ:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">فیلتر مشتری:</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
            >
              <option value="all">همه مشتریان</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">نوع نمایش:</label>
            <select
              value={reportView}
              onChange={(e) => setReportView(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
            >
              <option value="all">گزارش جامع (روزنامچه + حواله)</option>
              <option value="transactions">فقط تراکنش‌های روزنامچه</option>
              <option value="hawalas">فقط حواله‌ها</option>
            </select>
          </div>
        </div>
      </div>

      {/* Printable Report Document */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs print-break-inside-avoid">
        {/* Printable Header */}
        <div className="text-center pb-6 mb-6 border-b-2 border-slate-800">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">STS سادات</h1>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
            گزارش رسمی مالی و عملکرد صرافی
          </p>
          <div className="mt-2 text-xs font-medium text-slate-500 flex items-center justify-center gap-4">
            <span>دوره گزارش: از <strong>{formatToPersianDate(dateRange.start)}</strong> تا <strong>{formatToPersianDate(dateRange.end)}</strong></span>
            <span>|</span>
            <span>تاریخ استخراج: {formatToPersianDate(getTodayDateString())}</span>
          </div>
        </div>

        {/* If customer balance report is chosen */}
        {preset === 'customer_balances' ? (
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
              جدول تراز و بیلانس حساب کلیه مشتریان
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border border-slate-200 dark:border-slate-700">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b">
                    <th className="p-2.5">ردیف</th>
                    <th className="p-2.5">کد حساب</th>
                    <th className="p-2.5">نام مشتری</th>
                    <th className="p-2.5">شماره تماس</th>
                    <th className="p-2.5">واحد</th>
                    <th className="p-2.5 text-center">طلب</th>
                    <th className="p-2.5 text-center">گرفت</th>
                    <th className="p-2.5 text-center">وضعیت حساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {customers.map((c, i) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-2.5 text-slate-400 font-mono text-center">{i + 1}</td>
                      <td className="p-2.5 font-mono font-bold text-slate-600">{c.id}</td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{c.name}</td>
                      <td className="p-2.5 font-mono text-slate-600" dir="ltr">{c.phone}</td>
                      <td className="p-2.5 font-bold text-slate-600">{c.currency}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-amber-700">
                        {c.balance > 0 ? formatAmount(c.balance) : '-'}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-emerald-700">
                        {c.balance < 0 ? formatAmount(Math.abs(c.balance)) : '-'}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          c.balance > 0 ? 'bg-amber-100 text-amber-800' : c.balance < 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {c.balance > 0 ? 'طلب' : c.balance < 0 ? 'گرفت' : 'تسویه'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            {/* Financial Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-400 block mb-1">
                  مجموع طلبات ثبت شده:
                </span>
                <div className="font-mono font-black text-xl text-amber-900 dark:text-amber-300">
                  {formatAmount(metrics.totalDebit)} {settings.defaultCurrency}
                </div>
                <span className="text-[10px] text-amber-700/70 dark:text-amber-400/70 mt-1 block">
                  {metrics.debitCount} سند طلب
                </span>
              </div>

              <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 block mb-1">
                  مجموع گرفت (دریافتی‌ها):
                </span>
                <div className="font-mono font-black text-xl text-emerald-900 dark:text-emerald-300">
                  {formatAmount(metrics.totalCredit)} {settings.defaultCurrency}
                </div>
                <span className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 mt-1 block">
                  {metrics.creditCount} سند گرفت
                </span>
              </div>

              <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-900/50">
                <span className="text-xs font-bold text-sky-800 dark:text-sky-400 block mb-1">
                  مجموع حجم حواله‌ها:
                </span>
                <div className="font-mono font-black text-xl text-sky-900 dark:text-sky-300">
                  {formatAmount(metrics.hawalaTotal)} {settings.defaultCurrency}
                </div>
                <span className="text-[10px] text-sky-700/70 dark:text-sky-400/70 mt-1 block">
                  {metrics.hawalaCount} حواله صادر شده
                </span>
              </div>

              <div className="p-4 bg-violet-50/60 dark:bg-violet-950/30 rounded-xl border border-violet-200 dark:border-violet-900/50">
                <span className="text-xs font-bold text-violet-800 dark:text-violet-400 block mb-1">
                  درآمد کمیشن صرافی:
                </span>
                <div className="font-mono font-black text-xl text-violet-900 dark:text-violet-300">
                  {formatAmount(metrics.commissionTotal)} {settings.defaultCurrency}
                </div>
                <span className="text-[10px] text-violet-700/70 dark:text-violet-400/70 mt-1 block">
                  کارمزد خالص وصولی
                </span>
              </div>
            </div>

            {/* Multi-Currency Detailed Breakdown */}
            {Object.keys(metrics.byCurrency).length > 0 && (
              <div className="mb-6 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>تفکیک دقیق گردش دوره بر اساس واحدهای پولی (ارزها)</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {Object.keys(metrics.byCurrency).length} واحد ارزی فعال
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.keys(metrics.byCurrency).map((currKey) => {
                    const item = metrics.byCurrency[currKey];
                    return (
                      <div key={item.currency} className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2 shadow-xs">
                        <div className="flex justify-between items-center font-bold border-b border-slate-100 dark:border-slate-800 pb-1.5">
                          <span className="text-emerald-700 dark:text-emerald-400 font-mono font-black text-sm">{item.currency}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                            {item.debitCount + item.creditCount + item.hawalaCount} سند
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>طلب:</span>
                          <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{formatAmount(item.debit)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>گرفت:</span>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatAmount(item.credit)}</span>
                        </div>
                        {item.hawalaTotal > 0 && (
                          <div className="flex justify-between text-slate-600 dark:text-slate-400">
                            <span>حجم حواله:</span>
                            <span className="font-mono font-bold text-sky-700 dark:text-sky-400">{formatAmount(item.hawalaTotal)}</span>
                          </div>
                        )}
                        {item.commissionTotal > 0 && (
                          <div className="flex justify-between text-slate-600 dark:text-slate-400">
                            <span>کمیشن:</span>
                            <span className="font-mono font-bold text-violet-700 dark:text-violet-400">{formatAmount(item.commissionTotal)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Transactions Section */}
            {(reportView === 'all' || reportView === 'transactions') && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                  ریز تراکنش‌های روزنامچه در این دوره ({reportTransactions.length} مورد)
                </h3>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b">
                        <th className="p-2.5">کد سند</th>
                        <th className="p-2.5">مشتری</th>
                        <th className="p-2.5">نوع</th>
                        <th className="p-2.5">مبلغ</th>
                        <th className="p-2.5">واحد</th>
                        <th className="p-2.5">تاریخ</th>
                        <th className="p-2.5">شرح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reportTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-500">{tx.id}</td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">{tx.customerName}</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              tx.type === 'debit' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {tx.type === 'debit' ? 'طلب' : 'گرفت'}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono font-bold">{formatAmount(tx.amount)}</td>
                          <td className="p-2.5">{tx.currency}</td>
                          <td className="p-2.5">{formatToPersianDate(tx.date)}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">{tx.description || '-'}</td>
                        </tr>
                      ))}
                      {reportTransactions.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-slate-400">
                            در این بازه تاریخی هیچ تراکنشی ثبت نشده است.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Hawalas Section */}
            {(reportView === 'all' || reportView === 'hawalas') && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                  ریز حواله‌های صادره در این دوره ({reportHawalas.length} مورد)
                </h3>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b">
                        <th className="p-2.5">شماره حواله</th>
                        <th className="p-2.5">فرستنده</th>
                        <th className="p-2.5">گیرنده</th>
                        <th className="p-2.5">مقصد</th>
                        <th className="p-2.5">مبلغ</th>
                        <th className="p-2.5">کمیشن</th>
                        <th className="p-2.5">وضعیت</th>
                        <th className="p-2.5">تاریخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reportHawalas.map((h) => (
                        <tr key={h.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold text-emerald-700">{h.hawalaNumber}</td>
                          <td className="p-2.5 font-medium">{h.senderName}</td>
                          <td className="p-2.5 font-medium">{h.receiverName}</td>
                          <td className="p-2.5">{h.destinationCity}</td>
                          <td className="p-2.5 font-mono font-bold">{formatAmount(h.amount)} {h.currency}</td>
                          <td className="p-2.5 font-mono text-emerald-600 font-bold">{formatAmount(h.commission)}</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              h.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : h.status === 'cancelled' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {h.status === 'completed' ? 'پرداخت شده' : h.status === 'cancelled' ? 'لغو شده' : 'در انتظار'}
                            </span>
                          </td>
                          <td className="p-2.5">{formatToPersianDate(h.date)}</td>
                        </tr>
                      ))}
                      {reportHawalas.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-slate-400">
                            در این بازه تاریخی هیچ حواله‌ای ثبت نشده است.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer sign */}
        <div className="flex justify-between items-center pt-8 border-t border-slate-200 dark:border-slate-800 mt-6 text-xs text-slate-500">
          <div>مدیریت مالی STS سادات: ............................</div>
          <div>مهر و امضای رسمی صرافی: ............................</div>
        </div>
      </div>
    </div>
  );
};
