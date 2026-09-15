import React, { useState, useMemo } from 'react';
import { AuditLog } from '../types';
import {
  History,
  Search,
  Filter,
  Trash2,
  Calendar,
  FileText,
  Users,
  SendHorizontal,
  Database,
  Sliders,
} from 'lucide-react';
import { formatToPersianDate } from '../utils/formatters';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

interface AuditLogPageProps {
  logs: AuditLog[];
  onClearLogs: () => Promise<void>;
}

export const AuditLogPage: React.FC<AuditLogPageProps> = ({ logs, onClearLogs }) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const filteredLogs = useMemo(() => {
    let result = logs;
    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.recordId?.toLowerCase().includes(q)
      );
    }
    if (filterType !== 'all') {
      result = result.filter((l) => l.actionType === filterType);
    }
    return result;
  }, [logs, search, filterType]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'customer':
        return <Users className="w-4 h-4 text-emerald-500" />;
      case 'transaction':
        return <FileText className="w-4 h-4 text-amber-500" />;
      case 'hawala':
        return <SendHorizontal className="w-4 h-4 text-sky-500" />;
      case 'backup':
      case 'restore':
        return <Database className="w-4 h-4 text-purple-500" />;
      default:
        return <Sliders className="w-4 h-4 text-slate-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'customer':
        return 'مشتری';
      case 'transaction':
        return 'روزنامچه';
      case 'hawala':
        return 'حواله';
      case 'backup':
        return 'پشتیبان';
      case 'restore':
        return 'بازیابی';
      default:
        return 'تنظیمات';
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            <span>تاریخچه و لاگ فعالیت‌های سیستم (Audit Log)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            ثبت خودکار تمامی تغییرات، افزودن‌ها، ویرایش‌ها و حذف‌های انجام شده جهت امنیت و پیگیری
          </p>
        </div>

        {logs.length > 0 && (
          <button
            onClick={() => setIsClearConfirmOpen(true)}
            className="px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>پاکسازی لاگ‌ها</span>
          </button>
        )}
      </div>

      {/* Filter strip */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="جستجو در شرح عملیات و شناسه‌ها..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-3 pr-9 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
          >
            <option value="all">همه دسته‌بندی‌ها</option>
            <option value="transaction">روزنامچه</option>
            <option value="hawala">حواله</option>
            <option value="customer">مشتریان</option>
            <option value="backup">پشتیبان‌گیری</option>
            <option value="settings">تنظیمات</option>
          </select>

          <span className="text-xs text-slate-400 font-medium">
            تعداد: {filteredLogs.length}
          </span>
        </div>
      </div>

      {/* Log list */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4 font-bold">بخش</th>
                <th className="py-3 px-4 font-bold">عنوان رویداد</th>
                <th className="py-3 px-4 font-bold">شرح عملیات</th>
                <th className="py-3 px-4 font-bold">شناسه سند</th>
                <th className="py-3 px-4 font-bold">زمان وقوع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {getTypeIcon(log.actionType)}
                      <span>{getTypeLabel(log.actionType)}</span>
                    </span>
                  </td>

                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {log.action}
                  </td>

                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-md">
                    {log.description}
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                    {log.recordId || '-'}
                  </td>

                  <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                    {formatToPersianDate(log.timestamp)}
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-slate-400">
                    هیچ لاگ یا فعالیتی یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clear Dialog */}
      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={async () => {
          await onClearLogs();
          setIsClearConfirmOpen(false);
        }}
        title="پاکسازی تاریخچه فعالیت‌ها"
        message="آیا مطمئن هستید که می‌خواهید تاریخچه وقایع و لاگ‌ها را پاک کنید؟"
        confirmLabel="پاکسازی لاگ‌ها"
        cancelLabel="انصراف"
      />
    </div>
  );
};
