import React, { useState, useMemo } from 'react';
import {
  Hawala,
  HawalaStatus,
  CurrencyCode,
  AppSettings,
} from '../types';
import {
  SendHorizontal,
  PlusCircle,
  Search,
  Printer,
  MessageCircle,
  Edit2,
  Trash2,
  Download,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  Phone,
  User,
} from 'lucide-react';
import {
  formatAmount,
  formatToPersianDate,
  getTodayDateString,
  generateUniqueCode,
  formatHawalaNumber,
} from '../utils/formatters';
import { exportHawalasToCSV } from '../utils/exportImport';
import { buildHawalaMessage, openWhatsApp } from '../utils/whatsapp';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

interface HawalaPageProps {
  hawalas: Hawala[];
  settings: AppSettings;
  searchQuery: string;
  onSaveHawala: (hawala: Hawala) => Promise<void>;
  onDeleteHawala: (id: string, permanent?: boolean) => Promise<void>;
  onClearAllHawalas?: () => Promise<void>;
  onPrintHawala: (hawala: Hawala) => void;
  onUpdateStatus: (id: string, status: HawalaStatus) => Promise<void>;
  getNextHawalaNumber: () => Promise<string>;
  initialOpenNewModal?: boolean;
  onClearInitialOpenModal?: () => void;
}

