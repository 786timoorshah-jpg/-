import React, { useState, useEffect } from 'react';
import {
  Search,
  PlusCircle,
  SendHorizontal,
  Database,
  Moon,
  Sun,
  ShieldCheck,
  CalendarDays,
  LogOut,
  Maximize,
  Minimize,
} from 'lucide-react';
import { formatToPersianDate, getTodayDateString } from '../../utils/formatters';

interface HeaderProps {
  onOpenNewTransaction: () => void;
  onOpenNewHawala: () => void;
  onQuickBackup: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  theme: 'light' | 'dark' | 'system';
  onToggleTheme: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewTransaction,
  onOpenNewHawala,
  onQuickBackup,
  searchQuery,
  onSearchChange,
  theme,
  onToggleTheme,
  onLogout,
}) => {
  const todayPersian = formatToPersianDate(getTodayDateString());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <header className="bg-emerald-950 text-white border-b border-emerald-800/70 px-6 py-3.5 sticky top-0 z-30 shadow-md shadow-emerald-950/20 no-print transition-colors">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Branding */}
        <div className="flex items-center gap-3.5 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-cyan-400/40 shadow-lg shadow-cyan-500/20 bg-slate-950 flex items-center justify-center shrink-0 p-0.5">
              <img
                src="/sts-logo.jpg"
                alt="STS سادات"
                className="w-full h-full object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">STS سادات</h1>
              </div>
              <p className="text-xs font-medium text-emerald-300/80">
                خدمات پولی و صرافی سادات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl text-emerald-200 hover:text-white bg-emerald-900/80 border border-emerald-700/60"
              title="تغییر تم"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 rounded-xl text-rose-300 hover:text-white bg-rose-900/50 border border-rose-700/60"
                title="خروج از حساب"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="w-full md:max-w-md relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-emerald-400 absolute right-3 pointer-events-none" />
            <input
              id="global-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="جستجوی سریع مشتری، شماره تلفن، کد حواله، تراکنش... (Ctrl+F)"
              className="w-full pl-4 pr-9 py-2 text-xs md:text-sm rounded-xl bg-emerald-900/60 border border-emerald-700/70 text-emerald-100 placeholder-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute left-2.5 text-xs text-emerald-300 hover:text-white px-1"
              >
                پاک
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions & Date */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {/* Today Date Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-900/70 border border-emerald-700/60 text-xs font-medium text-emerald-200">
            <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
            <span>{todayPersian}</span>
          </div>

          {/* Quick Transaction */}
          <button
            onClick={onOpenNewTransaction}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:opacity-90 text-slate-950 rounded-xl text-sm font-bold shadow-md shadow-emerald-500/20 transition-all shrink-0 cursor-pointer"
            title="ثبت تراکنش روزنامچه (Ctrl+N)"
          >
            <PlusCircle className="w-4 h-4 text-slate-950" />
            <span>ثبت تراکنش</span>
          </button>

          {/* Quick Hawala */}
          <button
            onClick={onOpenNewHawala}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-emerald-100 border border-emerald-600/70 rounded-xl text-sm font-bold shadow-sm transition-all shrink-0 cursor-pointer"
            title="ارسال حواله جدید (Ctrl+H)"
          >
            <SendHorizontal className="w-4 h-4 text-emerald-300" />
            <span>حواله جدید</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-2 text-emerald-200 hover:text-white hover:bg-emerald-900/70 border border-emerald-700/60 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            title={isFullscreen ? 'خروج از تمام‌صفحه (Esc)' : 'تمام‌صفحه کردن نرم‌افزار (F11)'}
          >
            {isFullscreen ? (
              <>
                <Minimize className="w-4 h-4 text-amber-300" />
                <span className="hidden sm:inline">پنجره عادی</span>
              </>
            ) : (
              <>
                <Maximize className="w-4 h-4 text-emerald-300" />
                <span className="hidden sm:inline">تمام صفحه</span>
              </>
            )}
          </button>

          {/* Quick Backup */}
          <button
            onClick={onQuickBackup}
            className="hidden sm:flex items-center gap-2 px-3 py-2 text-emerald-200 hover:text-white hover:bg-emerald-900/70 border border-transparent hover:border-emerald-700/60 rounded-xl text-sm font-bold transition-colors cursor-pointer"
            title="پشتیبان‌گیری سریع (Ctrl+B)"
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span className="hidden xl:inline">بکاپ</span>
          </button>

          {/* Theme switcher */}
          <button
            onClick={onToggleTheme}
            className="hidden md:flex p-2 rounded-xl text-emerald-300 hover:text-white hover:bg-emerald-900/70 border border-transparent hover:border-emerald-700/60 transition-colors cursor-pointer"
            title="تغییر تم رنگی"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-rose-300 hover:text-rose-100 hover:bg-rose-950/60 border border-rose-800/40 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="خروج از سیستم"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden xl:inline">خروج</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
