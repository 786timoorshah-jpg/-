import React, { useState, useMemo } from 'react';
import {
  JournalTransaction,
  Customer,
  TransactionType,
  CurrencyCode,
  AppSettings,
} from '../types';
import {
  PlusCircle,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Trash2,
  Edit2,
  MessageCircle,
  Download,
  Share2,
  CheckCircle2,
  UserPlus,
  AlertTriangle,
} from 'lucide-react';
import {
  formatAmount,
  formatToPersianDate,
  getTodayDateString,
  getCurrentTimeString,
} from '../utils/formatters';
import { exportTransactionsToCSV } from '../utils/exportImport';
import { buildTransactionMessage, openWhatsApp } from '../utils/whatsapp';
import { Modal } from '../components/common/Modal';

interface JournalPageProps {
  transactions: JournalTransaction[];
  customers: Customer[];
  settings: AppSettings;
  searchQuery: string;
  onSaveTransaction: (tx: JournalTransaction) => Promise<void>;
  onDeleteTransaction: (id: string, permanent?: boolean) => Promise<void>;
  onClearAllTransactions?: () => Promise<void>;
  onSaveCustomer?: (customer: Customer) => Promise<void>;
  initialNewTxCustomerId?: string | null;
  openTxTrigger?: number;
  onClearInitialCustomerId?: () => void;
}