export const HawalaPage: React.FC<HawalaPageProps> = ({
  hawalas,
  settings,
  searchQuery: globalSearchQuery,
  onSaveHawala,
  onDeleteHawala,
  onClearAllHawalas,
  onPrintHawala,
  onUpdateStatus,
  getNextHawalaNumber,
  initialOpenNewModal,
  onClearInitialOpenModal,
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | HawalaStatus>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHawala, setEditingHawala] = useState<Hawala | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePermanently, setDeletePermanently] = useState(true);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    hawalaNumber: string;
    hawalaCode: string;
    senderName: string;
    senderPhone: string;
    receiverName: string;
    receiverPhone: string;
    destinationCity: string;
    amount: string;
    currency: CurrencyCode;
    commission: string;
    date: string;
    description: string;
    status: HawalaStatus;
  }>({
    hawalaNumber: '',
    hawalaCode: '',
    senderName: '',
    senderPhone: '',
    receiverName: '',
    receiverPhone: '',
    destinationCity: 'کابل',
    amount: '',
    currency: settings.defaultCurrency,
    commission: '0',
    date: getTodayDateString(),
    description: '',
    status: 'pending',
  });

  const [formError, setFormError] = useState('');
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);

  // Open modal if triggered by parent
  React.useEffect(() => {
    if (initialOpenNewModal) {
      handleOpenCreate();
      if (onClearInitialOpenModal) onClearInitialOpenModal();
    }
  }, [initialOpenNewModal]);

  const handleOpenCreate = async () => {
    setEditingHawala(null);
    setFormError('');
    setIsGeneratingNumber(true);
    setIsModalOpen(true);

    try {
      const nextNum = await getNextHawalaNumber();
      setFormData({
        hawalaNumber: nextNum,
        hawalaCode: generateUniqueCode('STS'),
        senderName: '',
        senderPhone: '',
        receiverName: '',
        receiverPhone: '',
        destinationCity: 'کابل',
        amount: '',
        currency: settings.defaultCurrency,
        commission: '0',
        date: getTodayDateString(),
        description: '',
        status: 'pending',
      });
    } catch {
      setFormData((prev) => ({
        ...prev,
        hawalaNumber: '01',
        hawalaCode: generateUniqueCode('STS'),
      }));
    } finally {
      setIsGeneratingNumber(false);
    }
  };

  const handleOpenEdit = (h: Hawala) => {
    setEditingHawala(h);
    setFormData({
      hawalaNumber: h.hawalaNumber,
      hawalaCode: h.hawalaCode,
      senderName: h.senderName,
      senderPhone: h.senderPhone,
      receiverName: h.receiverName,
      receiverPhone: h.receiverPhone,
      destinationCity: h.destinationCity,
      amount: String(h.amount),
      currency: h.currency,
      commission: String(h.commission),
      date: h.date,
      description: h.description || '',
      status: h.status,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.senderName.trim()) {
      setFormError('نام فرستنده الزامی است.');
      return;
    }
    if (!formData.receiverName.trim()) {
      setFormError('نام گیرنده الزامی است.');
      return;
    }
    if (!formData.destinationCity.trim()) {
      setFormError('شهر مقصد الزامی است.');
      return;
    }
    const numAmount = parseFloat(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('مبلغ حواله باید عددی معتبر و بزرگتر از صفر باشد.');
      return;
    }
    const numCommission = parseFloat(formData.commission) || 0;

    const hawalaId = editingHawala ? editingHawala.id : 'HW-UUID-' + Date.now();

    const hawalaToSave: Hawala = {
      id: hawalaId,
      hawalaNumber: formatHawalaNumber(formData.hawalaNumber),
      hawalaCode: formData.hawalaCode || generateUniqueCode('STS'),
      senderName: formData.senderName.trim(),
      senderPhone: formData.senderPhone.trim(),
      receiverName: formData.receiverName.trim(),
      receiverPhone: formData.receiverPhone.trim(),
      destinationCity: formData.destinationCity.trim(),
      amount: numAmount,
      currency: formData.currency,
      commission: numCommission,
      date: formData.date,
      description: formData.description.trim(),
      status: formData.status,
      createdAt: editingHawala ? editingHawala.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveHawala(hawalaToSave);
    setIsModalOpen(false);
  };

  // Unique cities list for filter
  const cityOptions = useMemo(() => {
    const cities = new Set<string>();
    for (const h of hawalas) {
      if (h.destinationCity) cities.add(h.destinationCity);
    }
    return Array.from(cities);
  }, [hawalas]);

  // Filtered hawalas
  const filteredHawalas = useMemo(() => {
    let result = hawalas;

    const query = (localSearch || globalSearchQuery).toLowerCase().trim();
    if (query) {
      result = result.filter(
        (h) =>
          h.hawalaNumber.toLowerCase().includes(query) ||
          h.hawalaCode.toLowerCase().includes(query) ||
          h.senderName.toLowerCase().includes(query) ||
          h.receiverName.toLowerCase().includes(query) ||
          h.senderPhone.includes(query) ||
          h.receiverPhone.includes(query) ||
          h.destinationCity.toLowerCase().includes(query) ||
          String(h.amount).includes(query)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((h) => h.status === statusFilter);
    }

    if (cityFilter !== 'all') {
      result = result.filter((h) => h.destinationCity === cityFilter);
    }

    return result;
  }, [hawalas, localSearch, globalSearchQuery, statusFilter, cityFilter]);

  // Stats for filtered hawalas
  const hawalaStats = useMemo(() => {
    let totalAmt = 0;
    let totalFee = 0;
    let pending = 0;
    let completed = 0;

    for (const h of filteredHawalas) {
      totalAmt += h.amount;
      totalFee += h.commission;
      if (h.status === 'pending') pending++;
      if (h.status === 'completed') completed++;
    }

    return { totalAmt, totalFee, pending, completed };
  }, [filteredHawalas]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">سیستم صدور و پیگیری حواله</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            شماره‌گذاری ترتیبی خودکار از 01 همراه با چاپ رسید رسمی و واتساپ
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {onClearAllHawalas && hawalas.length > 0 && (
            <button
              onClick={() => setIsClearAllModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 rounded-xl border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer"
              title="پاکسازی تمام حواله‌ها"
            >
              <Trash2 className="w-4 h-4" />
              <span>پاکسازی همه حواله‌ها</span>
            </button>
          )}

          <button
            onClick={() => exportHawalasToCSV(filteredHawalas)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            title="خروجی فایل اکسل"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>خروجی اکسل</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>صدور حواله جدید</span>
          </button>
        </div>
      </div>

      {/* Filter strip */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="جستجوی شماره حواله، فرستنده، گیرنده، شهر..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-3 pr-9 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="pending">در حال انتظار (Pending)</option>
              <option value="completed">پرداخت و تکمیل شده (Completed)</option>
              <option value="cancelled">لغو شده (Cancelled)</option>
            </select>
          </div>

          {/* City Filter */}
          <div>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              <option value="all">همه شهرهای مقصد</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-slate-400">مجموع مبالغ: </span>
              <span className="font-mono text-slate-900 dark:text-white font-bold">
                {formatAmount(hawalaStats.totalAmt)}
              </span>
            </div>
            <div>
              <span className="text-slate-400">مجموع کمیشن: </span>
              <span className="font-mono text-emerald-600 font-bold">
                {formatAmount(hawalaStats.totalFee)}
              </span>
            </div>
            <div>
              <span className="text-slate-400">در انتظار: </span>
              <span className="font-mono text-amber-600 font-bold">{hawalaStats.pending}</span>
            </div>
            <div>
              <span className="text-slate-400">تکمیل شده: </span>
              <span className="font-mono text-emerald-600 font-bold">{hawalaStats.completed}</span>
            </div>
          </div>
          <div className="text-slate-400 font-normal">
            نمایش {filteredHawalas.length} حواله
          </div>
        </div>
      </div>

      {/* Hawalas Cards / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredHawalas.map((h) => (
          <div
            key={h.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
          >
            <div>
              {/* Card top */}
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    {h.hawalaNumber}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {h.hawalaCode}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {h.status === 'completed' ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <CheckCircle2 className="w-3 h-3" />
                      پرداخت شده
                    </span>
                  ) : h.status === 'cancelled' ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                      <XCircle className="w-3 h-3" />
                      لغو شده
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      <Clock className="w-3 h-3" />
                      در انتظار
                    </span>
                  )}
                </div>
              </div>

              {/* Sender & Receiver info */}
              <div className="my-3 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-400">فرستنده:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{h.senderName}</span>
                  </div>
                  {h.senderPhone && (
                    <span className="text-[11px] text-slate-500 font-mono" dir="ltr">
                      {h.senderPhone}
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <User className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span className="text-slate-400">گیرنده:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{h.receiverName}</span>
                  </div>
                  {h.receiverPhone && (
                    <span className="text-[11px] text-slate-500 font-mono" dir="ltr">
                      {h.receiverPhone}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 pt-1">
                  <div className="flex items-center gap-1 text-[11px]">
                    <MapPin className="w-3 h-3 text-rose-500" />
                    <span>شهر مقصد: <strong className="text-slate-800 dark:text-slate-200">{h.destinationCity}</strong></span>
                  </div>
                  <span className="text-[11px]">{formatToPersianDate(h.date)}</span>
                </div>
              </div>

              {/* Amount Box */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400">مبلغ حواله:</span>
                  <div className="font-mono font-black text-base text-slate-900 dark:text-white">
                    {formatAmount(h.amount)} <span className="text-xs font-normal">{h.currency}</span>
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-[10px] text-slate-400">کمیشن:</span>
                  <div className="font-mono font-bold text-xs text-emerald-600">
                    {formatAmount(h.commission)} {h.currency}
                  </div>
                </div>
              </div>

              {h.description && (
                <div className="mt-2 text-[11px] text-slate-500 line-clamp-1">
                  توضیح: {h.description}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {/* Quick Status toggle */}
              <div className="flex items-center gap-1">
                {h.status !== 'completed' && (
                  <button
                    onClick={() => onUpdateStatus(h.id, 'completed')}
                    className="text-[10px] font-bold px-2 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg transition-colors cursor-pointer"
                  >
                    تکمیل و تسویه
                  </button>
                )}
                {h.status === 'pending' && (
                  <button
                    onClick={() => onUpdateStatus(h.id, 'cancelled')}
                    className="text-[10px] font-bold px-2 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg transition-colors cursor-pointer"
                  >
                    لغو
                  </button>
                )}
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-1">
                {/* WhatsApp */}
                <button
                  onClick={() => {
                    const msg = buildHawalaMessage(h, settings.templates.hawala);
                    openWhatsApp(h.senderPhone || h.receiverPhone, msg);
                  }}
                  className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
                  title="ارسال مشخصات حواله در واتساپ"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>

                {/* Print Receipt */}
                <button
                  onClick={() => onPrintHawala(h)}
                  className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="چاپ رسید رسمی حواله"
                >
                  <Printer className="w-4 h-4" />
                </button>

                {/* Edit */}
                <button
                  onClick={() => handleOpenEdit(h)}
                  className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="ویرایش حواله"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => setDeleteTargetId(h.id)}
                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                  title="انتقال به سطل زباله"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredHawalas.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            هیچ حواله‌ای یافت نشد. برای ثبت حواله جدید روی دکمه «صدور حواله جدید» کلیک کنید.
          </div>
        )}
      </div>

      {/* Add / Edit Hawala Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingHawala ? 'ویرایش حواله صرافی' : 'صدور حواله ارزی / ریالی جدید'}
        subtitle="شماره حواله به صورت کاملاً ترتیبی و دائمی تولید می‌گردد"
        maxWidth="xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-medium">
              {formError}
            </div>
          )}

          {/* Sequential number & code indicators */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">
                شماره حواله (سیستمی):
              </span>
              <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
                {formData.hawalaNumber || (isGeneratingNumber ? 'در حال صدور...' : '01')}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">
                کد پیگیری حواله:
              </span>
              <span className="font-mono text-sm font-black text-slate-800 dark:text-slate-200">
                {formData.hawalaCode}
              </span>
            </div>
          </div>

          {/* Sender details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                نام فرستنده *
              </label>
              <input
                type="text"
                placeholder="مثلاً حاجی احمدشاه"
                value={formData.senderName}
                onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                شماره تلفن فرستنده
              </label>
              <input
                type="text"
                placeholder="0799123456"
                value={formData.senderPhone}
                onChange={(e) => setFormData({ ...formData, senderPhone: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 font-mono"
                dir="ltr"
              />
            </div>
          </div>

          {/* Receiver details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                نام گیرنده حواله *
              </label>
              <input
                type="text"
                placeholder="مثلاً محمود پوپلزی"
                value={formData.receiverName}
                onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                شماره تلفن گیرنده
              </label>
              <input
                type="text"
                placeholder="0700112233"
                value={formData.receiverPhone}
                onChange={(e) => setFormData({ ...formData, receiverPhone: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 font-mono"
                dir="ltr"
              />
            </div>
          </div>

          {/* Destination City */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                شهر / ولایت مقصد *
              </label>
              <input
                type="text"
                placeholder="کابل، هرات، قندهار، مزارشریف، جلال‌آباد..."
                value={formData.destinationCity}
                onChange={(e) => setFormData({ ...formData, destinationCity: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                تاریخ صدور *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          {/* Amount, Currency, Commission */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                مبلغ حواله *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="50000"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                واحد پول *
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value as CurrencyCode })}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500"
              >
                {settings.supportedCurrencies.map((cur) => (
                  <option key={cur.code} value={cur.code}>
                    {cur.code} ({cur.nameFa})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                کمیشن / کارمزد
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="200"
                value={formData.commission}
                onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              وضعیت حواله
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['pending', 'completed', 'cancelled'] as HawalaStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFormData({ ...formData, status: st })}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    formData.status === st
                      ? st === 'completed'
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : st === 'cancelled'
                        ? 'bg-rose-600 text-white border-rose-700'
                        : 'bg-amber-500 text-white border-amber-600'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {st === 'pending' ? 'در انتظار' : st === 'completed' ? 'تکمیل شده' : 'لغو شده'}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              توضیحات و آدرس تحویل
            </label>
            <textarea
              rows={2}
              placeholder="مثلاً: تحویل در مارکت صرافی هرات به آقای فیضی با کارت هویت..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {editingHawala ? 'ذخیره ویرایش حواله' : 'ثبت و صدور قطعی حواله'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Hawala Confirmation Dialog */}
      <Modal
        isOpen={deleteTargetId !== null}
        onClose={() => {
          setDeleteTargetId(null);
          setDeletePermanently(true);
        }}
        title="حذف حواله صرافی"
        maxWidth="md"
      >
        <div className="space-y-4 text-right">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            آیا از حذف این حواله اطمینان دارید؟ با تایید حذف قطعی، این حواله به طور دائمی از سیستم پاک شده و هرگز باز نخواهد گشت.
          </p>

          <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/40 space-y-2">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deletePermanently}
                onChange={(e) => setDeletePermanently(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-600"
              />
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                حذف قطعی و دائمی از کل سیستم (عدم نمایش مجدد و بدون امکان بازگشت)
              </span>
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pr-7 leading-relaxed">
              {deletePermanently
                ? 'حواله به صورت کامل از پایگاه داده و حافظه سیستم حذف می‌شود و هرگز باز نخواهد گشت.'
                : 'حواله موقتاً به سطل زباله منتقل می‌شود.'}
            </p>
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
                  onDeleteHawala(deleteTargetId, deletePermanently);
                  setDeleteTargetId(null);
                  setDeletePermanently(true);
                }
              }}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-colors cursor-pointer ${
                deletePermanently
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {deletePermanently ? 'حذف قطعی حواله' : 'انتقال به سطل زباله'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirm Clear All Hawalas */}
      <Modal
        isOpen={isClearAllModalOpen}
        onClose={() => !isClearingAll && setIsClearAllModalOpen(false)}
        title="تایید پاکسازی تمام حواله‌ها"
        maxWidth="md"
      >
        <div className="space-y-4 text-right">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs leading-relaxed">
            <p className="font-bold mb-1">هشدار بسیار مهم:</p>
            <p>
              شما در حال پاکسازی کامل <strong>تمامی حواله‌های ثبت‌شده</strong> در سیستم هستید.
              این عمل تمامی حواله‌ها را به صورت دائمی از پایگاه داده و حافظه دستگاه حذف کرده و غیرقابل بازگشت است.
            </p>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            آیا کاملاً مطمئن هستید که می‌خواهید تمام حواله‌های صادرشده را پاکسازی کنید؟
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={isClearingAll}
              onClick={() => setIsClearAllModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={isClearingAll}
              onClick={async () => {
                if (onClearAllHawalas) {
                  setIsClearingAll(true);
                  try {
                    await onClearAllHawalas();
                    setIsClearAllModalOpen(false);
                  } finally {
                    setIsClearingAll(false);
                  }
                }
              }}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isClearingAll ? 'در حال پاکسازی...' : 'بله، همه حواله‌ها پاکسازی شوند'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
