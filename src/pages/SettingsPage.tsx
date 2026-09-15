import React, { useState, useRef } from 'react';
import { AppSettings, CurrencyCode } from '../types';
import {
  Settings,
  Building,
  Phone,
  Coins,
  FileText,
  MessageCircle,
  Database,
  Save,
  RefreshCw,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Activity,
  HardDrive,
} from 'lucide-react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { downloadFile, readJSONFile } from '../utils/exportImport';

interface SettingsPageProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onExportBackup: () => Promise<void>;
  onImportBackup: (fileContent: string) => Promise<boolean>;
  onClearDatabase: () => Promise<void>;
  onClearAllTransactions?: () => Promise<void>;
  onHealthCheck: () => Promise<{ healthy: boolean; repaired: boolean; message: string }>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onSaveSettings,
  onExportBackup,
  onImportBackup,
  onClearDatabase,
  onClearAllTransactions,
  onHealthCheck,
}) => {
  const [activeSection, setActiveSection] = useState<'general' | 'currencies' | 'templates' | 'database'>('general');
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isClearTxsConfirmOpen, setIsClearTxsConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await readJSONFile(file);
      const success = await onImportBackup(content);
      if (success) {
        alert('اطلاعات پشتیبان با موفقیت بازیابی شد.');
        window.location.reload();
      } else {
        alert('خطا در بارگذاری فایل پشتیبان. لطفاً فرمت فایل را بررسی نمایید.');
      }
    } catch (err) {
      alert('فایل پشتیبان نامعتبر است.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRunHealthCheck = async () => {
    setIsCheckingHealth(true);
    setHealthStatus(null);
    try {
      const result = await onHealthCheck();
      setHealthStatus(result.message);
    } catch {
      setHealthStatus('خطا در اجرای فرآیند عیب‌یابی دیتابیس.');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  return (
    <div className="space-y-5 text-emerald-50">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-emerald-950/90 text-white p-4.5 rounded-2xl border border-emerald-700/60 shadow-lg shadow-emerald-950/20 backdrop-blur-md">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <span>تنظیمات سیستم و پیکربندی صرافی</span>
          </h2>
          <p className="text-xs text-emerald-200/80 mt-0.5">
            شخصی‌سازی سربرگ اسناد، الگوهای پیام واتساپ، واحدهای پولی و پشتیبان‌گیری آفلاین
          </p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black animate-fade-in shadow-md shadow-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
            <span>تنظیمات با موفقیت ذخیره شد</span>
          </div>
        )}
      </div>

      {/* Main Settings Form */}
      {/* Main Settings Form: Separated Right Navigation & Left Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Navigation Sidebar (طرف راست صفحه تنظیمات - ثابت و بدون حرکت هنگام رول کردن محتوا) */}
        <div className="lg:col-span-4 bg-emerald-950/95 p-4 sm:p-5 rounded-3xl border-2 border-emerald-500/50 shadow-2xl space-y-2.5 backdrop-blur-md lg:sticky lg:top-3 z-10 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
          <div className="mb-3 px-1 pb-2.5 border-b border-emerald-800/70 flex items-center justify-between">
            <span className="text-xs font-black text-emerald-300">بخش‌های تنظیمات</span>
            <span className="text-[10px] text-emerald-400/70 bg-emerald-900/60 px-2 py-0.5 rounded-full font-mono">۴ بخش</span>
          </div>
          {[
            {
              id: 'general',
              label: 'اطلاعات عمومی صرافی',
              desc: 'نام شرکت، مدیریت، تلفن و نشانی دفتر',
              icon: Building,
            },
            {
              id: 'currencies',
              label: 'واحدهای پولی صرافی',
              desc: 'ارز پیش‌فرض، نرخ‌ها و فعال‌سازی ارزها',
              icon: Coins,
            },
            {
              id: 'templates',
              label: 'الگوهای پیام و رسیدها',
              desc: 'متن پیام واتساپ و سربرگ فاکتور چاپی',
              icon: MessageCircle,
            },
            {
              id: 'database',
              label: 'پشتیبان‌گیری و پایگاه داده',
              desc: 'خروجی اکسل/JSON، عیب‌یابی و ریست داده',
              icon: Database,
            },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id as any)}
                className={`w-full flex items-start gap-3.5 p-3.5 sm:p-4 rounded-2xl text-right transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-xl shadow-emerald-500/25 scale-[1.01]'
                    : 'text-emerald-200/90 hover:bg-emerald-900/70 hover:text-white border border-emerald-800/50 bg-emerald-950/50'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-900/80 text-emerald-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black leading-tight">{item.label}</div>
                  <div
                    className={`text-[11px] font-normal mt-1 leading-relaxed ${
                      isActive ? 'text-slate-900/85' : 'text-emerald-400/75'
                    }`}
                  >
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Content Area (صفحه سمت چپ تنظیمات - کادر مستقل) */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSave} className="space-y-5">
            {/* General Info */}
            {activeSection === 'general' && (
              <div className="bg-emerald-950/90 p-6 rounded-2xl border border-emerald-700/60 shadow-lg shadow-emerald-950/20 space-y-4 backdrop-blur-md">
                <h3 className="text-sm font-bold text-white border-b border-emerald-800/80 pb-3 flex items-center gap-2">
                  <Building className="w-4 h-4 text-emerald-400" />
                  <span>اطلاعات هویت صرافی</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-emerald-200 mb-1">
                      نام صرافی / شرکت *
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-emerald-900/60 border border-emerald-700/70 text-white placeholder-emerald-400/60 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-200 mb-1">
                      نام مدیر صرافی
                    </label>
                    <input
                      type="text"
                      value={formData.managerName}
                      onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-emerald-900/60 border border-emerald-700/70 text-white placeholder-emerald-400/60 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-emerald-200 mb-1">
                      شماره تماس صرافی / واتساپ مدیر
                    </label>
                    <input
                      type="text"
                      value={formData.managerPhone}
                      onChange={(e) => setFormData({ ...formData, managerPhone: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-emerald-900/60 border border-emerald-700/70 text-white placeholder-emerald-400/60 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-200 mb-1">
                      شهر و آدرس دفتر صرافی
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-emerald-900/60 border border-emerald-700/70 text-white placeholder-emerald-400/60 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-200 mb-1">
                    متن پانوشت رسید چاپی
                  </label>
                  <input
                    type="text"
                    value={formData.receiptFooterText}
                    onChange={(e) => setFormData({ ...formData, receiptFooterText: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-emerald-900/60 border border-emerald-700/70 text-white placeholder-emerald-400/60 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                  />
                </div>
              </div>
            )}

            {/* Currencies */}
            {activeSection === 'currencies' && (
              <div className="bg-emerald-950/90 p-6 rounded-2xl border border-emerald-700/60 shadow-lg shadow-emerald-950/20 space-y-4 backdrop-blur-md">
                <h3 className="text-sm font-bold text-white border-b border-emerald-800/80 pb-3 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <span>تنظیمات ارزها و واحد پولی پیش‌فرض</span>
                </h3>

                <div>
                  <label className="block text-xs font-bold text-emerald-200 mb-1">
                    واحد پولی پیش‌فرض سیستم (مبنای داشبورد)
                  </label>
                  <select
                    value={formData.defaultCurrency}
                    onChange={(e) => setFormData({ ...formData, defaultCurrency: e.target.value as CurrencyCode })}
                    className="w-full sm:w-64 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-900/70 border border-emerald-700/70 text-white focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                  >
                    {formData.supportedCurrencies.map((cur) => (
                      <option key={cur.code} value={cur.code} className="bg-emerald-950 text-white">
                        {cur.code} - {cur.nameFa} ({cur.symbol})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-emerald-300/80 mt-1">
                    واحد پولی پیش‌فرض در افغانستان معمولاً AFN (افغانی) می‌باشد.
                  </p>
                </div>

                <div className="pt-2">
                  <span className="block text-xs font-bold text-emerald-200 mb-2">
                    واحدهای پولی فعال در سیستم:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {formData.supportedCurrencies.map((c) => (
                      <div
                        key={c.code}
                        className="p-3 bg-emerald-900/50 rounded-xl border border-emerald-700/60 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-white">{c.code}</span>
                          <span className="text-[11px] text-emerald-300/80 block">{c.nameFa}</span>
                        </div>
                        <span className="font-mono text-emerald-400 font-bold">{c.symbol}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Templates */}
            {activeSection === 'templates' && (
              <div className="bg-emerald-950/90 p-6 rounded-2xl border border-emerald-700/60 shadow-lg shadow-emerald-950/20 space-y-4 backdrop-blur-md">
                <h3 className="text-sm font-bold text-white border-b border-emerald-800/80 pb-3 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>الگوهای متنی ارسال واتساپ</span>
                </h3>

                <div>
                  <label className="block text-xs font-bold text-emerald-200 mb-1">
                    الگوی ارسال حواله در واتساپ
                  </label>
                  <textarea
                    rows={7}
                    value={formData.templates.hawala}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        templates: { ...formData.templates, hawala: e.target.value },
                      })
                    }
                    className="w-full p-3 text-xs rounded-xl bg-emerald-900/60 border border-emerald-700/70 text-white font-mono focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                  />
                  <p className="text-[11px] text-emerald-300/80 mt-1">
                    متغیرهای مجاز: {'{sender}'} فرستنده، {'{code}'} کد، {'{hawalaNumber}'} شماره حواله، {'{receiver}'} گیرنده، {'{city}'} شهر، {'{amount}'} مبلغ، {'{currency}'} واحد، {'{fee}'} کمیشن، {'{date}'} تاریخ
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-200 mb-1">
                    الگوی ارسال تراکنش روزنامچه در واتساپ
                  </label>
                  <textarea
                    rows={6}
                    value={formData.templates.transaction}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        templates: { ...formData.templates, transaction: e.target.value },
                      })
                    }
                    className="w-full p-3 text-xs rounded-xl bg-emerald-900/60 border border-emerald-700/70 text-white font-mono focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                  />
                  <p className="text-[11px] text-emerald-300/80 mt-1">
                    متغیرهای مجاز: {'{name}'} نام مشتری، {'{type}'} طلب/گرفت، {'{amount}'} مبلغ، {'{currency}'} واحد، {'{balance}'} بیلانس جدید، {'{date}'} تاریخ
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-200 mb-1">
                    الگوی ارسال وضعیت صورتحساب / بیلانس مشتری در واتساپ (بدون شماره تماس)
                  </label>
                  <textarea
                    rows={6}
                    value={formData.templates.customerBalance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        templates: { ...formData.templates, customerBalance: e.target.value },
                      })
                    }
                    className="w-full p-3 text-xs rounded-xl bg-emerald-900/60 border border-emerald-700/70 text-white font-mono focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                  />
                  <p className="text-[11px] text-emerald-300/80 mt-1">
                    متغیرهای مجاز: {'{name}'} نام مشتری، {'{status}'} وضعیت (طلب/گرفت)، {'{balance}'} مبلغ، {'{currency}'} واحد، {'{date}'} تاریخ
                  </p>
                </div>
              </div>
            )}

            {/* Database & Backup */}
            {activeSection === 'database' && (
              <div className="bg-emerald-950/90 p-6 rounded-2xl border border-emerald-700/60 shadow-lg shadow-emerald-950/20 space-y-6 backdrop-blur-md">
                <h3 className="text-sm font-bold text-white border-b border-emerald-800/80 pb-3 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>پشتیبان‌گیری، بازیابی و پایداری اطلاعات دیتابیس</span>
                </h3>

                {/* Export & Import Backup */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-900/50 rounded-xl border border-emerald-700/60 space-y-2">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-emerald-400" />
                      تهیه نسخه پشتیبان کامل (Backup)
                    </span>
                    <p className="text-[11px] text-emerald-200/80">
                      خروجی گرفتن از تمامی مشتریان، روزنامچه، حواله‌ها و تنظیمات در قالب فایل امن JSON
                    </p>
                    <button
                      type="button"
                      onClick={onExportBackup}
                      className="w-full mt-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-950/40"
                    >
                      <Download className="w-4 h-4" />
                      <span>دانلود فایل پشتیبان کامل</span>
                    </button>
                  </div>

                  <div className="p-4 bg-emerald-900/50 rounded-xl border border-emerald-700/60 space-y-2">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-teal-400" />
                      بازیابی نسخه پشتیبان (Restore)
                    </span>
                    <p className="text-[11px] text-emerald-200/80">
                      بازگرداندن فایل پشتیبان قبلی به داخل نرم‌افزار به صورت آفلاین
                    </p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".json"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full mt-2 py-2.5 px-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-950/40"
                    >
                      <Upload className="w-4 h-4" />
                      <span>انتخاب فایل پشتیبان جهت بازیابی</span>
                    </button>
                  </div>
                </div>

                {/* Health Check & Repair */}
                <div className="p-4 bg-emerald-900/50 rounded-xl border border-emerald-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-white flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        بررسی سلامت و تعمیر خودکار دیتابیس (Health Check)
                      </span>
                      <p className="text-[11px] text-emerald-200/80 mt-0.5">
                        اسکن جداول، تطبیق مجدد بیلانس کلیه مشتریان بر اساس جمع طلب و گرفت روزنامچه و رفع هرگونه ناهماهنگی
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isCheckingHealth}
                      onClick={handleRunHealthCheck}
                      className="py-2 px-3 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-emerald-600/60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                      <span>{isCheckingHealth ? 'در حال بررسی...' : 'اجرای عیب‌یابی'}</span>
                    </button>
                  </div>

                  {healthStatus && (
                    <div className="p-3 bg-emerald-900/70 border border-emerald-600/80 rounded-xl text-xs font-medium text-emerald-100 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{healthStatus}</span>
                    </div>
                  )}
                </div>

                {/* Clear Transactions Only */}
                {onClearAllTransactions && (
                  <div className="p-4 bg-amber-950/40 rounded-xl border border-amber-700/60 space-y-2">
                    <span className="font-bold text-xs text-amber-200 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4 text-amber-400" />
                      تخلیه تمام تراکنش‌های ثبت‌شده روزنامچه
                    </span>
                    <p className="text-[11px] text-amber-300/80">
                      پاکسازی کامل رکوردهای طلب و گرفت روزنامچه و صفر کردن بیلانس حساب‌ها، با حفظ کامل لیست مشتریان و حواله‌ها.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsClearTxsConfirmOpen(true)}
                      className="py-2 px-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>تخلیه تمام تراکنش‌های روزنامچه</span>
                    </button>
                  </div>
                )}

                {/* Dangerous Area */}
                <div className="p-4 bg-rose-950/40 rounded-xl border border-rose-700/60 space-y-2">
                  <span className="font-bold text-xs text-rose-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    منطقه حساس: پاکسازی کامل پایگاه داده
                  </span>
                  <p className="text-[11px] text-rose-300/80">
                    با این اقدام تمامی تراکنش‌ها، مشتریان و حواله‌ها به طور برگشت‌ناپذیر پاک خواهند شد.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsClearConfirmOpen(true)}
                    className="py-2 px-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف تمامی داده‌ها و راه‌اندازی اولیه</span>
                  </button>
                </div>
              </div>
            )}

            {/* Save Button Bar */}
            {activeSection !== 'database' && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-emerald-950/30 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>ذخیره کلیه تنظیمات</span>
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Clear All Transactions Confirm */}
      <ConfirmDialog
        isOpen={isClearTxsConfirmOpen}
        onClose={() => setIsClearTxsConfirmOpen(false)}
        onConfirm={async () => {
          if (onClearAllTransactions) {
            await onClearAllTransactions();
          }
          setIsClearTxsConfirmOpen(false);
        }}
        title="تخلیه تمام تراکنش‌های ثبت‌شده روزنامچه"
        message="آیا از تخلیه کامل تمام تراکنش‌های ثبت‌شده در روزنامچه مطمئن هستید؟ با این اقدام، تمام اقلام طلب و گرفت پاک شده و بیلانس مشتریان صفر خواهد شد (مشخصات مشتریان و حواله‌ها باقی می‌مانند)."
        confirmLabel="بله، تمام تراکنش‌ها خالی شود"
        cancelLabel="انصراف"
      />

      {/* Clear Database Confirm */}
      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={async () => {
          await onClearDatabase();
          setIsClearConfirmOpen(false);
          window.location.reload();
        }}
        title="هشدار فوق‌العاده حساس: حذف کامل دیتابیس"
        message="آیا مطمئن هستید که می‌خواهید تمامی داده‌ها، مشتریان، حواله‌ها و تراکنش‌ها را برای همیشه پاک کنید؟ این عملیات به هیچ عنوان قابل بازگشت نیست."
        confirmLabel="بله، تمامی داده‌ها پاک شوند"
        cancelLabel="انصراف"
      />
    </div>
  );
};
