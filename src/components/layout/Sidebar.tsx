import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  SendHorizontal,
  Users,
  BarChart3,
  Trash2,
  History,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { ActiveTab } from '../../types';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  pendingHawalasCount: number;
  trashCount: number;
  isDashboardDetached?: boolean;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  pendingHawalasCount,
  trashCount,
  isDashboardDetached = false,
  onLogout,
}) => {
  const menuItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'داشبورد مالی',
      desc: 'نمای کلی، تراز و تراکنش‌ها',
      icon: LayoutDashboard,
      badge: isDashboardDetached ? 'جدا شده' : null,
      badgeColor: 'bg-purple-600 text-white',
    },
    {
      id: 'journal' as ActiveTab,
      label: 'روزنامچه (طلب و گرفت)',
      icon: BookOpen,
      shortcut: 'Ctrl+N',
      badge: null,
    },
    {
      id: 'hawala' as ActiveTab,
      label: 'حواله صرافی',
      icon: SendHorizontal,
      shortcut: 'Ctrl+H',
      badge: pendingHawalasCount > 0 ? pendingHawalasCount : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'customers' as ActiveTab,
      label: 'حساب‌های مشتریان',
      icon: Users,
      badge: null,
    },
    {
      id: 'reports' as ActiveTab,
      label: 'گزارش‌های جامع مالی',
      icon: BarChart3,
      shortcut: 'Ctrl+P',
      badge: null,
    },
    {
      id: 'recycle_bin' as ActiveTab,
      label: 'سطل زباله',
      icon: Trash2,
      badge: trashCount > 0 ? trashCount : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'audit_log' as ActiveTab,
      label: 'تاریخچه فعالیت‌ها',
      icon: History,
      badge: null,
    },
    {
      id: 'settings' as ActiveTab,
      label: 'تنظیمات و پیکربندی',
      desc: 'واحدهای پولی، پیام‌ها و بکاپ',
      icon: Settings,
      shortcut: 'Ctrl+B',
      badge: null,
    },
  ];

  return (
    <aside className="w-72 md:w-80 bg-emerald-950/95 border-l-2 border-emerald-500/40 shadow-[-12px_0_30px_rgba(0,0,0,0.45)] text-emerald-100 flex flex-col shrink-0 no-print select-none transition-all relative z-20 h-full min-h-0 overflow-hidden">
      {/* Main Menu Items - Fully Independent Scroll Container */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-3.5 space-y-2 custom-scrollbar scroll-smooth">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isHighlight = item.id === 'dashboard' || item.id === 'settings';
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-500/30 scale-[1.01]'
                  : isHighlight
                  ? 'text-white bg-emerald-900/40 hover:bg-emerald-900/80 hover:text-white border border-emerald-700/40'
                  : 'text-emerald-200/90 hover:bg-emerald-900/50 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-slate-950/15 text-slate-950'
                      : isHighlight
                      ? 'bg-emerald-800/60 text-emerald-300'
                      : 'bg-emerald-900/50 text-emerald-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <div className="text-[14px] leading-tight">{item.label}</div>
                  {'desc' in item && item.desc && (
                    <div
                      className={`text-[11px] font-normal mt-0.5 ${
                        isActive ? 'text-slate-900/80' : 'text-emerald-400/70'
                      }`}
                    >
                      {item.desc}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {item.badge !== null && (
                  <span
                    className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                      item.badgeColor || (isActive ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-800 text-emerald-100 border border-emerald-600/50')
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {item.shortcut && (
                  <span
                    className={`hidden xl:inline text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isActive ? 'text-slate-950/80 bg-slate-950/10' : 'text-emerald-400/80 bg-emerald-900/60 border border-emerald-800'
                    }`}
                  >
                    {item.shortcut}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
