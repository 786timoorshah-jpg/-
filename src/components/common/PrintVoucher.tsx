import React from 'react';
import { Hawala, Customer, JournalTransaction } from '../../types';
import { formatAmount, formatToPersianDate } from '../../utils/formatters';
import { Printer, X } from 'lucide-react';

interface PrintHawalaReceiptProps {
  hawala: Hawala;
  onClose: () => void;
}

export const PrintHawalaReceipt: React.FC<PrintHawalaReceiptProps> = ({ hawala, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const statusLabel = 
    hawala.status === 'completed' ? 'پرداخت شده / تکمیل' : 
    hawala.status === 'cancelled' ? 'باطل / لغو شده' : 'در حال انتظار';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs print-modal-overlay">
      <div className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 print-modal-content" dir="rtl">
        {/* Controls bar (hidden during print) */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 no-print">
          <span className="font-bold text-slate-700">پیش‌نمایش رسید حواله صرافی</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              چاپ رسید (Print)
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* The Actual Printable Receipt Voucher */}
        <div className="border-2 border-slate-800 p-6 rounded-xl bg-white text-slate-900 print-break-inside-avoid">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-slate-800">
            <div className="flex items-center gap-3">
              <img
                src="/sts-logo.jpg"
                alt="STS"
                className="w-14 h-14 object-contain rounded-xl border border-slate-300 p-0.5 bg-slate-950"
                referrerPolicy="no-referrer"
              />
              <div className="text-right">
                <h1 className="text-2xl font-black tracking-wide text-slate-900">STS سادات</h1>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">خدمات پولی، صرافی و نمایندگی رسمی حساب پی</p>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 text-center">
              رسید معتبر ارسال و دریافت حواله
            </div>
          </div>

          {/* Quick info row */}
          <div className="grid grid-cols-2 gap-4 py-3 border-b border-dashed border-slate-300 text-sm">
            <div>
              <span className="text-slate-500 font-medium">شماره حواله: </span>
              <span className="font-mono font-bold text-base text-slate-900">{hawala.hawalaNumber}</span>
            </div>
            <div className="text-left" dir="ltr">
              <span className="text-slate-500 font-medium">کد پیگیری: </span>
              <span className="font-mono font-bold text-slate-900">{hawala.hawalaCode}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">تاریخ صدور: </span>
              <span className="font-bold">{formatToPersianDate(hawala.date)}</span>
            </div>
            <div className="text-left" dir="ltr">
              <span className="text-slate-500 font-medium">وضعیت: </span>
              <span className="font-bold">{statusLabel}</span>
            </div>
          </div>

          {/* Parties Details */}
          <div className="grid grid-cols-2 gap-4 py-4 border-b border-slate-300">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-xs font-bold text-emerald-800 mb-1 border-b border-emerald-200 pb-1">مشخصات فرستنده</div>
              <div className="text-sm font-bold text-slate-900">{hawala.senderName}</div>
              <div className="text-xs text-slate-600 mt-1" dir="ltr">تلفن: {hawala.senderPhone}</div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-xs font-bold text-sky-800 mb-1 border-b border-sky-200 pb-1">مشخصات گیرنده</div>
              <div className="text-sm font-bold text-slate-900">{hawala.receiverName}</div>
              <div className="text-xs text-slate-600 mt-1" dir="ltr">تلفن: {hawala.receiverPhone}</div>
              <div className="text-xs text-slate-700 font-medium mt-1">شهر مقصد: {hawala.destinationCity}</div>
            </div>
          </div>

          {/* Amount Box */}
          <div className="my-4 p-4 bg-emerald-50 rounded-xl border border-emerald-300 text-center">
            <div className="text-xs font-semibold text-emerald-800">مبلغ خالص حواله</div>
            <div className="text-3xl font-black text-emerald-950 my-1 font-mono">
              {formatAmount(hawala.amount)} <span className="text-lg">{hawala.currency}</span>
            </div>
            <div className="text-xs text-slate-600 font-medium">
              کمیشن و کارمزد: <span className="font-bold font-mono">{formatAmount(hawala.commission)}</span> {hawala.currency}
            </div>
          </div>

          {hawala.description && (
            <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mb-4">
              <span className="font-bold">توضیحات: </span>
              {hawala.description}
            </div>
          )}

          {/* Signatures & Stamp */}
          <div className="grid grid-cols-3 gap-2 pt-6 text-center text-xs text-slate-600 border-t border-slate-200 mt-4">
            <div>
              <p className="font-bold mb-8">امضاء و اثر انگشت فرستنده</p>
              <div className="border-b border-dashed border-slate-400 w-24 mx-auto"></div>
            </div>
            <div>
              <p className="font-bold mb-8">مهر و امضاء صرافی STS</p>
              <div className="border-b border-dashed border-slate-400 w-24 mx-auto"></div>
            </div>
            <div>
              <p className="font-bold mb-8">امضاء دریافت‌کننده وجه</p>
              <div className="border-b border-dashed border-slate-400 w-24 mx-auto"></div>
            </div>
          </div>

          <div className="mt-4 pt-2 text-[10px] text-center text-slate-400 border-t border-slate-100">
            سیستم صرافی STS سادات - سرای شهزاده / کلیه حقوق محفوظ است - تاریخ چاپ: {new Date().toLocaleDateString('fa-AF')}
          </div>
        </div>
      </div>
    </div>
  );
};

