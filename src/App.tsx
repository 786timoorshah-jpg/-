import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Customer,
  JournalTransaction,
  Hawala,
  HawalaStatus,
  AppSettings,
  TrashItem,
  AuditLog,
  ActiveTab,
} from './types';
import { LocalDatabase } from './database/db';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Toast, ToastNotification } from './components/common/Toast';
import { PrintVoucher } from './components/common/PrintVoucher';
import { Maximize2 } from 'lucide-react';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { JournalPage } from './pages/JournalPage';
import { HawalaPage } from './pages/HawalaPage';
import { CustomersPage } from './pages/CustomersPage';
import { ReportsPage } from './pages/ReportsPage';
import { TrashPage } from './pages/TrashPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { SettingsPage } from './pages/SettingsPage';
import { exportFullBackupJSON } from './utils/exportImport';

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return (
        sessionStorage.getItem('sts_auth_token') === 'true' ||
        localStorage.getItem('sts_auth_remember') === 'true'
      );
    } catch {
      return false;
    }
  });

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem('sts_auth_token');
      sessionStorage.removeItem('sts_auth_user');
      localStorage.removeItem('sts_auth_remember');
    } catch {
      // Ignored
    }
    setIsAuthenticated(false);
  };

  // State
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<JournalTransaction[]>([]);
  const [hawalas, setHawalas] = useState<Hawala[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<AppSettings>(LocalDatabase.getDefaultSettings());
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDashboardDetached, setIsDashboardDetached] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sts_dashboard_detached') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleDetachDashboard = () => {
    setIsDashboardDetached((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sts_dashboard_detached', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Quick modals triggers
  const [triggerNewTransactionCustomer, setTriggerNewTransactionCustomer] = useState<string | null>(null);
  const [openTxModalTrigger, setOpenTxModalTrigger] = useState<number>(0);
  const [triggerOpenNewHawalaModal, setTriggerOpenNewHawalaModal] = useState(false);

  const handleTriggerOpenNewTransaction = (customerId?: string) => {
    setActiveTab('journal');
    setTriggerNewTransactionCustomer(customerId || null);
    setOpenTxModalTrigger((prev) => prev + 1);
  };

  // Printable Voucher State
  const [printData, setPrintData] = useState<{
    type: 'hawala' | 'customer_statement';
    hawala?: Hawala;
    customer?: Customer;
    statementTransactions?: JournalTransaction[];
  } | null>(null);

  // Add Toast helper
  const addToast = useCallback((message: string, type: ToastNotification['type'] = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Load all data from LocalDatabase
  const loadAllData = useCallback(async () => {
    try {
      const [allCusts, allTxs, allHaws, allTrash, allLogs, savedSettings] = await Promise.all([
        LocalDatabase.getCustomers(),
        LocalDatabase.getTransactions(),
        LocalDatabase.getHawalas(),
        LocalDatabase.getTrashItems(),
        LocalDatabase.getAuditLogs(),
        LocalDatabase.getSettings(),
      ]);

      setCustomers(allCusts);
      setTransactions(allTxs);
      setHawalas(allHaws);
      setTrashItems(allTrash);
      setAuditLogs(allLogs);
      setSettings(savedSettings);

      const savedTheme = (localStorage.getItem('sts_theme') as any) || savedSettings.theme || 'light';
      setTheme(savedTheme);
      applyThemeToDOM(savedTheme);
    } catch (err) {
      console.error('Error loading data:', err);
      addToast('خطا در بارگذاری اولیه پایگاه داده', 'error');
    } finally {
      setIsInitializing(false);
    }
  }, [addToast]);

  // Initial load on mount
  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsInitializing(false);
      }
    }, 1500);

    LocalDatabase.init()
      .then(async () => {
        if (isMounted) return loadAllData();
      })
      .catch((err) => {
        console.error('Database initialization error:', err);
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        if (isMounted) setIsInitializing(false);
      });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [loadAllData]);

  // Apply theme to DOM
  const applyThemeToDOM = (t: 'light' | 'dark' | 'system') => {
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleToggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('sts_theme', newTheme);
    applyThemeToDOM(newTheme);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleTriggerOpenNewTransaction();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setActiveTab('hawala');
        setTriggerOpenNewHawalaModal(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleQuickBackup();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) searchInput.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [customers]);

  // Handlers for Transactions
  const handleSaveTransaction = async (tx: JournalTransaction) => {
    try {
      await LocalDatabase.saveTransaction(tx);
      await loadAllData();
      addToast(`تراکنش ${tx.type === 'debit' ? 'طلب' : 'گرفت'} با موفقیت ذخیره شد.`, 'success');
    } catch (err) {
      console.error(err);
      addToast('خطا در ذخیره تراکنش روزنامچه.', 'error');
    }
  };

  const handleDeleteTransaction = async (id: string, permanent: boolean = true) => {
    try {
      if (permanent) {
        await LocalDatabase.permanentDeleteTransaction(id);
        await loadAllData();
        addToast('تراکنش به صورت قطعی و دائمی حذف شد و هرگز بر نخواهد گشت.', 'success');
      } else {
        await LocalDatabase.softDeleteTransaction(id);
        await loadAllData();
        addToast('تراکنش به سطل زباله منتقل گردید و بیلانس مشتری به‌روز شد.', 'info');
      }
    } catch (err) {
      console.error(err);
      addToast('خطا در حذف تراکنش.', 'error');
    }
  };

  const handleClearAllTransactions = async () => {
    try {
      await LocalDatabase.clearAllTransactions();
      await loadAllData();
      addToast('تمام تراکنش‌های ثبت‌شده روزنامچه با موفقیت خالی شدند و بیلانس حساب‌ها صفر گردید.', 'success');
    } catch (err) {
      console.error(err);
      addToast('خطا در پاکسازی تراکنش‌ها.', 'error');
    }
  };

  // Handlers for Hawala
  const handleSaveHawala = async (hawala: Hawala) => {
    try {
      await LocalDatabase.saveHawala(hawala);
      await loadAllData();
      addToast(`حواله شماره ${hawala.hawalaNumber} با موفقیت ثبت شد.`, 'success');
    } catch (err) {
      console.error(err);
      addToast('خطا در ثبت حواله.', 'error');
    }
  };

  const handleDeleteHawala = async (id: string, permanent: boolean = true) => {
    try {
      if (permanent) {
        await LocalDatabase.permanentDeleteHawala(id);
        await loadAllData();
        addToast('حواله به صورت قطعی و دائمی حذف شد و هرگز باز نخواهد گشت.', 'success');
      } else {
        await LocalDatabase.softDeleteHawala(id);
        await loadAllData();
        addToast('حواله به سطل زباله منتقل شد.', 'info');
      }
    } catch (err) {
      console.error(err);
      addToast('خطا در حذف حواله.', 'error');
    }
  };

  const handleClearAllHawalas = async () => {
    try {
      await LocalDatabase.clearAllHawalas();
      await loadAllData();
      addToast('تمام حواله‌های ثبت‌شده با موفقیت پاکسازی شدند.', 'success');
    } catch (err) {
      console.error(err);
      addToast('خطا در پاکسازی حواله‌ها.', 'error');
    }
  };

  const handleUpdateHawalaStatus = async (id: string, status: HawalaStatus) => {
    try {
      const h = hawalas.find((item) => item.id === id);
      if (h) {
        await LocalDatabase.saveHawala({ ...h, status, updatedAt: new Date().toISOString() });
        await loadAllData();
        const statusLabel = status === 'completed' ? 'اجرا شده / پرداخت شده' : status === 'cancelled' ? 'لغو شده' : 'در حال انتظار';
        addToast(`وضعیت حواله به «${statusLabel}» تغییر یافت.`, 'success');
      }
    } catch (err) {
      console.error(err);
      addToast('خطا در تغییر وضعیت حواله.', 'error');
    }
  };

  // Handlers for Customer
  const handleSaveCustomer = async (cust: Customer) => {
    try {
      await LocalDatabase.saveCustomer(cust);
      await loadAllData();
      addToast(`حساب مشتری «${cust.name}» با موفقیت ذخیره شد.`, 'success');
    } catch (err) {
      console.error(err);
      addToast('خطا در ذخیره مشتری.', 'error');
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      await LocalDatabase.softDeleteCustomer(id);
      await loadAllData();
      addToast('حساب مشتری به سطل زباله منتقل شد.', 'info');
    } catch (err) {
      console.error(err);
      addToast('خطا در حذف مشتری.', 'error');
    }
  };

  // Handlers for Trash
  const handleRestoreTrashItem = async (item: TrashItem) => {
    try {
      await LocalDatabase.restoreTrashItem(item.id);
      await loadAllData();
      addToast('سند با موفقیت از سطل زباله بازیابی گردید.', 'success');
    } catch (err) {
      console.error(err);
      addToast('خطا در بازیابی از سطل زباله.', 'error');
    }
  };

  const handlePermanentDeleteTrashItem = async (item: TrashItem) => {
    try {
      await LocalDatabase.permanentlyDeleteTrashItem(item.id);
      await loadAllData();
      addToast('مورد با موفقیت به صورت دائمی حذف شد.', 'info');
    } catch (err) {
      console.error(err);
      addToast('خطا در حذف دائمی.', 'error');
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await LocalDatabase.emptyTrash();
      await loadAllData();
      addToast('سطل زباله به طور کامل تخلیه گردید.', 'success');
    } catch (err) {
      console.error(err);
      addToast('خطا در تخلیه سطل زباله.', 'error');
    }
  };

  // Handlers for Audit Logs
  const handleClearAuditLogs = async () => {
    try {
      await LocalDatabase.clearAuditLogs();
      await loadAllData();
      addToast('تاریخچه فعالیت‌ها پاکسازی شد.', 'info');
    } catch (err) {
      console.error(err);
      addToast('خطا در پاکسازی لاگ‌ها.', 'error');
    }
  };

  // Handlers for Settings & Database Management
  const handleSaveSettings = async (newSettings: AppSettings) => {
    try {
      await LocalDatabase.saveSettings(newSettings);
      setSettings(newSettings);
      addToast('تنظیمات سیستم ذخیره گردید.', 'success');
    } catch (err) {
      console.error(err);
      addToast('خطا در ذخیره تنظیمات.', 'error');
    }
  };

  const handleQuickBackup = async () => {
    try {
      const backup = await LocalDatabase.exportFullBackup();
      exportFullBackupJSON(backup);
      addToast('نسخه پشتیبان کامل با موفقیت دانلود شد.', 'success');
    } catch (err) {
      console.error(err);
      addToast('خطا در تهیه نسخه پشتیبان.', 'error');
    }
  };

  const handleImportBackup = async (jsonString: string): Promise<boolean> => {
    try {
      const success = await LocalDatabase.importFullBackup(jsonString);
      if (success) {
        await loadAllData();
        addToast('پایگاه داده از روی فایل پشتیبان با موفقیت بازیابی شد.', 'success');
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      addToast('فایل پشتیبان معتبر نیست.', 'error');
      return false;
    }
  };

  const handleClearDatabase = async () => {
    try {
      await LocalDatabase.clearEntireDatabase();
      await loadAllData();
      addToast('پایگاه داده بازنشانی شد.', 'info');
    } catch (err) {
      console.error(err);
      addToast('خطا در پاکسازی پایگاه داده.', 'error');
    }
  };

  const handleHealthCheck = async () => {
    try {
      const result = await LocalDatabase.healthCheckAndRepair();
      await loadAllData();
      return result;
    } catch (err) {
      console.error(err);
      return { healthy: false, repaired: false, message: 'خطا در فرآیند عیب‌یابی' };
    }
  };

  // Print Handlers
  const handlePrintHawala = (hawala: Hawala) => {
    setPrintData({ type: 'hawala', hawala });
  };

  const handlePrintCustomerStatement = (customer: Customer, customerTxs: JournalTransaction[]) => {
    setPrintData({
      type: 'customer_statement',
      customer,
      statementTransactions: customerTxs,
    });
  };

  // Counts for Badges
  const pendingHawalasCount = useMemo(() => {
    return hawalas.filter((h) => h.status === 'pending').length;
  }, [hawalas]);

  const trashCount = useMemo(() => {
    return trashItems.length;
  }, [trashItems]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-xl mb-4 shadow-lg shadow-emerald-500/30 animate-pulse">
          STS
        </div>
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
          سامانه صرافی و خدمات مالی STS سادات
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          در حال راه‌اندازی پایگاه داده محلی و آفلاین...
        </p>
      </div>
    );
  }

  // Show login screen if not logged in
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="h-screen w-screen max-h-screen overflow-hidden flex flex-col bg-emerald-950 text-emerald-50 font-sans transition-colors duration-150 selection:bg-emerald-500 selection:text-slate-950">
      {/* Printable Voucher Section (renders only in print or preview) */}
      {printData && (
        <PrintVoucher
          type={printData.type}
          hawala={printData.hawala}
          customer={printData.customer}
          statementTransactions={printData.statementTransactions}
          settings={settings}
          onClose={() => setPrintData(null)}
        />
      )}

      {/* Header (Fixed at top) */}
      <Header
        onOpenNewTransaction={() => handleTriggerOpenNewTransaction()}
        onOpenNewHawala={() => {
          setActiveTab('hawala');
          setTriggerOpenNewHawalaModal(true);
        }}
        onQuickBackup={handleQuickBackup}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogout}
      />

      {/* Main Layout: Separated Right Sidebar & Left Page Screen (Both scroll independently) */}
      <div className="flex-1 min-h-0 flex overflow-hidden bg-slate-950 p-0 sm:p-2.5 gap-0 sm:gap-2.5">
        {/* Sidebar (مینوی اصلی سمت راست - اسکرول و رول جداگانه) */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          pendingHawalasCount={pendingHawalasCount}
          trashCount={trashCount}
          isDashboardDetached={isDashboardDetached}
          onLogout={handleLogout}
        />

        {/* Vertical Separation Divider between Right Panel and Left Screen */}
        <div className="hidden md:block w-px bg-gradient-to-b from-emerald-400/40 via-emerald-600/30 to-emerald-900/10 shadow-[0_0_12px_rgba(16,185,129,0.3)] shrink-0 self-stretch my-1" />

        {/* Dynamic Content View (صفحه سمت چپ - اسکرول و رول کاملاً جداگانه) */}
        <main
          className={`flex-1 min-h-0 h-full rounded-none sm:rounded-2xl lg:rounded-3xl border sm:border border-emerald-700/50 shadow-2xl bg-gradient-to-b from-emerald-950 via-emerald-950 to-emerald-900/90 transition-all flex flex-col ${
            activeTab === 'dashboard'
              ? 'p-0 w-full overflow-hidden'
              : 'overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar scroll-smooth'
          }`}
        >
          <div className={activeTab === 'dashboard' ? 'flex-1 h-full w-full min-h-0 overflow-hidden' : 'max-w-7xl mx-auto w-full'}>
            {activeTab === 'dashboard' && !isDashboardDetached && (
              <DashboardPage
                customers={customers}
                transactions={transactions}
                hawalas={hawalas}
                settings={settings}
                searchQuery={searchQuery}
                onNavigate={setActiveTab}
                onSelectTab={setActiveTab}
                onOpenNewTransaction={(cust: any) => {
                  handleTriggerOpenNewTransaction(typeof cust === 'string' ? cust : cust?.id);
                }}
                onOpenNewHawala={() => {
                  setActiveTab('hawala');
                  setTriggerOpenNewHawalaModal(true);
                }}
                onPrintHawala={handlePrintHawala}
                onUpdateHawalaStatus={handleUpdateHawalaStatus}
                onDeleteTransaction={handleDeleteTransaction}
                isDetached={false}
                onToggleDetach={handleToggleDetachDashboard}
                theme={theme}
                onToggleTheme={handleToggleTheme}
              />
            )}

            {activeTab === 'dashboard' && isDashboardDetached && (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-emerald-300 dark:border-emerald-800 shadow-sm h-full">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 shadow-inner">
                  <Maximize2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black text-slate-800 dark:text-white">داشبورد از ساختار صفحه جدا شده است</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  داشبورد مالی در پنجره تمام‌صفحه و مستقل با بگروند سبز زمردی در حال نمایش است.
                </p>
                <button
                  onClick={handleToggleDetachDashboard}
                  className="mt-4 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer hover:opacity-90 transition-opacity"
                >
                  اتصال مجدد به صفحه اصلی
                </button>
              </div>
            )}

            {activeTab === 'journal' && (
              <JournalPage
                transactions={transactions}
                customers={customers}
                settings={settings}
                searchQuery={searchQuery}
                onSaveTransaction={handleSaveTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onClearAllTransactions={handleClearAllTransactions}
                onSaveCustomer={handleSaveCustomer}
                initialNewTxCustomerId={triggerNewTransactionCustomer}
                openTxTrigger={openTxModalTrigger}
                onClearInitialCustomerId={() => setTriggerNewTransactionCustomer(null)}
              />
            )}

            {activeTab === 'hawala' && (
              <HawalaPage
                hawalas={hawalas}
                settings={settings}
                searchQuery={searchQuery}
                onSaveHawala={handleSaveHawala}
                onDeleteHawala={handleDeleteHawala}
                onClearAllHawalas={handleClearAllHawalas}
                onPrintHawala={handlePrintHawala}
                onUpdateStatus={handleUpdateHawalaStatus}
                getNextHawalaNumber={LocalDatabase.getNextHawalaNumber}
                initialOpenNewModal={triggerOpenNewHawalaModal}
                onClearInitialOpenModal={() => setTriggerOpenNewHawalaModal(false)}
              />
            )}

            {activeTab === 'customers' && (
              <CustomersPage
                customers={customers}
                transactions={transactions}
                settings={settings}
                searchQuery={searchQuery}
                onSaveCustomer={handleSaveCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                onPrintCustomerStatement={handlePrintCustomerStatement}
                onOpenNewTransactionForCustomer={(custId) => {
                  setActiveTab('journal');
                  setTriggerNewTransactionCustomer(custId);
                }}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsPage
                customers={customers}
                transactions={transactions}
                hawalas={hawalas}
                settings={settings}
              />
            )}

            {activeTab === 'recycle_bin' && (
              <TrashPage
                trashItems={trashItems}
                onRestoreItem={handleRestoreTrashItem}
                onPermanentDelete={handlePermanentDeleteTrashItem}
                onEmptyTrash={handleEmptyTrash}
              />
            )}

            {activeTab === 'audit_log' && (
              <AuditLogPage
                logs={auditLogs}
                onClearLogs={handleClearAuditLogs}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPage
                settings={settings}
                onSaveSettings={handleSaveSettings}
                onExportBackup={handleQuickBackup}
                onImportBackup={handleImportBackup}
                onClearDatabase={handleClearDatabase}
                onClearAllTransactions={handleClearAllTransactions}
                onHealthCheck={handleHealthCheck}
              />
            )}
          </div>
        </main>
      </div>

      {/* Floating Toast Notification Container */}
      <Toast toasts={toasts} onClose={removeToast} />

      {/* Detached Fullscreen Dashboard View (Separated from the Page) */}
      {isDashboardDetached && activeTab === 'dashboard' && (
        <div className="fixed inset-0 z-40 bg-slate-950/85 backdrop-blur-md flex flex-col p-2 sm:p-4 overflow-hidden">
          <DashboardPage
            customers={customers}
            transactions={transactions}
            hawalas={hawalas}
            settings={settings}
            searchQuery={searchQuery}
            onNavigate={setActiveTab}
            onSelectTab={setActiveTab}
            onOpenNewTransaction={(cust: any) => {
              handleTriggerOpenNewTransaction(typeof cust === 'string' ? cust : cust?.id);
            }}
            onOpenNewHawala={() => {
              setActiveTab('hawala');
              setTriggerOpenNewHawalaModal(true);
            }}
            onPrintHawala={handlePrintHawala}
            onUpdateHawalaStatus={handleUpdateHawalaStatus}
            isDetached={true}
            onToggleDetach={handleToggleDetachDashboard}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        </div>
      )}
    </div>
  );
}
