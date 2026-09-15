import React, { useState, useMemo } from 'react';
import {
  Customer,
  JournalTransaction,
  CurrencyCode,
  AppSettings,
} from '../types';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  FileText,
  MessageCircle,
  Edit2,
  Trash2,
  Download,
  Printer,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  AlertTriangle,
  Scale,
  LayoutList,
  LayoutGrid,
  PlusCircle,
  ArrowUpDown,
} from 'lucide-react';
import {
  formatAmount,
  formatToPersianDate,
  getTodayDateString,
} from '../utils/formatters';
import { exportCustomersToCSV } from '../utils/exportImport';
import { buildCustomerBalanceMessage, openWhatsApp } from '../utils/whatsapp';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

interface CustomersPageProps {
  customers: Customer[];
  transactions: JournalTransaction[];
  settings: AppSettings;
  searchQuery: string;
  onSaveCustomer: (customer: Customer) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onPrintCustomerStatement: (customer: Customer, customerTxs: JournalTransaction[]) => void;
  onOpenNewTransactionForCustomer: (customerId: string) => void;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({
  customers,
  transactions,
  settings,
  searchQuery: globalSearchQuery,
  onSaveCustomer,
  onDeleteCustomer,
  onPrintCustomerStatement,
  onOpenNewTransactionForCustomer,
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'debtors' | 'creditors' | 'settled'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'balanceDesc' | 'balanceAsc' | 'newest'>('name');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);

  // Form
  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    currency: CurrencyCode;
    notes: string;
  }>({
    name: '',
    phone: '',
    currency: settings.defaultCurrency,
    notes: '',
  });