interface PrintCustomerStatementProps {
  customer: Customer;
  transactions: JournalTransaction[];
  onClose: () => void;
}

export const PrintCustomerStatement: React.FC<PrintCustomerStatementProps> = ({
  customer,
  transactions,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const totalDebit = transactions.filter(t => t.type === 'debit').reduce((acc, t) => acc + t.amount, 0);
  const totalCredit = transactions.filter(t => t.type === 'credit').reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs print-modal-overlay">
      <div className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 print-modal-content" dir="rtl">
        {/* Controls */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 no-print">
          <span className="font-bold text-slate-700">صورتحساب مالی مشتری</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              چاپ صورتحساب (Print)
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Statement */}
        <div className="p-4 print-break-inside-avoid">
          <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900">
            <div className="flex items-center gap-3">
              <img
                src="/sts-logo.jpg"
                alt="STS"
                className="w-14 h-14 object-contain rounded-xl border border-slate-300 p-0.5 bg-slate-950"
                referrerPolicy="no-referrer"
              />
              <div className="text-right">
                <h1 className="text-2xl font-black text-slate-900">STS سادات</h1>
                <p className="text-xs font-bold text-slate-600 mt-0.5">صورتحساب تفصیلی گردش حساب مشتری</p>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-300 text-xs font-bold text-slate-800">
              صرافی و خدمات پولی سادات
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 my-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            <div>
              <span className="text-slate-500">نام مشتری: </span>
              <span className="font-bold text-slate-900">{customer.name}</span>
            </div>
            <div>
              <span className="text-slate-500">شماره تماس: </span>
              <span className="font-bold" dir="ltr">{customer.phone}</span>
            </div>
            <div>
              <span className="text-slate-500">واحد حساب: </span>
              <span className="font-bold">{customer.currency}</span>
            </div>
            <div>
              <span className="text-slate-500">تاریخ استعلام: </span>
              <span className="font-bold">{formatToPersianDate(new Date().toISOString().split('T')[0])}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500">بیلانس نهایی: </span>
              <span className={`font-mono font-bold text-base ${customer.balance > 0 ? 'text-amber-700' : customer.balance < 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                {formatAmount(Math.abs(customer.balance))} {customer.currency} ({customer.balance > 0 ? 'طلب' : customer.balance < 0 ? 'گرفت' : 'تسویه'})
              </span>
            </div>
          </div>

          {/* Transactions table */}
          <table className="w-full text-xs text-right border border-slate-300 my-4">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                <th className="p-2 border-l border-slate-300">ردیف</th>
                <th className="p-2 border-l border-slate-300">تاریخ</th>
                <th className="p-2 border-l border-slate-300">شرح / توضیح</th>
                <th className="p-2 border-l border-slate-300 text-center">طلب</th>
                <th className="p-2 text-center">گرفت</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, idx) => (
                <tr key={tx.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="p-2 border-l border-slate-200 text-center font-mono">{idx + 1}</td>
                  <td className="p-2 border-l border-slate-200">{formatToPersianDate(tx.date)}</td>
                  <td className="p-2 border-l border-slate-200">{tx.description}</td>
                  <td className="p-2 border-l border-slate-200 text-center font-mono font-bold text-amber-800">
                    {tx.type === 'debit' ? formatAmount(tx.amount) : '-'}
                  </td>
                  <td className="p-2 text-center font-mono font-bold text-emerald-800">
                    {tx.type === 'credit' ? formatAmount(tx.amount) : '-'}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400">هیچ تراکنشی ثبت نشده است.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-800">
                <td colSpan={3} className="p-2 text-left pl-4">مجموع گردش:</td>
                <td className="p-2 text-center font-mono border-l border-slate-300">{formatAmount(totalDebit)}</td>
                <td className="p-2 text-center font-mono">{formatAmount(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Footer signature */}
          <div className="flex justify-between items-center pt-8 border-t border-slate-200 mt-6 text-xs text-slate-600">
            <div>امضاء و تأیید مشتری: ............................</div>
            <div>مهر و امضاء مدیریت صرافی STS سادات: ............................</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface PrintVoucherProps {
  type: 'hawala' | 'customer_statement';
  hawala?: Hawala;
  customer?: Customer;
  statementTransactions?: JournalTransaction[];
  settings?: any;
  onClose: () => void;
}

export const PrintVoucher: React.FC<PrintVoucherProps> = ({
  type,
  hawala,
  customer,
  statementTransactions = [],
  onClose,
}) => {
  if (type === 'hawala' && hawala) {
    return <PrintHawalaReceipt hawala={hawala} onClose={onClose} />;
  }
  if (type === 'customer_statement' && customer) {
    return (
      <PrintCustomerStatement
        customer={customer}
        transactions={statementTransactions}
        onClose={onClose}
      />
    );
  }
  return null;
};

