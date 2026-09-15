import React, { useState } from 'react';
import { Lock, User, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMessage('لطفاً نام کاربری و رمز عبور را وارد نمایید.');
      return;
    }

    setIsLoading(true);

    // Authentication rule requested by user:
    // Username: sadat
    // Password: 846667424
    setTimeout(() => {
      if (cleanUser.toLowerCase() === 'sadat' && cleanPass === '846667424') {
        try {
          sessionStorage.setItem('sts_auth_token', 'true');
          sessionStorage.setItem('sts_auth_user', 'sadat');
          localStorage.setItem('sts_auth_remember', 'true');
        } catch {
          // Ignored if storage restricted
        }
        setIsLoading(false);
        onLoginSuccess();
      } else {
        setIsLoading(false);
        setErrorMessage('نام کاربری یا رمز عبور اشتباه است.');
      }
    }, 250);
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 text-right selection:bg-emerald-500 selection:text-white"
      dir="rtl"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/20 relative overflow-hidden">
        {/* Top subtle decorative gradient */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

        {/* Branding header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-2xl shadow-cyan-500/25 mb-4 border-2 border-cyan-400/40 bg-slate-950 flex items-center justify-center p-1">
            <img
              src="/sts-logo.jpg"
              alt="STS سادات"
              className="w-full h-full object-contain rounded-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            سامانه مالی STS سادات
          </h1>
          <p className="text-xs text-slate-400 mt-1.5">
            ورود به سیستم مدیریت مالی، روزنامچه و حواله‌جات
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-[11px] font-bold text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>پایگاه داده محلی و کاملاً آفلاین</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-shake">
            <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              نام کاربری (User)
            </label>
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-slate-400 absolute right-3.5 pointer-events-none" />
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="sadat"
                className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono text-left"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-300">
                رمز عبور (Password)
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                {showPassword ? 'مخفی کردن' : 'نمایش'}
              </button>
            </div>
            <div className="relative flex items-center">
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="•••••••••"
                className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono text-left"
                dir="ltr"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-bold shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span>در حال بررسی...</span>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>ورود به برنامه</span>
                <ArrowRight className="w-4 h-4 mr-1" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-5 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            اطلاعات ثبت‌شده به‌صورت دائم و امن در حافظه سیستم شما باقی می‌ماند و بدون حذف توسط شما پاک نخواهد شد.
          </p>
        </div>
      </div>
    </div>
  );
};