  const [formError, setFormError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '',
      currency: settings.defaultCurrency,
      notes: '',
    });
    setFormError('');
    setDuplicateWarning('');
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      phone: c.phone,
      currency: c.currency,
      notes: c.notes || '',
    });
    setFormError('');
    setDuplicateWarning('');
    setIsFormModalOpen(true);
  };

  // Check for duplicate phone number
  const handlePhoneChange = (phone: string) => {
    setFormData((prev) => ({ ...prev, phone }));
    if (phone.trim().length >= 9) {
      const existing = customers.find(
        (c) => c.phone.trim() === phone.trim() && c.id !== editingCustomer?.id
      );
      if (existing) {
        setDuplicateWarning(`توجه: مشتری دیگری با نام «${existing.name}» قبلاً با این شماره ثبت شده است.`);
      } else {
        setDuplicateWarning('');
      }
    } else {
      setDuplicateWarning('');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('نام و نام خانوادگی مشتری الزامی است.');
      return;
    }

    const customerId = editingCustomer ? editingCustomer.id : 'CUST-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);

    const customerToSave: Customer = {
      id: customerId,
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      currency: formData.currency,
      balance: editingCustomer ? editingCustomer.balance : 0,
      notes: formData.notes.trim(),
      createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveCustomer(customerToSave);
    setIsFormModalOpen(false);
  };

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    const query = (localSearch || globalSearchQuery).toLowerCase().trim();
    if (query) {
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          c.id.toLowerCase().includes(query) ||
          c.notes?.toLowerCase().includes(query)
      );
    }

    if (currencyFilter !== 'all') {
      result = result.filter((c) => c.currency === currencyFilter);
    }

    if (balanceFilter === 'debtors') {
      result = result.filter((c) => c.balance > 0);
    } else if (balanceFilter === 'creditors') {
      result = result.filter((c) => c.balance < 0);
    } else if (balanceFilter === 'settled') {
      result = result.filter((c) => c.balance === 0);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'fa');
      }
      if (sortBy === 'balanceDesc') {
        return b.balance - a.balance;
      }
      if (sortBy === 'balanceAsc') {
        return a.balance - b.balance;
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });

    return result;
  }, [customers, localSearch, globalSearchQuery, balanceFilter, currencyFilter, sortBy]);

  // Totals for filtered customers
  const totals = useMemo(() => {
    let totalDebit = 0; // طلب (customers owe us)
    let totalCredit = 0; // گرفت (we owe customers)

    for (const c of filteredCustomers) {
      if (c.balance > 0) totalDebit += c.balance;
      if (c.balance < 0) totalCredit += Math.abs(c.balance);
    }

    return { totalDebit, totalCredit, count: filteredCustomers.length };
  }, [filteredCustomers]);

  // Selected customer statement transactions
  const selectedCustomerTransactions = useMemo(() => {
    if (!statementCustomer) return [];
    return transactions
      .filter((t) => t.customerId === statementCustomer.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions, statementCustomer]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>حساب‌های مشتریان و صرافی‌ها</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            لیست اسامی اشخاص، تفکیک طلب و گرفت، ارسال صورتحساب از طریق واتساپ و صدور سند
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={() => exportCustomersToCSV(filteredCustomers)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            title="خروجی فایل اکسل"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>خروجی اکسل</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-5 h-5" />
            <span>افتتاح حساب مشتری جدید</span>
          </button>
        </div>
      </div>

      {/* Filter and View Switcher Strip */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="جستجوی نام مشتری، شماره تلفن، کد حساب، دکان..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Balance Filter */}
          <div>
            <select
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value as any)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-900 dark:text-white"
            >
              <option value="all">همه وضعیت‌های حساب</option>
              <option value="debtors">مشتریان دارای طلب</option>
              <option value="creditors">مشتریان دارای گرفت</option>
              <option value="settled">حساب‌های تسویه شده (صفر)</option>
            </select>
          </div>

          {/* Currency Filter */}
          <div>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-900 dark:text-white"
            >
              <option value="all">همه واحدهای پولی</option>
              {settings.supportedCurrencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.nameFa})
                </option>
              ))}
            </select>
          </div>

          {/* Sort Filter */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-900 dark:text-white"
            >
              <option value="name">مرتب‌سازی: بر اساس نام (الفبا)</option>
              <option value="balanceDesc">بیشترین طلب</option>
              <option value="balanceAsc">بیشترین گرفت</option>
              <option value="newest">جدیدترین حساب‌ها</option>
            </select>
          </div>
        </div>

        {/* Totals Summary and View Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-sm font-semibold">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-slate-500 dark:text-slate-400">مجموع طلب: </span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-black text-base">
                {formatAmount(totals.totalDebit)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">مجموع گرفت: </span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black text-base">
                {formatAmount(totals.totalCredit)}
              </span>
            </div>
            <div className="text-slate-500 dark:text-slate-400 font-medium">
              تعداد: <strong className="text-slate-900 dark:text-white font-bold">{filteredCustomers.length}</strong> مشتری
            </div>
          </div>

          {/* View Switcher: List vs Grid */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
              title="نمای لیست اسامی (جدول)"
            >
              <LayoutList className="w-4 h-4" />
              <span>لیست اسامی (جدول)</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
              title="نمای کارتی"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>کارت‌ها</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: CUSTOMERS TABLE / LIST OF NAMES (Default) */}
      {viewMode === 'list' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
                  <th className="py-3.5 px-4 text-center w-12">#</th>
                  <th className="py-3.5 px-4">نام و شهرت مشتری</th>
                  <th className="py-3.5 px-4">شماره تماس / واتساپ</th>
                  <th className="py-3.5 px-4 text-center">واحد پول</th>
                  <th className="py-3.5 px-4 text-center">وضعیت حساب</th>
                  <th className="py-3.5 px-4 text-left font-mono">بیلانس فعلی</th>
                  <th className="py-3.5 px-4 text-left">عملیات سریع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCustomers.map((c, index) => {
                  const isDebtor = c.balance > 0;
                  const isCreditor = c.balance < 0;
                  const isSettled = c.balance === 0;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Row number */}
                      <td className="py-4 px-4 text-center font-mono text-xs font-bold text-slate-400">
                        {index + 1}
                      </td>

                      {/* Customer Name & Info */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-base shrink-0 border border-emerald-200/60 dark:border-emerald-800/60">
                            {c.name.trim().charAt(0) || 'م'}
                          </div>
                          <div>
                            <button
                              onClick={() => setStatementCustomer(c)}
                              className="font-black text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 text-base text-right transition-colors cursor-pointer block"
                            >
                              {c.name}
                            </button>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                              <span className="font-mono font-medium">{c.id}</span>
                              {c.notes && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-xs text-slate-500 dark:text-slate-400 font-normal">
                                    {c.notes}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone / WhatsApp */}
                      <td className="py-4 px-4">
                        {c.phone ? (
                          <div className="flex items-center gap-2">
                            <span dir="ltr" className="font-mono font-bold text-slate-700 dark:text-slate-300 text-sm">
                              {c.phone}
                            </span>
                            <button
                              onClick={() => {
                                const msg = buildCustomerBalanceMessage(
                                  c,
                                  settings.managerPhone,
                                  settings.templates.customerBalance
                                );
                                openWhatsApp(c.phone, msg);
                              }}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
                              title="ارسال پیام واتساپ"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">بدون شماره</span>
                        )}
                      </td>

                      {/* Currency */}
                      <td className="py-4 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-xs text-slate-700 dark:text-slate-300 font-mono">
                          {c.currency}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-xs ${
                            isDebtor
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                              : isCreditor
                              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {isDebtor ? (
                            <>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span>طلب</span>
                            </>
                          ) : isCreditor ? (
                            <>
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              <span>گرفت</span>
                            </>
                          ) : (
                            <span>تسویه شده</span>
                          )}
                        </span>
                      </td>

                      {/* Balance */}
                      <td className="py-4 px-4 text-left">
                        <div
                          className={`font-mono font-black text-base md:text-lg ${
                            isDebtor
                              ? 'text-amber-600 dark:text-amber-400'
                              : isCreditor
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {formatAmount(Math.abs(c.balance))}
                          <span className="text-xs font-bold mr-1 text-slate-500 dark:text-slate-400">
                            {c.currency}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Transaction */}
                          <button
                            onClick={() => onOpenNewTransactionForCustomer(c.id)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                            title="ثبت تراکنش روزنامچه برای این مشتری"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>ثبت سند</span>
                          </button>

                          {/* Statement */}
                          <button
                            onClick={() => setStatementCustomer(c)}
                            className="p-2 text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-xl transition-colors cursor-pointer"
                            title="ریز گردش و صورتحساب"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                            title="ویرایش حساب"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTargetId(c.id)}
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

                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-slate-400 text-sm">
                      هیچ مشتری‌ای مطابق با فیلترهای انتخابی یافت نشد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: CUSTOMERS CARDS GRID */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCustomers.map((c) => {
            const isDebtor = c.balance > 0;
            const isCreditor = c.balance < 0;
            const isSettled = c.balance === 0;

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="font-mono text-xs text-slate-400 font-bold block mb-0.5">
                        {c.id}
                      </span>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        {c.name}
                      </h3>
                    </div>

                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-full ${
                        isDebtor
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : isCreditor
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {isDebtor ? 'طلب' : isCreditor ? 'گرفت' : 'تسویه'}
                    </span>
                  </div>

                  {/* Phone & Info */}
                  <div className="my-3 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span dir="ltr" className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {c.phone || 'بدون تلفن'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
                      <span>واحد پول: <strong className="text-slate-800 dark:text-slate-200 font-bold">{c.currency}</strong></span>
                      <span>تاریخ افتتاح: {formatToPersianDate(c.createdAt)}</span>
                    </div>
                  </div>

                  {/* Current Balance Box */}
                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between ${
                      isDebtor
                        ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50'
                        : isCreditor
                        ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50'
                        : 'bg-slate-50 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700'
                    }`}
                  >
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        بیلانس فعلی حساب:
                      </span>
                      <div
                        className={`font-mono font-black text-xl ${
                          isDebtor
                            ? 'text-amber-700 dark:text-amber-400'
                            : isCreditor
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {formatAmount(Math.abs(c.balance))} {c.currency}
                      </div>
                    </div>

                    <div className="text-left">
                      <button
                        onClick={() => onOpenNewTransactionForCustomer(c.id)}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>ثبت سند</span>
                      </button>
                    </div>
                  </div>

                  {c.notes && (
                    <div className="mt-2.5 text-xs text-slate-500 italic line-clamp-1">
                      یادداشت: {c.notes}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  {/* Statement button */}
                  <button
                    onClick={() => setStatementCustomer(c)}
                    className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 hover:underline font-black cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>ریز گردش (صورتحساب)</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* WhatsApp */}
                    <button
                      onClick={() => {
                        const msg = buildCustomerBalanceMessage(
                          c,
                          settings.managerPhone,
                          settings.templates.customerBalance
                        );
                        openWhatsApp(c.phone, msg);
                      }}
                      className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-xl transition-colors cursor-pointer"
                      title="ارسال بیلانس از طریق واتساپ"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                      title="ویرایش حساب مشتری"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setDeleteTargetId(c.id)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
                      title="انتقال به سطل زباله"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredCustomers.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm">
              هیچ مشتری‌ای یافت نشد. برای افتتاح حساب جدید از دکمه «افتتاح حساب مشتری جدید» استفاده کنید.
            </div>
          )}
        </div>
      )}

      {/* Customer Form Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingCustomer ? 'ویرایش اطلاعات حساب مشتری' : 'افتتاح حساب جدید مشتری'}
        subtitle="حساب برای ثبت تراکنش‌های روزنامچه و حواله آماده می‌گردد"
        maxWidth="md"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-medium">
              {formError}
            </div>
          )}

          {duplicateWarning && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{duplicateWarning}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              نام و تخلص مشتری / نام شرکت *
            </label>
            <input
              type="text"
              placeholder="مثلاً حاجی احمدشاه پوپلزی"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              شماره تماس (جهت واتساپ و تماس)
            </label>
            <input
              type="text"
              placeholder="0799123456"
              value={formData.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 font-mono"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              واحد پول پایه حساب *
            </label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value as CurrencyCode })}
              className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500"
            >
              {settings.supportedCurrencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.nameFa})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              یادداشت و آدرس
            </label>
            <textarea
              rows={2}
              placeholder="آدرس دکان، شهر، شرایط تسویه یا معرف..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-colors cursor-pointer"
            >
              {editingCustomer ? 'ذخیره تغییرات حساب' : 'افتتاح حساب'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Customer Account Statement Drawer / Modal */}
      {statementCustomer && (
        <Modal
          isOpen={true}
          onClose={() => setStatementCustomer(null)}
          title={`صورتحساب گردش: ${statementCustomer.name}`}
          subtitle={`تلفن: ${statementCustomer.phone || '-'} | واحد: ${statementCustomer.currency}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {/* Balance Summary Header */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">بیلانس نهایی:</span>
                <span
                  className={`font-mono text-base font-black ${
                    statementCustomer.balance > 0
                      ? 'text-amber-600'
                      : statementCustomer.balance < 0
                      ? 'text-emerald-600'
                      : 'text-slate-600'
                  }`}
                >
                  {formatAmount(Math.abs(statementCustomer.balance))} {statementCustomer.currency}
                </span>
                <span className="text-[10px] block mt-0.5 text-slate-500">
                  {statementCustomer.balance > 0 ? 'طلب' : statementCustomer.balance < 0 ? 'گرفت' : 'تسویه'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">تعداد تراکنش‌ها:</span>
                <span className="font-mono text-base font-bold text-slate-800 dark:text-slate-200">
                  {selectedCustomerTransactions.length} سند
                </span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    onPrintCustomerStatement(statementCustomer, selectedCustomerTransactions);
                  }}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ صورتحساب</span>
                </button>
              </div>
            </div>

            {/* Transactions List */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="p-2.5">تاریخ</th>
                    <th className="p-2.5">شرح</th>
                    <th className="p-2.5 text-center">طلب</th>
                    <th className="p-2.5 text-center">گرفت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedCustomerTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 text-slate-500 whitespace-nowrap">
                        {formatToPersianDate(tx.date)}
                      </td>
                      <td className="p-2.5 text-slate-800 dark:text-slate-200">
                        {tx.description || '-'}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-amber-700 dark:text-amber-400">
                        {tx.type === 'debit' ? formatAmount(tx.amount) : '-'}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {tx.type === 'credit' ? formatAmount(tx.amount) : '-'}
                      </td>
                    </tr>
                  ))}
                  {selectedCustomerTransactions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400">
                        هیچ تراکنشی برای این مشتری ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Close footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <button
                onClick={() => {
                  const msg = buildCustomerBalanceMessage(
                    statementCustomer,
                    settings.managerPhone,
                    settings.templates.customerBalance
                  );
                  openWhatsApp(statementCustomer.phone, msg);
                }}
                className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>ارسال خلاصه صورتحساب به واتساپ مشتری</span>
              </button>

              <button
                onClick={() => setStatementCustomer(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl"
              >
                بستن
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) {
            onDeleteCustomer(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
        title="انتقال حساب مشتری به سطل زباله"
        message="آیا از حذف این حساب مشتری اطمینان دارید؟ اطلاعات مشتری به سطل زباله منتقل می‌شود و در صورت لزوم قابل بازیابی است."
        confirmLabel="انتقال به سطل زباله"
        cancelLabel="انصراف"
      />
    </div>
  );
};
