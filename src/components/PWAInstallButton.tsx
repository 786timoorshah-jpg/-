import React, { useState } from 'react';
import {
  Download,
  Monitor,
  Laptop,
  CheckCircle2,
  ExternalLink,
  X,
  Smartphone,
  Sparkles,
  Info
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'banner' | 'card' | 'sidebar';
  className?: string;
  onInstalled?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'navbar',
  className = '',
  onInstalled,
}) => {
  const { isInstallable, isInstalled, isIOS, isIframe, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // If already installed and running as standalone app, show a verified badge or nothing
  if (isInstalled) {
    if (variant === 'banner') {
      return (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>نسخه دسکتاپ STS سادات با موفقیت نصب شده و فعال است.</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    setIsProcessing(true);
    try {
      if (isInstallable) {
        const result = await install();
        if (result === 'accepted') {
          onInstalled?.();
        } else if (result === 'dismissed') {
          // User canceled prompt
        }
      } else {
        // If beforeinstallprompt is not directly available (e.g. inside iframe, or iOS/Safari)
        setShowGuide(true);
      }
    } catch (err) {
      console.error('Install action error:', err);
      setShowGuide(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenStandaloneTab = () => {
    try {
      const targetUrl = window.location.origin + window.location.pathname;
      const link = document.createElement('a');
      link.href = targetUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      window.open(window.location.origin + window.location.pathname, '_blank');
    }
  };

  const handleOpenDetachedWindow = () => {
    try {
      const targetUrl = window.location.origin + window.location.pathname;
      const width = Math.min(1440, window.screen.availWidth || 1360);
      const height = Math.min(900, window.screen.availHeight || 860);
      const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
      const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
      window.open(
        targetUrl,
        'STSSadatStandalone',
        `popup=yes,width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
      );
    } catch {
      window.open(window.location.origin + window.location.pathname, '_blank');
    }
  };

  // Render modal guide for manual/browser installation
  const renderGuideModal = () => {
    if (!showGuide) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-right">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowGuide(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              aria-label="بستن"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                اجرای جدا از سایت و کارکرد آفلاین
              </h3>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Laptop className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
            {/* Quick Actions for Detaching and Installing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  handleOpenDetachedWindow();
                  setShowGuide(false);
                }}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Monitor className="w-4 h-4" />
                <span>۱. باز کردن در پنجره مستقل (جدا از سایت)</span>
              </button>

              <button
                onClick={() => {
                  if (isInstallable) {
                    install();
                    setShowGuide(false);
                  } else {
                    handleOpenStandaloneTab();
                  }
                }}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold text-xs shadow-md shadow-sky-600/20 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>۲. نصب برنامه روی دسکتاپ (PWA)</span>
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  ۱
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-xs">
                    چگونه برنامه را جدا از مرورگر باز کنیم؟
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    با کلیک روی دکمه سبز بالا، برنامه بلافاصله در پنجره‌ای مستقل (بدون نوار آدرس، بدون تب‌ها و کاملاً شبیه نرم‌افزارهای حسابداری ویندوز) باز می‌شود.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  ۲
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-xs">
                    چگونه آیکون دائمی روی دسکتاپ ویندوز / موبایل داشته باشیم؟
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    در مرورگر کروم یا اج، روی آیکون نصب (<strong className="text-emerald-600 dark:text-emerald-400">⊕ Install STS Sadat</strong>) در نوار آدرس یا منوی سه‌نقطه (Cast, save, and share / Install) کلیک نمایید تا آیکون روی صفحه دسکتاپ قرار گیرد.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/50 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  کارکرد ۱۰۰٪ آفلاین (بدون نیاز به اینترنت):
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                  این سیستم مجهز به سرویس‌ورکر و کش داخلی است. پایگاه‌داده (حساب‌های مشتریان، تراکنش‌ها و حواله‌ها) تماماً روی حافظه کامپیوتر شما ذخیره شده و بدون هیچ نیازی به اینترنت اجرا و ذخیره می‌شود.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <span className="font-bold block mb-1">💡 راهنمای رفع مشکل صفحه سفید روی دسکتاپ:</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-normal">
                  اگر پس از نصب، صفحه باز نشد یا سفید ماند، ابتدا از دکمه سبز <strong>«پنجره مستقل (جدا از سایت)»</strong> استفاده کنید تا در پنجره اختصاصی باز شود، یا در پنجره باز شده یک‌بار کلیدهای <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-mono">Ctrl + F5</kbd> را بفشارید تا برنامه بدون وابستگی کش باز شود.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setShowGuide(false)}
              className="w-full rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              متوجه شدم و بستن
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 1. Navbar compact variant
  if (variant === 'navbar') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          disabled={isProcessing}
          title="اجرا جدا از سایت و نصب نرم‌افزار دسکتاپ (آفلاین)"
          className={`flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-3 py-2 text-xs font-bold shadow-sm shadow-emerald-700/20 transition-all active:scale-95 group cursor-pointer ${className}`}
        >
          <Laptop className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span>جدا از سایت / نصب آفلاین</span>
        </button>
        {renderGuideModal()}
      </>
    );
  }

  // 2. Sidebar variant
  if (variant === 'sidebar') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          disabled={isProcessing}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600/15 via-teal-600/10 to-emerald-600/15 hover:from-emerald-600/25 hover:to-teal-600/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25 text-xs font-bold transition group cursor-pointer ${className}`}
        >
          <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
            <Laptop className="w-4 h-4" />
          </div>
          <div className="text-right flex-1 min-w-0">
            <div className="truncate">جدا از سایت / نصب دسکتاپ</div>
            <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">اجرای ۱۰۰٪ آفلاین</div>
          </div>
          <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 opacity-80 group-hover:translate-x-[-2px] transition-transform shrink-0" />
        </button>
        {renderGuideModal()}
      </>
    );
  }

  // 3. Banner variant (for Dashboard header / notice)
  return (
    <>
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-l from-emerald-600 via-emerald-700 to-teal-800 p-4 text-white shadow-md ${className}`}>
        <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-12 -translate-y-12 pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3 text-right">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs text-emerald-200 shrink-0 border border-white/10">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-white">نصب برنامه STS سادات روی دسکتاپ کامپیوتر</h4>
                <span className="rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 text-[10px] font-semibold">
                  یک کلیک
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                بدون نیاز به مرورگر، سیستم را مانند نرم‌افزار حسابداری مستقل در ویندوز یا مک با دسترسی آفلاین اجرا کنید.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <button
              onClick={() => setShowGuide(true)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition"
            >
              راهنما
            </button>
            <button
              onClick={handleInstallClick}
              disabled={isProcessing}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold shadow-sm transition active:scale-95"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>نصب فوری با یک کلیک</span>
            </button>
          </div>
        </div>
      </div>
      {renderGuideModal()}
    </>
  );
};