export const JournalPage: React.FC<JournalPageProps> = ({
  transactions,
  customers,
  settings,
  searchQuery: globalSearchQuery,
  onSaveTransaction,
  onDeleteTransaction,
  onClearAllTransactions,
  onSaveCustomer,
  initialNewTxCustomerId,
  openTxTrigger,
  onClearInitialCustomerId,
}) => {
  // Local state
  const [localSearch, setLocalSearch] = useState('');
  const [filterCustomer, setFilterCustomer] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | 'this_week' | 'this_month'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<JournalTransaction | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePermanently, setDeletePermanently] = useState(true);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Quick Customer Creation inside Transaction Modal
  const [isNewCustomerMode, setIsNewCustomerMode] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Form State
  const [formData, setFormData] = useState<{
    customerId: string;
    type: TransactionType;
    amount: string;
    currency: CurrencyCode;
    date: string;
    time: string;
    description: string;
  }>({
    customerId: '',
    type: 'debit',
    amount: '',
    currency: settings.defaultCurrency,
    date: getTodayDateString(),
    time: getCurrentTimeString(),
    description: '',
  });

  const [formError, setFormError] = useState('');

  // Open modal if triggered by parent (via button click or trigger counter)
  React.useEffect(() => {
    if ((openTxTrigger && openTxTrigger > 0) || initialNewTxCustomerId) {
      handleOpenCreate(initialNewTxCustomerId || undefined);
      if (onClearInitialCustomerId) onClearInitialCustomerId();
    }
  }, [openTxTrigger, initialNewTxCustomerId]);

  const handleOpenCreate = (preselectedCustId?: string) => {
    setEditingTransaction(null);
    const hasExistingCusts = customers.length > 0;
    setIsNewCustomerMode(!hasExistingCusts);
    setNewCustName('');
    setNewCustPhone('');
    setFormData({
      customerId: preselectedCustId || (customers[0]?.id || ''),
      type: 'debit',
      amount: '',
      currency: settings.defaultCurrency,
      date: getTodayDateString(),
      time: getCurrentTimeString(),
      description: '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tx: JournalTransaction) => {
    setEditingTransaction(tx);
    setIsNewCustomerMode(false);
    setFormData({
      customerId: tx.customerId,
      type: tx.type,
      amount: String(tx.amount),
      currency: tx.currency,
      date: tx.date,
      time: tx.time || getCurrentTimeString(),
      description: tx.description || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    let targetCustomerId = formData.customerId;
    let targetCustomerName = '';
    let targetCustomerPhone = '';

    // If creating a brand new customer directly inside this transaction modal
    if (!editingTransaction && isNewCustomerMode) {
      if (!newCustName.trim()) {
        setFormError('لطفاً نام و تخلص مشتری را وارد نمایید.');
        return;
      }
      targetCustomerId = 'CUST-' + Date.now().toString().slice(-6);
      targetCustomerName = newCustName.trim();
      targetCustomerPhone = newCustPhone.trim();

      if (onSaveCustomer) {
        await onSaveCustomer({
          id: targetCustomerId,
          name: targetCustomerName,
          phone: targetCustomerPhone,
          currency: formData.currency,
          balance: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDeleted: false,
        });
      }
    } else {
      if (!targetCustomerId) {
        setFormError('لطفاً یک مشتری را انتخاب نمایید.');
        return;
      }
      const selectedCustomer = customers.find((c) => c.id === targetCustomerId);
      targetCustomerName = selectedCustomer ? selectedCustomer.name : 'مشتری نامشخص';
      targetCustomerPhone = selectedCustomer?.phone || '';
    }

    const numAmount = parseFloat(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('مبلغ باید عددی بزرگتر از صفر باشد.');
      return;
    }
    if (!formData.date) {
      setFormError('تاریخ تراکنش الزامی است.');
      return;
    }

    const txId = editingTransaction ? editingTransaction.id : 'TX-' + Date.now().toString().slice(-6);

    const newTx: JournalTransaction = {
      id: txId,
      customerId: targetCustomerId,
      customerName: targetCustomerName,
      customerPhone: targetCustomerPhone,
      type: formData.type,
      amount: numAmount,
      currency: formData.currency,
      date: formData.date,
      time: formData.time || getCurrentTimeString(),
      description: formData.description.trim(),
      createdAt: editingTransaction ? editingTransaction.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveTransaction(newTx);
    setIsModalOpen(false);
  };

  // Filtered transactions calculation
  const filteredTransactions = useMemo(() => {
    let result = transactions;

    const query = (localSearch || globalSearchQuery).toLowerCase().trim();
    if (query) {
      result = result.filter(
        (t) =>
          t.customerName.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.id.toLowerCase().includes(query) ||
          String(t.amount).includes(query)
      );
    }

    if (filterCustomer !== 'all') {
      result = result.filter((t) => t.customerId === filterCustomer);
    }

    if (filterType !== 'all') {
      result = result.filter((t) => t.type === filterType);
    }

    const today = getTodayDateString();
    if (filterDateRange === 'today') {
      result = result.filter((t) => t.date === today);
    } else if (filterDateRange === 'this_week') {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      result = result.filter((t) => t.date >= sevenDaysAgo);
    } else if (filterDateRange === 'this_month') {
      const currentMonthPrefix = today.slice(0, 7); // YYYY-MM
      result = result.filter((t) => t.date.startsWith(currentMonthPrefix));
    }

    if (customStartDate) {
      result = result.filter((t) => t.date >= customStartDate);
    }
    if (customEndDate) {
      result = result.filter((t) => t.date <= customEndDate);
    }

    return result;
  }, [
    transactions,
    localSearch,
    globalSearchQuery,
    filterCustomer,
    filterType,
    filterDateRange,
    customStartDate,
    customEndDate,
  ]);

  // Totals for filtered transactions
  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const t of filteredTransactions) {
      if (t.type === 'debit') debit += t.amount;
      if (t.type === 'credit') credit += t.amount;
    }
    return { debit, credit, net: debit - credit };
  }, [filteredTransactions]);

  return (
    <div className="space-y-5">
      {/* Top Bar: Title & Primary Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">روزنامچه مالی (طلب و گرفت)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ثبت دائمی و ۱۰۰٪ آفلاین اقلام طلب و گرفت | بدون انقضای زمانی و ماندگار در سیستم تا زمان حذف دستی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          {onClearAllTransactions && transactions.length > 0 && (
            <button
              onClick={() => setIsClearAllModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-bold text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 rounded-xl transition-colors cursor-pointer border border-rose-200 dark:border-rose-900"
              title="خالی کردن تمامی تراکنش‌های ثبت‌شده روزنامچه"
            >
              <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>تخلیه تمام تراکنش‌ها</span>
            </button>
          )}

          <button
            onClick={() => exportTransactionsToCSV(filteredTransactions)}
            className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            title="خروجی اکسل / CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>خروجی اکسل</span>
          </button>

          <button
            onClick={() => handleOpenCreate()}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-5 h-5" />
            <span>ثبت تراکنش جدید</span>
          </button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="جستجو در شرح، مشتری، شماره..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Customer Filter */}
          <div>
            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-900 dark:text-white"
            >
              <option value="all">همه مشتریان ({customers.length})</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Transaction Type Filter */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-900 dark:text-white"
            >
              <option value="all">همه تراکنش‌ها (طلب و گرفت)</option>
              <option value="debit">فقط طلب</option>
              <option value="credit">فقط گرفت</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <select
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value as any)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-900 dark:text-white"
            >
              <option value="all">همه تاریخ‌ها</option>
              <option value="today">امروز</option>
              <option value="this_week">یک هفته اخیر</option>
              <option value="this_month">این ماه</option>
            </select>
          </div>
        </div>

        {/* Totals Summary strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-sm font-semibold">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-slate-500 dark:text-slate-400">مجموع طلب: </span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-black text-base">
                {formatAmount(totals.debit)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">مجموع گرفت: </span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black text-base">
                {formatAmount(totals.credit)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">تراز فیلتر: </span>
              <span
                className={`font-mono font-black text-base ${
                  totals.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatAmount(totals.net, { showSign: true })}
              </span>
            </div>
          </div>
          <div className="text-slate-500 dark:text-slate-400 font-medium">
            نمایش {filteredTransactions.length} تراکنش از مجموع {transactions.length}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <th className="py-3.5 px-4 font-bold">کد</th>
                <th className="py-3.5 px-4 font-bold">مشتری</th>
                <th className="py-3.5 px-4 font-bold">نوع</th>
                <th className="py-3.5 px-4 font-bold">مبلغ</th>
                <th className="py-3.5 px-4 font-bold">واحد</th>
                <th className="py-3.5 px-4 font-bold">تاریخ و زمان</th>
                <th className="py-3.5 px-4 font-bold">شرح و توضیح</th>
                <th className="py-3.5 px-4 font-bold text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTransactions.map((tx) => {
                const isDebit = tx.type === 'debit';
                const cust = customers.find((c) => c.id === tx.customerId);

                return (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-4 px-4 font-mono font-bold text-slate-500 text-sm">
                      {tx.id}
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-black text-slate-900 dark:text-slate-100 text-sm md:text-base">
                        {tx.customerName}
                      </div>
                      {cust?.phone && (
                        <div className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                          {cust.phone}
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-xs ${
                          isDebit
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        {isDebit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                        {isDebit ? 'طلب' : 'گرفت'}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <span className="font-mono font-black text-base text-slate-900 dark:text-slate-100">
                        {formatAmount(tx.amount)}
                      </span>
                    </td>

                    <td className="py-4 px-4 font-black text-slate-700 dark:text-slate-300 text-sm">
                      {tx.currency}
                    </td>

                    <td className="py-4 px-4 text-slate-700 dark:text-slate-300 text-sm">
                      <div className="font-bold">{formatToPersianDate(tx.date)}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{tx.time || ''}</div>
                    </td>

                    <td className="py-4 px-4 text-slate-700 dark:text-slate-300 max-w-xs text-sm">
                      <p className="line-clamp-2 leading-relaxed">{tx.description || '-'}</p>
                    </td>

                    <td className="py-4 px-4 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* WhatsApp Message */}
                        <button
                          onClick={() => {
                            const currentCust = customers.find((c) => c.id === tx.customerId);
                            const msg = buildTransactionMessage(
                              tx,
                              currentCust?.balance || 0,
                              settings.templates.transaction
                            );
                            openWhatsApp(tx.customerPhone || currentCust?.phone || '', msg);
                          }}
                          className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-xl transition-colors cursor-pointer"
                          title="ارسال پیام واتساپ"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => handleOpenEdit(tx)}
                          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                          title="ویرایش"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete (to trash) */}
                        <button
                          onClick={() => setDeleteTargetId(tx.id)}
                          className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
                          title="انتقال به سطل زباله"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    هیچ تراکنشی مطابق با فیلترهای انتخابی یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Transaction Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTransaction ? 'ویرایش تراکنش روزنامچه' : 'ثبت تراکنش در نرم‌افزار (آفلاین)'}
        subtitle="محاسبه بیلانس حساب مشتری بلافاصله در پایگاه داده داخلی نرم‌افزار انجام می‌شود"
        maxWidth="lg"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-sm font-bold">
              {formError}
            </div>
          )}

          {/* Customer Selection or Inline Quick Creation */}
          {!editingTransaction && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  مشتری طرف حساب *
                </label>

                {customers.length > 0 && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setIsNewCustomerMode(false)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        !isNewCustomerMode
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      انتخاب از لیست ({customers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNewCustomerMode(true)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                        isNewCustomerMode
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ مشتری جدید</span>
                    </button>
                  </div>
                )}
              </div>

              {isNewCustomerMode ? (
                <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>مشخصات مشتری جدید (مستقیماً در نرم‌افزار ثبت و متصل می‌شود)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        نام و تخلص مشتری *
                      </label>
                      <input
                        type="text"
                        placeholder="مثلاً: حاجی احمد صرافی / محمد نبی"
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-medium rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                        required={isNewCustomerMode}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        شماره تماس یا واتساپ (اختیاری)
                      </label>
                      <input
                        type="tel"
                        dir="ltr"
                        placeholder="0799000000"
                        value={newCustPhone}
                        onChange={(e) => setNewCustPhone(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-medium rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 text-left"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <select
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-semibold"
                    required={!isNewCustomerMode}
                  >
                    <option value="">-- لطفاً مشتری را انتخاب کنید --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} - بیلانس: {formatAmount(c.balance)} {c.currency}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* If Editing an existing transaction */}
          {editingTransaction && (
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                مشتری طرف حساب
              </label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-semibold"
                required
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) - بیلانس: {formatAmount(c.balance)} {c.currency}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Type Selector (طلب / گرفت) */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              نوع تراکنش *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'debit' })}
                className={`py-3 px-4 rounded-xl border text-sm font-black flex items-center justify-center gap-2.5 cursor-pointer transition-all ${
                  formData.type === 'debit'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/20'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <ArrowUpRight className="w-5 h-5" />
                <span className="text-base font-black">طلب</span>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'credit' })}
                className={`py-3 px-4 rounded-xl border text-sm font-black flex items-center justify-center gap-2.5 cursor-pointer transition-all ${
                  formData.type === 'credit'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-600/20'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <ArrowDownLeft className="w-5 h-5" />
                <span className="text-base font-black">گرفت</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
              {formData.type === 'debit'
                ? '• نوع انتخاب‌شده: طلب'
                : '• نوع انتخاب‌شده: گرفت'}
            </p>
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                مبلغ تراکنش *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="مثلاً 50000"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3.5 py-2.5 text-lg font-mono font-black rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                واحد پول *
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value as CurrencyCode })}
                className="w-full px-3 py-2.5 text-sm font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              >
                {settings.supportedCurrencies.map((cur) => (
                  <option key={cur.code} value={cur.code}>
                    {cur.code} ({cur.nameFa})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                تاریخ تراکنش *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                زمان
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              شرح و بابت تراکنش
            </label>
            <textarea
              rows={2}
              placeholder="مثلاً: حواله ارسالی به قندهار بابت خرید قالین / رسید نقدی شعبه مرکزی..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white leading-relaxed"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-400 font-medium">
              ذخیره‌سازی آفلاین و محلی در نرم‌افزار
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                {editingTransaction ? 'ذخیره تغییرات' : 'ثبت قطعی تراکنش در نرم‌افزار'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal
        isOpen={deleteTargetId !== null}
        onClose={() => {
          setDeleteTargetId(null);
          setDeletePermanently(true);
        }}
        title="حذف قطعی تراکنش روزنامچه"
        maxWidth="md"
      >
        <div className="space-y-4 text-right">
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 text-xs font-bold leading-relaxed flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <span>آیا از حذف کامل این تراکنش اطمینان دارید؟</span>
              <p className="text-[11px] font-normal text-rose-700/80 dark:text-rose-400 mt-1">
                این تراکنش به صورت قطعی و همیشگی از پایگاه داده و حافظه دستگاه پاک شده و پس از حذف هرگز بازنخواهد گشت. بیلانس مشتری بلافاصله اصلاح می‌شود.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setDeleteTargetId(null);
                setDeletePermanently(true);
              }}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={() => {
                if (deleteTargetId) {
                  onDeleteTransaction(deleteTargetId, true);
                  setDeleteTargetId(null);
                  setDeletePermanently(true);
                }
              }}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف قطعی (عدم بازگشت دوباره)</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirm Clear All Transactions */}
      <Modal
        isOpen={isClearAllModalOpen}
        onClose={() => !isClearingAll && setIsClearAllModalOpen(false)}
        title="تخلیه کامل تمام تراکنش‌های ثبت‌شده"
      >
        <div className="space-y-4 text-right">
          <div className="p-4 bg-rose-50 dark:bg-rose-950/50 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-sm leading-relaxed">
            <p className="font-bold text-base mb-1.5 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>هشدار پاکسازی روزنامچه:</span>
            </p>
            آیا مطمئن هستید که می‌خواهید <strong>تمام تراکنش‌های ثبت شده ({transactions.length} مورد)</strong> را به طور کامل خالی کنید؟
            <br />
            با انجام این کار:
            <ul className="list-disc list-inside mt-2 space-y-1 font-medium text-xs">
              <li>تمامی اقلام روزنامچه مالی (طلب و گرفت) پاک می‌شوند.</li>
              <li>بیلانس حساب تمامی مشتریان به صفر (تسویه) تغییر خواهد یافت.</li>
              <li>مشخصات مشتریان و سوابق حواله‌ها بدون تغییر باقی می‌مانند.</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={isClearingAll}
              onClick={() => setIsClearAllModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={isClearingAll}
              onClick={async () => {
                if (onClearAllTransactions) {
                  setIsClearingAll(true);
                  try {
                    await onClearAllTransactions();
                    setIsClearAllModalOpen(false);
                  } finally {
                    setIsClearingAll(false);
                  }
                }
              }}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isClearingAll ? 'در حال تخلیه...' : 'بله، تمام تراکنش‌ها خالی شود'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
