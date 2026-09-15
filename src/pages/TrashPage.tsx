import React, { useState } from 'react';
import { TrashItem } from '../types';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  Users,
  SendHorizontal,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { formatToPersianDate, formatAmount } from '../utils/formatters';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

interface TrashPageProps {
  trashItems: TrashItem[];
  onRestoreItem: (item: TrashItem) => Promise<void>;
  onPermanentDelete: (item: TrashItem) => Promise<void>;
  onEmptyTrash: () => Promise<void>;
}

export const TrashPage: React.FC<TrashPageProps> = ({
  trashItems,
  onRestoreItem,
  onPermanentDelete,
  onEmptyTrash,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'customer' | 'transaction' | 'hawala'>('all');
  const [itemToDelete, setItemToDelete] = useState<TrashItem | null>(null);
  const [isEmptyConfirmOpen, setIsEmptyConfirmOpen] = useState(false);

  const filteredItems = trashItems.filter((i) => {
    if (activeTab === 'all') return true;
    return i.itemType === activeTab;
  });

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-500" />
            <span>سطل زباله و بازیابی اسناد حذف شده</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            جهت جلوگیری از حذف تصادفی، اقلام ابتدا به سطل زباله منتقل شده و در هر زمان قابل بازگردانی هستند
          </p>
        </div>

        {trashItems.length > 0 && (
          <button
            onClick={() => setIsEmptyConfirmOpen(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>تخلیه کامل سطل زباله</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
        {[
          { id: 'all', label: `همه موارد (${trashItems.length})` },
          {
            id: 'transaction',
            label: `تراکنش‌ها (${trashItems.filter((i) => i.itemType === 'transaction').length})`,
          },
          {
            id: 'hawala',
            label: `حواله‌ها (${trashItems.filter((i) => i.itemType === 'hawala').length})`,
          },
          {
            id: 'customer',
            label: `مشتریان (${trashItems.filter((i) => i.itemType === 'customer').length})`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Trash items table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4 font-bold">نوع سند</th>
                <th className="py-3 px-4 font-bold">عنوان / کد</th>
                <th className="py-3 px-4 font-bold">جزئیات و مبلغ</th>
                <th className="py-3 px-4 font-bold">زمان انتقال به زباله</th>
                <th className="py-3 px-4 font-bold text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.map((item) => {
                let icon = <FileText className="w-4 h-4 text-slate-400" />;
                let typeLabel = 'سند';
                let title = item.originalId;
                let details = '';

                if (item.itemType === 'transaction') {
                  icon = <FileText className="w-4 h-4 text-amber-500" />;
                  typeLabel = 'تراکنش روزنامچه';
                  title = item.data.customerName || item.originalId;
                  details = `${item.data.type === 'debit' ? 'طلب' : 'گرفت'} - ${formatAmount(item.data.amount)} ${item.data.currency}`;
                } else if (item.itemType === 'hawala') {
                  icon = <SendHorizontal className="w-4 h-4 text-sky-500" />;
                  typeLabel = 'حواله ارزی';
                  title = `${item.data.hawalaNumber} (${item.data.senderName} به ${item.data.receiverName})`;
                  details = `${formatAmount(item.data.amount)} ${item.data.currency} به مقصد ${item.data.destinationCity}`;
                } else if (item.itemType === 'customer') {
                  icon = <Users className="w-4 h-4 text-emerald-500" />;
                  typeLabel = 'حساب مشتری';
                  title = item.data.name;
                  details = `تلفن: ${item.data.phone || '-'} | بیلانس: ${formatAmount(item.data.balance)}`;
                }

                return (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        {icon}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {typeLabel}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {title}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-medium">
                      {details}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {formatToPersianDate(item.deletedAt)}
                    </td>

                    <td className="py-3.5 px-4 text-left">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onRestoreItem(item)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>بازیابی</span>
                        </button>

                        <button
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                          title="حذف دائمی"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-slate-400">
                    سطل زباله خالی است. موردی یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Item Confirm */}
      <ConfirmDialog
        isOpen={itemToDelete !== null}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) {
            onPermanentDelete(itemToDelete);
            setItemToDelete(null);
          }
        }}
        title="حذف قطعی و غیرقابل بازگشت"
        message="آیا از حذف دائمی این مورد اطمینان کامل دارید؟ این عملیات به هیچ وجه قابل بازیابی نخواهد بود."
        confirmLabel="حذف دائمی"
        cancelLabel="انصراف"
      />

      {/* Empty Trash Confirm */}
      <ConfirmDialog
        isOpen={isEmptyConfirmOpen}
        onClose={() => setIsEmptyConfirmOpen(false)}
        onConfirm={() => {
          onEmptyTrash();
          setIsEmptyConfirmOpen(false);
        }}
        title="تخلیه کامل سطل زباله"
        message="آیا از پاکسازی کامل سطل زباله اطمینان دارید؟ تمامی اسناد موجود در سطل زباله برای همیشه حذف خواهند شد."
        confirmLabel="تخلیه همه موارد"
        cancelLabel="انصراف"
      />
    </div>
  );
};
