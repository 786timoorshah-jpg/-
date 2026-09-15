import {
  Customer,
  JournalTransaction,
  Hawala,
  AuditLog,
  TrashItem,
  AppSettings,
  BackupData,
  HawalaStatus,
  TransactionType,
  CurrencyCode
} from '../types';
import { safeAdd, safeSubtract, roundToTwoDecimals, formatHawalaNumber } from '../utils/formatters';
import { DEFAULT_TEMPLATES } from '../utils/whatsapp';

const DB_NAME = 'STS_Sadat_DB';
const DB_VERSION = 2;

// IndexedDB object store names
const STORES = {
  CUSTOMERS: 'customers',
  TRANSACTIONS: 'transactions',
  HAWALAS: 'hawalas',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
  METADATA: 'metadata',
  BACKUPS: 'backups',
};

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'STS Sadat',
  companyName: 'STS سادات',
  subtitle: 'خدمات پولی و نمایندگی حساب پی',
  managerName: 'تیمورشاه سادات',
  managerPhone: '0799000000',
  defaultCurrency: 'AFN',
  supportedCurrencies: [
    { code: 'AFN', nameFa: 'افغانی', symbol: '؋', isDefault: true },
    { code: 'USD', nameFa: 'دالر امریکایی', symbol: '$' },
    { code: 'EUR', nameFa: 'یورو', symbol: '€' },
    { code: 'PKR', nameFa: 'کلدار پاکستانی', symbol: 'Rs' },
    { code: 'IRR', nameFa: 'تومان ایرانی', symbol: 'تومان' },
  ],
  templates: DEFAULT_TEMPLATES,
  theme: 'light',
  autoBackupEnabled: true,
  backupRetentionDays: 7,
  version: '1.0.0',
};

const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: 'CUST-1001',
    name: 'حاجی احمدشاه پوپلزی',
    phone: '0799123456',
    currency: 'AFN',
    balance: 0,
    notes: 'مشتری معتمد بازار کابل',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'CUST-1002',
    name: 'محمد نعیم اکبری',
    phone: '0700887766',
    currency: 'AFN',
    balance: 0,
    notes: 'حساب تجاری دکان قندهار',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'CUST-1003',
    name: 'عبدالرحمان فیضی',
    phone: '0788334455',
    currency: 'USD',
    balance: 0,
    notes: 'صرافی هرات',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'CUST-1004',
    name: 'غلام سخی حسینی',
    phone: '0777556677',
    currency: 'AFN',
    balance: 0,
    notes: 'حساب تسویه شده',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_TRANSACTIONS: JournalTransaction[] = [];
const DEFAULT_HAWALAS: Hawala[] = [];

export class LocalDatabase {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private cachedDb: IDBDatabase | null = null;
  private useFallback: boolean = false;
  private memoryStore: Record<string, any[]> = {};
  private memoryMeta: Record<string, any> = {};

  // Tombstones to prevent deleted items from ever returning due to out-of-sync caches or re-seeding
  private static readonly TOMBSTONES_PERM_TX = 'sts_tombstones_perm_tx';
  private static readonly TOMBSTONES_SOFT_TX = 'sts_tombstones_soft_tx';
  private static readonly TOMBSTONES_PERM_HW = 'sts_tombstones_perm_hw';
  private static readonly TOMBSTONES_SOFT_HW = 'sts_tombstones_soft_hw';
  private static readonly SEEDED_FLAG = 'sts_db_seeded_v2';

  constructor() {
    this.initDatabase();
  }

  // Tombstone helpers
  private getTombstones(key: string): Set<string> {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {
      // Ignored
    }
    return new Set<string>();
  }

  private saveTombstones(key: string, set: Set<string>): void {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch {
      // Ignored
    }
  }

  private addTombstone(key: string, id: string): void {
    const set = this.getTombstones(key);
    set.add(id);
    this.saveTombstones(key, set);
  }

  private removeTombstone(key: string, id: string): void {
    const set = this.getTombstones(key);
    if (set.delete(id)) {
      this.saveTombstones(key, set);
    }
  }

  private getFallbackItems<T>(storeName: string): T[] {
    try {
      const raw = localStorage.getItem(`sts_store_${storeName}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignored
    }
    return (this.memoryStore[storeName] || []) as T[];
  }

  private saveFallbackItems<T>(storeName: string, items: T[]): void {
    this.memoryStore[storeName] = items;
    try {
      localStorage.setItem(`sts_store_${storeName}`, JSON.stringify(items));
    } catch {
      // Ignored
    }
  }

  private getFallbackMeta<T = any>(key: string): T | null {
    try {
      const raw = localStorage.getItem(`sts_meta_${key}`);
      if (raw !== null) return JSON.parse(raw);
    } catch {
      // Ignored
    }
    return this.memoryMeta[key] ?? null;
  }

  private setFallbackMeta(key: string, value: any): void {
    this.memoryMeta[key] = value;
    try {
      localStorage.setItem(`sts_meta_${key}`, JSON.stringify(value));
    } catch {
      // Ignored
    }
  }

  private initLocalStorageFallback(): void {
    const isSeeded = localStorage.getItem(LocalDatabase.SEEDED_FLAG);
    if (isSeeded === 'true') {
      return;
    }
    const existing = this.getFallbackItems(STORES.CUSTOMERS);
    if (!existing || existing.length === 0) {
      this.saveFallbackItems(STORES.CUSTOMERS, DEFAULT_CUSTOMERS);
      this.saveFallbackItems(STORES.TRANSACTIONS, DEFAULT_TRANSACTIONS);
      this.saveFallbackItems(STORES.HAWALAS, DEFAULT_HAWALAS);
      this.saveFallbackItems(STORES.SETTINGS, [{ key: 'app_settings', ...DEFAULT_SETTINGS }]);
      this.setFallbackMeta('hawala_counter', 3);
      this.saveFallbackItems(STORES.AUDIT_LOGS, [
        {
          id: 'LOG-INIT',
          timestamp: new Date().toISOString(),
          actionType: 'system',
          action: 'init',
          description: 'راه‌اندازی اولیه پایگاه داده محلی',
        },
      ]);
      try {
        localStorage.setItem(LocalDatabase.SEEDED_FLAG, 'true');
      } catch {
        // Ignored
      }
    } else {
      try {
        localStorage.setItem(LocalDatabase.SEEDED_FLAG, 'true');
      } catch {
        // Ignored
      }
    }
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (this.cachedDb) return this.cachedDb;
    if (!this.dbPromise) {
      this.initDatabase();
    }
    const db = await this.dbPromise;
    if (db) this.cachedDb = db;
    return db;
  }

  private initDatabase(): void {
    // Request persistent storage so the browser never auto-cleans customer data
    try {
      if (typeof window !== 'undefined' && navigator?.storage?.persist) {
        navigator.storage.persist().then((persistent) => {
          console.log(`Persistent storage granted: ${persistent}`);
        }).catch(() => {});
      }
    } catch {
      // ignore
    }

    this.dbPromise = new Promise((resolve) => {
      // If indexedDB is not available or blocked in the execution environment
      if (typeof window === 'undefined' || !window.indexedDB) {
        this.useFallback = true;
        this.initLocalStorageFallback();
        resolve(null);
        return;
      }

      let hasResolved = false;
      const safeResolve = (val: IDBDatabase | null) => {
        if (!hasResolved) {
          hasResolved = true;
          resolve(val);
        }
      };

      // Safety timeout: Never hang on indexedDB in sandboxed iframes
      const timer = setTimeout(() => {
        if (!hasResolved) {
          console.warn('IndexedDB initialization timed out, using fallback storage');
          this.useFallback = true;
          this.initLocalStorageFallback();
          safeResolve(null);
        }
      }, 1200);

      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
            const customerStore = db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
            customerStore.createIndex('name', 'name', { unique: false });
            customerStore.createIndex('phone', 'phone', { unique: false });
            customerStore.createIndex('isDeleted', 'isDeleted', { unique: false });
          }

          if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
            const txStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
            txStore.createIndex('customerId', 'customerId', { unique: false });
            txStore.createIndex('date', 'date', { unique: false });
            txStore.createIndex('type', 'type', { unique: false });
            txStore.createIndex('isDeleted', 'isDeleted', { unique: false });
          }

          if (!db.objectStoreNames.contains(STORES.HAWALAS)) {
            const hwStore = db.createObjectStore(STORES.HAWALAS, { keyPath: 'id' });
            hwStore.createIndex('hawalaNumber', 'hawalaNumber', { unique: true });
            hwStore.createIndex('hawalaCode', 'hawalaCode', { unique: false });
            hwStore.createIndex('status', 'status', { unique: false });
            hwStore.createIndex('date', 'date', { unique: false });
            hwStore.createIndex('isDeleted', 'isDeleted', { unique: false });
          }

          if (!db.objectStoreNames.contains(STORES.AUDIT_LOGS)) {
            const logStore = db.createObjectStore(STORES.AUDIT_LOGS, { keyPath: 'id' });
            logStore.createIndex('timestamp', 'timestamp', { unique: false });
          }

          if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
            db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
          }

          if (!db.objectStoreNames.contains(STORES.METADATA)) {
            db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
          }

          if (!db.objectStoreNames.contains(STORES.BACKUPS)) {
            db.createObjectStore(STORES.BACKUPS, { keyPath: 'id' });
          }
        };

        request.onsuccess = async (event) => {
          clearTimeout(timer);
          const db = (event.target as IDBOpenDBRequest).result;
          this.cachedDb = db;
          this.useFallback = false;
          await this.seedInitialDataIfNeeded(db);
          safeResolve(db);
        };

        request.onerror = (event) => {
          clearTimeout(timer);
          console.warn('IndexedDB error, falling back:', (event.target as IDBOpenDBRequest).error);
          this.useFallback = true;
          this.initLocalStorageFallback();
          safeResolve(null);
        };

        request.onblocked = () => {
          clearTimeout(timer);
          console.warn('IndexedDB blocked, falling back to LocalStorage');
          this.useFallback = true;
          this.initLocalStorageFallback();
          safeResolve(null);
        };
      } catch (err) {
        clearTimeout(timer);
        console.warn('IndexedDB open threw exception, using fallback:', err);
        this.useFallback = true;
        this.initLocalStorageFallback();
        safeResolve(null);
      }
    });
  }

  // Seed sample initial data directly without calling getDB() to prevent deadlock
  private seedInitialDataIfNeeded(db: IDBDatabase): Promise<void> {
    return new Promise((resolve) => {
      try {
        const isSeeded = localStorage.getItem(LocalDatabase.SEEDED_FLAG);
        if (isSeeded === 'true') {
          resolve();
          return;
        }

        const checkTx = db.transaction([STORES.CUSTOMERS], 'readonly');
        const custStore = checkTx.objectStore(STORES.CUSTOMERS);
        const countReq = custStore.count();

        countReq.onsuccess = () => {
          if (countReq.result === 0) {
            try {
              const seedTx = db.transaction(
                [
                  STORES.CUSTOMERS,
                  STORES.TRANSACTIONS,
                  STORES.HAWALAS,
                  STORES.SETTINGS,
                  STORES.METADATA,
                  STORES.AUDIT_LOGS,
                ],
                'readwrite'
              );

              const cStore = seedTx.objectStore(STORES.CUSTOMERS);
              for (const c of DEFAULT_CUSTOMERS) cStore.put(c);

              const tStore = seedTx.objectStore(STORES.TRANSACTIONS);
              for (const t of DEFAULT_TRANSACTIONS) tStore.put(t);

              const hStore = seedTx.objectStore(STORES.HAWALAS);
              for (const h of DEFAULT_HAWALAS) hStore.put(h);

              const sStore = seedTx.objectStore(STORES.SETTINGS);
              sStore.put({ key: 'app_settings', ...DEFAULT_SETTINGS });

              const mStore = seedTx.objectStore(STORES.METADATA);
              mStore.put({ key: 'hawala_counter', value: 3 });

              const aStore = seedTx.objectStore(STORES.AUDIT_LOGS);
              aStore.put({
                id: 'LOG-INIT',
                timestamp: new Date().toISOString(),
                actionType: 'system',
                action: 'init',
                description: 'راه‌اندازی اولیه پایگاه داده و تنظیمات سیستم با داده‌های پیش‌فرض',
              });

              seedTx.oncomplete = () => {
                try {
                  localStorage.setItem(LocalDatabase.SEEDED_FLAG, 'true');
                } catch {
                  // Ignored
                }
                resolve();
              };
              seedTx.onerror = () => resolve();
            } catch {
              resolve();
            }
          } else {
            try {
              localStorage.setItem(LocalDatabase.SEEDED_FLAG, 'true');
            } catch {
              // Ignored
            }
            resolve();
          }
        };

        countReq.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // Generic DB helpers (dual-layer: localStorage fallback + IndexedDB with robust bidirectional offline sync)
  private async getAllItems<T>(storeName: string): Promise<T[]> {
    let idbItems: T[] = [];
    let db: IDBDatabase | null = null;

    try {
      db = this.cachedDb || (await this.getDB());
    } catch {
      db = null;
    }

    if (db) {
      try {
        idbItems = await new Promise<T[]>((resolve) => {
          const tx = db!.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const req = store.getAll();
          req.onsuccess = () => resolve((req.result || []) as T[]);
          req.onerror = () => resolve([]);
        });
      } catch {
        idbItems = [];
      }
    }

    const fallbackItems = this.getFallbackItems<T>(storeName);

    // Merge both sources so offline data in either layer is never lost
    const mergedMap = new Map<string, T>();
    for (const item of fallbackItems) {
      const k = (item as any).id || (item as any).key;
      if (k) mergedMap.set(k, item);
    }
    for (const item of idbItems) {
      const k = (item as any).id || (item as any).key;
      if (k) mergedMap.set(k, item);
    }

    let items = Array.from(mergedMap.values());

    // Apply tombstone filters for transactions to guarantee deleted transactions NEVER return
    if (storeName === STORES.TRANSACTIONS) {
      const permTombstones = this.getTombstones(LocalDatabase.TOMBSTONES_PERM_TX);
      const softTombstones = this.getTombstones(LocalDatabase.TOMBSTONES_SOFT_TX);

      // Purge permanently deleted transactions from memory, fallback, and IndexedDB
      if (permTombstones.size > 0) {
        items = items.filter((x: any) => !permTombstones.has(x.id));
        if (db) {
          try {
            const pTx = db.transaction(storeName, 'readwrite');
            const pStore = pTx.objectStore(storeName);
            for (const deadId of Array.from(permTombstones)) {
              pStore.delete(deadId);
            }
          } catch {
            // Ignored
          }
        }
      }

      // Ensure soft-deleted transactions maintain isDeleted: true
      if (softTombstones.size > 0) {
        for (const it of items as any[]) {
          if (softTombstones.has(it.id)) {
            it.isDeleted = true;
          }
        }
      }
    }

    // Apply tombstone filters for hawalas to guarantee deleted hawalas NEVER return
    if (storeName === STORES.HAWALAS) {
      const permTombstones = this.getTombstones(LocalDatabase.TOMBSTONES_PERM_HW);
      const softTombstones = this.getTombstones(LocalDatabase.TOMBSTONES_SOFT_HW);

      // Purge permanently deleted hawalas from memory and background store
      if (permTombstones.size > 0) {
        items = items.filter((x: any) => !permTombstones.has(x.id));
        if (db) {
          try {
            const pTx = db.transaction(storeName, 'readwrite');
            const pStore = pTx.objectStore(storeName);
            for (const deadId of Array.from(permTombstones)) {
              pStore.delete(deadId);
            }
          } catch {
            // Ignored
          }
        }
      }

      // Ensure soft-deleted hawalas maintain isDeleted: true
      if (softTombstones.size > 0) {
        for (const it of items as any[]) {
          if (softTombstones.has(it.id)) {
            it.isDeleted = true;
          }
        }
      }
    }

    // Always keep fallback synchronized with the verified clean items
    this.saveFallbackItems(storeName, items);

    // If IndexedDB was missing some items that were in fallback, backfill them to IndexedDB
    if (db && items.length > idbItems.length) {
      try {
        const bTx = db.transaction(storeName, 'readwrite');
        const bStore = bTx.objectStore(storeName);
        for (const it of items) {
          bStore.put(it);
        }
      } catch {
        // Ignored
      }
    }

    return items;
  }

  private async getItemById<T extends { id?: string; key?: string }>(
    storeName: string,
    id: string
  ): Promise<T | null> {
    // If it is in permanently deleted tombstones, it no longer exists
    if (storeName === STORES.TRANSACTIONS) {
      const permTombstones = this.getTombstones(LocalDatabase.TOMBSTONES_PERM_TX);
      if (permTombstones.has(id)) return null;
    }
    if (storeName === STORES.HAWALAS) {
      const permTombstones = this.getTombstones(LocalDatabase.TOMBSTONES_PERM_HW);
      if (permTombstones.has(id)) return null;
    }

    let db: IDBDatabase | null = null;
    try {
      db = this.cachedDb || (await this.getDB());
    } catch {
      db = null;
    }

    if (db) {
      try {
        const result = await new Promise<T | null>((resolve) => {
          const tx = db!.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });
        if (result) return result;
      } catch {
        // Fallback to memory / localstorage
      }
    }

    const items = this.getFallbackItems<T>(storeName);
    return items.find((x: any) => x.id === id || x.key === id) || null;
  }

  private async insertItem<T extends { id?: string; key?: string }>(
    storeName: string,
    item: T
  ): Promise<void> {
    const key = (item as any).id || (item as any).key;
    const items = this.getFallbackItems<T>(storeName);
    const idx = items.findIndex((x: any) => (x.id || x.key) === key);
    if (idx >= 0) {
      items[idx] = item;
    } else {
      items.push(item);
    }
    this.saveFallbackItems(storeName, items);

    try {
      const db = this.cachedDb || (await this.getDB());
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const req = store.put(item);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        });
      }
    } catch (err) {
      console.warn('IDB insert error, cached in fallback:', err);
    }
  }

  private async deleteItem(storeName: string, id: string): Promise<void> {
    const items = this.getFallbackItems(storeName);
    const filtered = items.filter((x: any) => (x.id || x.key) !== id);
    this.saveFallbackItems(storeName, filtered);

    try {
      const db = this.cachedDb || (await this.getDB());
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        });
      }
    } catch (err) {
      console.warn('IDB delete error, updated in fallback:', err);
    }
  }

  // Metadata storage for counters and flags
  public async getMetadata<T = any>(key: string): Promise<T | null> {
    if (this.useFallback) {
      return this.getFallbackMeta<T>(key);
    }
    try {
      const db = await this.getDB();
      if (!db || this.useFallback) return this.getFallbackMeta<T>(key);
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.METADATA, 'readonly');
        const store = tx.objectStore(STORES.METADATA);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : this.getFallbackMeta<T>(key));
        req.onerror = () => resolve(this.getFallbackMeta<T>(key));
      });
    } catch {
      return this.getFallbackMeta<T>(key);
    }
  }

  public async setMetadata(key: string, value: any): Promise<void> {
    this.setFallbackMeta(key, value);
    if (!this.useFallback) {
      try {
        const db = await this.getDB();
        if (db) {
          await new Promise<void>((resolve) => {
            const tx = db.transaction(STORES.METADATA, 'readwrite');
            const store = tx.objectStore(STORES.METADATA);
            const req = store.put({ key, value });
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
          });
        }
      } catch (err) {
        console.warn('IDB setMetadata error:', err);
      }
    }
  }

  // ===================== HAWALA NUMBER COUNTER (NEVER REPEATS OR RESETS) =====================
  public async getNextHawalaNumber(): Promise<string> {
    let currentCounter = await this.getMetadata<number>('hawala_counter');
    if (currentCounter === undefined || currentCounter === null) {
      try {
        const stored = localStorage.getItem('STS_HAWALA_COUNTER');
        if (stored) {
          currentCounter = parseInt(stored, 10);
        }
      } catch {
        // ignore
      }
    }

    let maxNum = 0;
    try {
      const hawalas = await this.getHawalas(true);
      for (const h of hawalas) {
        const num = parseInt(String(h.hawalaNumber).replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    } catch {
      // ignore
    }

    const baseline = Math.max(currentCounter || 0, maxNum);
    const nextCounter = baseline + 1;

    // شماره حواله از 01 شروع می‌شود، بدون HW و بدون صفرهای اضافی (01، 02، 03...)
    return String(nextCounter).padStart(2, '0');
  }

  // ===================== SETTINGS =====================
  public async getSettings(): Promise<AppSettings> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.SETTINGS, 'readonly');
        const store = tx.objectStore(STORES.SETTINGS);
        const req = store.get('app_settings');
        req.onsuccess = () => {
          if (req.result && req.result.data) {
            const loaded = { ...DEFAULT_SETTINGS, ...req.result.data };
            if (loaded.templates?.customerBalance) {
              loaded.templates.customerBalance = loaded.templates.customerBalance
                .replace(/^.*(?:شماره تماس|{managerPhone}).*$\n?/gm, '')
                .trim();
            }
            resolve(loaded);
          } else {
            resolve(DEFAULT_SETTINGS);
          }
        };
        req.onerror = () => resolve(DEFAULT_SETTINGS);
      });
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public async saveSettings(settings: AppSettings): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETTINGS, 'readwrite');
      const store = tx.objectStore(STORES.SETTINGS);
      const req = store.put({ key: 'app_settings', data: settings });
      req.onsuccess = () => {
        try {
          localStorage.setItem('STS_SETTINGS_BACKUP', JSON.stringify(settings));
        } catch {
          // ignore
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ===================== AUDIT LOGS =====================
  public async addAuditLog(
    actionType: AuditLog['actionType'],
    action: string,
    description: string,
    recordId?: string,
    details?: Record<string, any>
  ): Promise<void> {
    const log: AuditLog = {
      id: 'LOG-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      actionType,
      action,
      description,
      recordId,
      timestamp: new Date().toISOString(),
      details,
    };
    await this.insertItem(STORES.AUDIT_LOGS, log);
  }

  public async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    const logs = await this.getAllItems<AuditLog>(STORES.AUDIT_LOGS);
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
  }

  // ===================== CUSTOMERS =====================
  public async getCustomers(includeDeleted = false): Promise<Customer[]> {
    const all = await this.getAllItems<Customer>(STORES.CUSTOMERS);
    return all.filter(c => includeDeleted ? true : !c.isDeleted);
  }

  public async getCustomerById(id: string): Promise<Customer | null> {
    return this.getItemById<Customer>(STORES.CUSTOMERS, id);
  }

  public async saveCustomer(customer: Customer): Promise<void> {
    await this.insertItem(STORES.CUSTOMERS, customer);
    await this.addAuditLog('customer', 'save', `مشتری «${customer.name}» با شماره ${customer.phone} ثبت/ویرایش شد`, customer.id);
  }

  // Soft Delete to Recycle Bin
  public async softDeleteCustomer(id: string): Promise<void> {
    const cust = await this.getCustomerById(id);
    if (!cust) return;
    cust.isDeleted = true;
    cust.deletedAt = new Date().toISOString();
    await this.insertItem(STORES.CUSTOMERS, cust);
    await this.addAuditLog('customer', 'soft_delete', `مشتری «${cust.name}» به سطل زباله منتقل شد`, id);
  }

  public async restoreCustomer(id: string): Promise<void> {
    const cust = await this.getCustomerById(id);
    if (!cust) return;
    cust.isDeleted = false;
    delete cust.deletedAt;
    await this.insertItem(STORES.CUSTOMERS, cust);
    await this.addAuditLog('customer', 'restore', `مشتری «${cust.name}» از سطل زباله بازیابی شد`, id);
  }

  public async permanentDeleteCustomer(id: string): Promise<void> {
    const cust = await this.getCustomerById(id);
    await this.deleteItem(STORES.CUSTOMERS, id);
    await this.addAuditLog('customer', 'permanent_delete', `مشتری «${cust?.name || id}» به طور دائم حذف شد`, id);
  }

  // ===================== TRANSACTIONS & AUTOMATIC BALANCE RECALCULATION =====================
  public async getTransactions(includeDeleted = false): Promise<JournalTransaction[]> {
    const all = await this.getAllItems<JournalTransaction>(STORES.TRANSACTIONS);
    const permTombstones = this.getTombstones(LocalDatabase.TOMBSTONES_PERM_TX);
    const softTombstones = this.getTombstones(LocalDatabase.TOMBSTONES_SOFT_TX);

    const filtered = all.filter((tx) => {
      // If permanently deleted, NEVER include
      if (permTombstones.has(tx.id)) return false;
      // Check if soft deleted
      const isSoftDeleted = tx.isDeleted || softTombstones.has(tx.id);
      return includeDeleted ? true : !isSoftDeleted;
    });

    return filtered.sort((a, b) => new Date(b.date + ' ' + (b.time || '00:00')).getTime() - new Date(a.date + ' ' + (a.time || '00:00')).getTime());
  }

  public async getTransactionsByCustomer(customerId: string): Promise<JournalTransaction[]> {
    const all = await this.getTransactions(false);
    return all.filter(tx => tx.customerId === customerId);
  }

  /**
   * Recalculates customer balance from ground truth active journal transactions
   * Debit (طلب) = +amount
   * Credit (گرفت) = -amount
   */
  public async recalculateCustomerBalance(customerId: string): Promise<number> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) return 0;

    const txs = await this.getTransactionsByCustomer(customerId);
    let newBalance = 0;

    for (const tx of txs) {
      if (tx.type === 'debit') {
        newBalance = safeAdd(newBalance, tx.amount);
      } else if (tx.type === 'credit') {
        newBalance = safeSubtract(newBalance, tx.amount);
      }
    }

    customer.balance = roundToTwoDecimals(newBalance);
    customer.updatedAt = new Date().toISOString();
    await this.insertItem(STORES.CUSTOMERS, customer);

    return customer.balance;
  }

  public async saveTransaction(tx: JournalTransaction): Promise<number> {
    // If it was previously soft-deleted or perm-deleted, clear tombstones when saved anew
    this.removeTombstone(LocalDatabase.TOMBSTONES_SOFT_TX, tx.id);
    this.removeTombstone(LocalDatabase.TOMBSTONES_PERM_TX, tx.id);
    tx.isDeleted = false;

    await this.insertItem(STORES.TRANSACTIONS, tx);
    const newBalance = await this.recalculateCustomerBalance(tx.customerId);
    await this.addAuditLog(
      'transaction',
      'save',
      `ثبت تراکنش ${tx.type === 'debit' ? 'طلب' : 'گرفت'} به مبلغ ${tx.amount} ${tx.currency} برای ${tx.customerName}`,
      tx.id
    );
    return newBalance;
  }

  public async softDeleteTransaction(id: string): Promise<void> {
    this.addTombstone(LocalDatabase.TOMBSTONES_SOFT_TX, id);
    this.removeTombstone(LocalDatabase.TOMBSTONES_PERM_TX, id);

    const tx = await this.getItemById<JournalTransaction>(STORES.TRANSACTIONS, id);
    if (tx) {
      tx.isDeleted = true;
      tx.deletedAt = new Date().toISOString();
      await this.insertItem(STORES.TRANSACTIONS, tx);
      await this.recalculateCustomerBalance(tx.customerId);
      await this.addAuditLog('transaction', 'soft_delete', `تراکنش ${tx.id} به سطل زباله منتقل شد`, id);
    }
  }

  public async restoreTransaction(id: string): Promise<void> {
    this.removeTombstone(LocalDatabase.TOMBSTONES_SOFT_TX, id);
    this.removeTombstone(LocalDatabase.TOMBSTONES_PERM_TX, id);

    const tx = await this.getItemById<JournalTransaction>(STORES.TRANSACTIONS, id);
    if (tx) {
      tx.isDeleted = false;
      delete tx.deletedAt;
      await this.insertItem(STORES.TRANSACTIONS, tx);
      await this.recalculateCustomerBalance(tx.customerId);
      await this.addAuditLog('transaction', 'restore', `تراکنش ${tx.id} بازیابی شد`, id);
    }
  }

  public async permanentDeleteTransaction(id: string): Promise<void> {
    const tx = await this.getItemById<JournalTransaction>(STORES.TRANSACTIONS, id);
    const customerId = tx ? tx.customerId : null;

    this.removeTombstone(LocalDatabase.TOMBSTONES_SOFT_TX, id);
    this.addTombstone(LocalDatabase.TOMBSTONES_PERM_TX, id);

    await this.deleteItem(STORES.TRANSACTIONS, id);

    if (customerId) {
      await this.recalculateCustomerBalance(customerId);
    }
    await this.addAuditLog('transaction', 'permanent_delete', `تراکنش ${id} به صورت دائم حذف شد و دیگر باز نخواهد گشت`, id);
  }

  /**
   * Completely empties all recorded transactions from database, memory, and storage,
   * resetting customer balances to zero.
   */
  public async clearAllTransactions(): Promise<void> {
    try {
      const db = await this.getDB();
      if (db) {
        await new Promise<void>((resolve) => {
          try {
            const tx = db.transaction(STORES.TRANSACTIONS, 'readwrite');
            const store = tx.objectStore(STORES.TRANSACTIONS);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
          } catch {
            resolve();
          }
        });
      }
    } catch {
      // Ignored
    }

    this.saveFallbackItems(STORES.TRANSACTIONS, []);
    this.memoryStore[STORES.TRANSACTIONS] = [];

    // Reset tombstones for transactions
    this.saveTombstones(LocalDatabase.TOMBSTONES_PERM_TX, new Set());
    this.saveTombstones(LocalDatabase.TOMBSTONES_SOFT_TX, new Set());

    // Also remove transaction items from trash
    try {
      const trashItems = await this.getTrashItems();
      for (const t of trashItems) {
        if (t.itemType === 'transaction') {
          await this.deleteItem(STORES.TRANSACTIONS, t.originalId);
        }
      }
    } catch {
      // Ignored
    }

    // Reset all customer balances to 0
    try {
      const customers = await this.getCustomers(true);
      for (const cust of customers) {
        cust.balance = 0;
        cust.updatedAt = new Date().toISOString();
        await this.insertItem(STORES.CUSTOMERS, cust);
      }
    } catch {
      // Ignored
    }

    await this.addAuditLog(
      'transaction',
      'clear_all',
      'تمام تراکنش‌های ثبت‌شده روزنامچه به درخواست کاربر خالی شدند و بیلانس تمام حساب‌ها صفر شد'
    );
  }

  // ===================== HAWALAS =====================
  public async getHawalas(includeDeleted = false): Promise<Hawala[]> {
    const all = await this.getAllItems<Hawala>(STORES.HAWALAS);
    const permTombstones = this.getTombstones(LocalDatabase.TOMBSTONES_PERM_HW);
    const softTombstones = this.getTombstones(LocalDatabase.TOMBSTONES_SOFT_HW);

    for (const h of all) {
      if (h.hawalaNumber) {
        h.hawalaNumber = formatHawalaNumber(h.hawalaNumber);
      }
    }
    const filtered = all.filter((h) => {
      if (permTombstones.has(h.id)) return false;
      const isSoftDeleted = h.isDeleted || softTombstones.has(h.id);
      return includeDeleted ? true : !isSoftDeleted;
    });
    return filtered.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }

  public async getHawalaById(id: string): Promise<Hawala | null> {
    const permTombstones = this.getTombstones(LocalDatabase.TOMBSTONES_PERM_HW);
    if (permTombstones.has(id)) return null;

    const h = await this.getItemById<Hawala>(STORES.HAWALAS, id);
    if (h && h.hawalaNumber) {
      h.hawalaNumber = formatHawalaNumber(h.hawalaNumber);
    }
    return h;
  }

  public async saveHawala(hawala: Hawala): Promise<void> {
    // If it was previously soft or perm deleted, clear tombstones on new save
    this.removeTombstone(LocalDatabase.TOMBSTONES_SOFT_HW, hawala.id);
    this.removeTombstone(LocalDatabase.TOMBSTONES_PERM_HW, hawala.id);
    hawala.isDeleted = false;

    hawala.hawalaNumber = formatHawalaNumber(hawala.hawalaNumber);
    const num = parseInt(String(hawala.hawalaNumber).replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      const currentCounter = (await this.getMetadata<number>('hawala_counter')) || 0;
      if (num > currentCounter) {
        await this.setMetadata('hawala_counter', num);
        try {
          localStorage.setItem('STS_HAWALA_COUNTER', String(num));
        } catch {
          // ignore
        }
      }
    }
    await this.insertItem(STORES.HAWALAS, hawala);
    await this.addAuditLog(
      'hawala',
      'save',
      `حواله ${hawala.hawalaNumber} (کد ${hawala.hawalaCode}) به مبلغ ${hawala.amount} ${hawala.currency} از ${hawala.senderName} به ${hawala.receiverName} ثبت/ویرایش شد`,
      hawala.id
    );
  }

  public async updateHawalaStatus(id: string, newStatus: HawalaStatus): Promise<void> {
    const hawala = await this.getHawalaById(id);
    if (!hawala) return;
    hawala.status = newStatus;
    hawala.updatedAt = new Date().toISOString();
    await this.insertItem(STORES.HAWALAS, hawala);
    await this.addAuditLog(
      'hawala',
      'status_change',
      `وضعیت حواله ${hawala.hawalaNumber} به «${newStatus === 'completed' ? 'اجرا شده' : newStatus === 'cancelled' ? 'لغو شده' : 'در حال انتظار'}» تغییر یافت`,
      id
    );
  }

  public async softDeleteHawala(id: string): Promise<void> {
    this.addTombstone(LocalDatabase.TOMBSTONES_SOFT_HW, id);
    this.removeTombstone(LocalDatabase.TOMBSTONES_PERM_HW, id);

    const h = await this.getHawalaById(id);
    if (!h) return;
    h.isDeleted = true;
    h.deletedAt = new Date().toISOString();
    await this.insertItem(STORES.HAWALAS, h);
    await this.addAuditLog('hawala', 'soft_delete', `حواله ${h.hawalaNumber} به سطل زباله منتقل شد`, id);
  }

  public async restoreHawala(id: string): Promise<void> {
    this.removeTombstone(LocalDatabase.TOMBSTONES_SOFT_HW, id);
    this.removeTombstone(LocalDatabase.TOMBSTONES_PERM_HW, id);

    const h = await this.getItemById<Hawala>(STORES.HAWALAS, id);
    if (!h) return;
    h.isDeleted = false;
    delete h.deletedAt;
    await this.insertItem(STORES.HAWALAS, h);
    await this.addAuditLog('hawala', 'restore', `حواله ${h.hawalaNumber} از سطل زباله بازیابی شد`, id);
  }

  public async permanentDeleteHawala(id: string): Promise<void> {
    const h = await this.getItemById<Hawala>(STORES.HAWALAS, id);

    this.removeTombstone(LocalDatabase.TOMBSTONES_SOFT_HW, id);
    this.addTombstone(LocalDatabase.TOMBSTONES_PERM_HW, id);

    await this.deleteItem(STORES.HAWALAS, id);
    await this.addAuditLog('hawala', 'permanent_delete', `حواله ${h?.hawalaNumber || id} برای همیشه حذف گردید و دیگر باز نخواهد گشت`, id);
  }

  /**
   * Completely empties all recorded hawalas from database, memory, and storage.
   */
  public async clearAllHawalas(): Promise<void> {
    try {
      const db = await this.getDB();
      if (db) {
        await new Promise<void>((resolve) => {
          try {
            const tx = db.transaction(STORES.HAWALAS, 'readwrite');
            const store = tx.objectStore(STORES.HAWALAS);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
          } catch {
            resolve();
          }
        });
      }
    } catch {
      // Ignored
    }

    this.saveFallbackItems(STORES.HAWALAS, []);
    this.memoryStore[STORES.HAWALAS] = [];

    // Reset tombstones for hawalas
    this.saveTombstones(LocalDatabase.TOMBSTONES_PERM_HW, new Set());
    this.saveTombstones(LocalDatabase.TOMBSTONES_SOFT_HW, new Set());

    // Also remove hawala items from trash
    try {
      const trashItems = await this.getTrashItems();
      for (const t of trashItems) {
        if (t.itemType === 'hawala') {
          await this.deleteItem(STORES.HAWALAS, t.originalId);
        }
      }
    } catch {
      // Ignored
    }

    await this.addAuditLog(
      'hawala',
      'clear_all',
      'تمام حواله‌های ثبت‌شده به درخواست کاربر به طور کامل پاکسازی شدند'
    );
  }

  // ===================== RECYCLE BIN / TRASH =====================
  public async getTrashItems(): Promise<TrashItem[]> {
    const allCustomers = await this.getAllItems<Customer>(STORES.CUSTOMERS);
    const allTransactions = await this.getAllItems<JournalTransaction>(STORES.TRANSACTIONS);
    const allHawalas = await this.getAllItems<Hawala>(STORES.HAWALAS);

    const items: TrashItem[] = [];

    for (const c of allCustomers.filter(c => c.isDeleted)) {
      items.push({
        id: `trash-cust-${c.id}`,
        itemType: 'customer',
        originalId: c.id,
        deletedAt: c.deletedAt || new Date().toISOString(),
        data: c,
      });
    }

    const permTx = this.getTombstones(LocalDatabase.TOMBSTONES_PERM_TX);
    const softTx = this.getTombstones(LocalDatabase.TOMBSTONES_SOFT_TX);

    for (const t of allTransactions) {
      if (permTx.has(t.id)) continue;
      if (t.isDeleted || softTx.has(t.id)) {
        items.push({
          id: `trash-tx-${t.id}`,
          itemType: 'transaction',
          originalId: t.id,
          deletedAt: t.deletedAt || new Date().toISOString(),
          data: t,
        });
      }
    }

    const permHw = this.getTombstones(LocalDatabase.TOMBSTONES_PERM_HW);
    const softHw = this.getTombstones(LocalDatabase.TOMBSTONES_SOFT_HW);

    for (const h of allHawalas) {
      if (permHw.has(h.id)) continue;
      if (h.isDeleted || softHw.has(h.id)) {
        items.push({
          id: `trash-hw-${h.id}`,
          itemType: 'hawala',
          originalId: h.id,
          deletedAt: h.deletedAt || new Date().toISOString(),
          data: h,
        });
      }
    }

    return items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  }

  public async restoreTrashItem(trashId: string): Promise<void> {
    if (trashId.startsWith('trash-cust-')) {
      const originalId = trashId.replace('trash-cust-', '');
      await this.restoreCustomer(originalId);
    } else if (trashId.startsWith('trash-tx-')) {
      const originalId = trashId.replace('trash-tx-', '');
      await this.restoreTransaction(originalId);
    } else if (trashId.startsWith('trash-hw-')) {
      const originalId = trashId.replace('trash-hw-', '');
      await this.restoreHawala(originalId);
    } else {
      // Try resolving by originalId
      await this.restoreCustomer(trashId);
      await this.restoreTransaction(trashId);
      await this.restoreHawala(trashId);
    }
  }

  public async permanentlyDeleteTrashItem(trashId: string): Promise<void> {
    if (trashId.startsWith('trash-cust-')) {
      const originalId = trashId.replace('trash-cust-', '');
      await this.permanentDeleteCustomer(originalId);
    } else if (trashId.startsWith('trash-tx-')) {
      const originalId = trashId.replace('trash-tx-', '');
      await this.permanentDeleteTransaction(originalId);
    } else if (trashId.startsWith('trash-hw-')) {
      const originalId = trashId.replace('trash-hw-', '');
      await this.permanentDeleteHawala(originalId);
    } else {
      await this.permanentDeleteCustomer(trashId);
      await this.permanentDeleteTransaction(trashId);
      await this.permanentDeleteHawala(trashId);
    }
  }

  public async emptyTrash(): Promise<void> {
    const trash = await this.getTrashItems();
    for (const item of trash) {
      await this.permanentlyDeleteTrashItem(item.id);
    }
    await this.addAuditLog('system', 'empty_trash', 'سطل زباله به طور کامل تخلیه شد');
  }

  // ===================== BACKUP & RESTORE =====================
  public async createFullBackup(): Promise<BackupData> {
    const customers = await this.getAllItems<Customer>(STORES.CUSTOMERS);
    const transactions = await this.getAllItems<JournalTransaction>(STORES.TRANSACTIONS);
    const hawalas = await this.getAllItems<Hawala>(STORES.HAWALAS);
    const auditLogs = await this.getAllItems<AuditLog>(STORES.AUDIT_LOGS);
    const settings = await this.getSettings();
    const hawalaCounter = (await this.getMetadata<number>('hawala_counter')) || hawalas.length;

    const backupData: BackupData = {
      version: '1.0.0',
      appName: 'STS Sadat',
      exportedAt: new Date().toISOString(),
      customers,
      transactions,
      hawalas,
      auditLogs,
      settings,
      hawalaCounter,
    };

    // Store in internal backup store
    const backupId = 'BACKUP-' + Date.now();
    await this.insertItem(STORES.BACKUPS, { id: backupId, createdAt: new Date().toISOString(), data: backupData });
    await this.addAuditLog('backup', 'create', `پشتیبان‌گیری کامل از پایگاه داده انجام شد (${customers.length} مشتری، ${transactions.length} تراکنش، ${hawalas.length} حواله)`);

    return backupData;
  }

  public async restoreFullBackup(backupData: BackupData): Promise<void> {
    // 1. Create a safety auto-backup before restoration
    await this.createFullBackup();

    // 2. Clear stores
    const db = await this.getDB();
    const clearStore = (name: string) => {
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(name, 'readwrite');
        const store = tx.objectStore(name);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    };

    await clearStore(STORES.CUSTOMERS);
    await clearStore(STORES.TRANSACTIONS);
    await clearStore(STORES.HAWALAS);

    // 3. Insert restored items
    for (const c of backupData.customers || []) {
      await this.insertItem(STORES.CUSTOMERS, c);
    }
    for (const tx of backupData.transactions || []) {
      await this.insertItem(STORES.TRANSACTIONS, tx);
    }
    for (const h of backupData.hawalas || []) {
      await this.insertItem(STORES.HAWALAS, h);
    }
    if (backupData.settings) {
      await this.saveSettings(backupData.settings);
    }
    if (typeof backupData.hawalaCounter === 'number') {
      await this.setMetadata('hawala_counter', backupData.hawalaCounter);
    }

    // Recalculate customer balances to ensure 100% integrity
    for (const c of backupData.customers || []) {
      await this.recalculateCustomerBalance(c.id);
    }

    await this.addAuditLog('restore', 'execute', `بازیابی موفقیت‌آمیز اطلاعات از فایل بکاپ مورخ ${backupData.exportedAt}`);
  }

  // ===================== DATABASE HEALTH CHECK & REPAIR =====================
  public async performHealthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    customerCount: number;
    transactionCount: number;
    hawalaCount: number;
    lastHawalaNumber: string;
  }> {
    const issues: string[] = [];
    let customerCount = 0;
    let transactionCount = 0;
    let hawalaCount = 0;
    let lastHawalaNumber = '00';

    try {
      const customers = await this.getCustomers(true);
      customerCount = customers.length;
      
      const transactions = await this.getTransactions(true);
      transactionCount = transactions.length;

      const hawalas = await this.getHawalas(true);
      hawalaCount = hawalas.length;

      const counter = (await this.getMetadata<number>('hawala_counter')) || 0;
      lastHawalaNumber = String(counter).padStart(2, '0');

      // Check balance anomalies
      for (const c of customers) {
        const custTxs = transactions.filter(t => t.customerId === c.id && !t.isDeleted);
        let expectedBal = 0;
        for (const t of custTxs) {
          if (t.type === 'debit') expectedBal = safeAdd(expectedBal, t.amount);
          if (t.type === 'credit') expectedBal = safeSubtract(expectedBal, t.amount);
        }
        if (Math.abs(c.balance - expectedBal) > 0.01) {
          issues.push(`عدم انطباق بیلانس مشتری «${c.name}» (محاسبه شد: ${expectedBal}، ثبت شده: ${c.balance}) - اصلاح خودکار امکان‌پذیر است`);
        }
      }

      // Check counter vs hawalas
      if (counter < hawalas.length) {
        issues.push(`کاونتر شماره حواله (${counter}) از تعداد کل حواله‌ها (${hawalas.length}) کمتر است.`);
      }

    } catch (err: any) {
      issues.push(`خطا در اتصال یا خواندن داده‌ها: ${err?.message || err}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      customerCount,
      transactionCount,
      hawalaCount,
      lastHawalaNumber,
    };
  }

  public async autoRepair(): Promise<number> {
    let repairedCount = 0;
    const customers = await this.getCustomers(true);
    for (const c of customers) {
      await this.recalculateCustomerBalance(c.id);
      repairedCount++;
    }

    const hawalas = await this.getHawalas(true);
    const currentCounter = (await this.getMetadata<number>('hawala_counter')) || 0;
    if (hawalas.length > currentCounter) {
      await this.setMetadata('hawala_counter', hawalas.length);
    }

    await this.addAuditLog('system', 'repair', `تعمیر و بازسازی خودکار بیلانس‌ها برای ${repairedCount} حساب مشتری`);
    return repairedCount;
  }

  public async clearAuditLogs(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.AUDIT_LOGS, 'readwrite');
      const store = tx.objectStore(STORES.AUDIT_LOGS);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async exportFullBackup(): Promise<BackupData> {
    return this.createFullBackup();
  }

  public async importFullBackup(jsonString: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || !Array.isArray(parsed.customers) || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.hawalas)) {
        return false;
      }
      await this.restoreFullBackup(parsed);
      return true;
    } catch (err) {
      console.error('Import error:', err);
      return false;
    }
  }

  public async populateDefaultSeedData(): Promise<void> {
    for (const c of DEFAULT_CUSTOMERS) {
      await this.insertItem(STORES.CUSTOMERS, c);
    }
    for (const tx of DEFAULT_TRANSACTIONS) {
      await this.insertItem(STORES.TRANSACTIONS, tx);
    }
    for (const h of DEFAULT_HAWALAS) {
      await this.insertItem(STORES.HAWALAS, h);
    }
    await this.setMetadata('hawala_counter', 3);
    await this.saveSettings(DEFAULT_SETTINGS);
    await this.addAuditLog('system', 'init', 'بازنشانی پایگاه داده به داده‌های پیش‌فرض سیستم');
  }

  public async clearEntireDatabase(): Promise<void> {
    try {
      const db = await this.getDB();
      if (db) {
        const clearStore = (name: string) => {
          return new Promise<void>((resolve) => {
            try {
              const tx = db.transaction(name, 'readwrite');
              const store = tx.objectStore(name);
              const req = store.clear();
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
            } catch {
              resolve();
            }
          });
        };

        await clearStore(STORES.CUSTOMERS);
        await clearStore(STORES.TRANSACTIONS);
        await clearStore(STORES.HAWALAS);
        await clearStore(STORES.AUDIT_LOGS);
        await clearStore(STORES.METADATA);
      }
    } catch {
      // Ignored
    }

    this.saveFallbackItems(STORES.CUSTOMERS, []);
    this.saveFallbackItems(STORES.TRANSACTIONS, []);
    this.saveFallbackItems(STORES.HAWALAS, []);
    this.saveFallbackItems(STORES.AUDIT_LOGS, []);
    this.saveFallbackItems(STORES.METADATA, []);

    await this.populateDefaultSeedData();
  }

  public async healthCheckAndRepair(): Promise<{ healthy: boolean; repaired: boolean; message: string }> {
    const check = await this.performHealthCheck();
    if (check.healthy) {
      return { healthy: true, repaired: false, message: 'پایگاه داده در وضعیت سالم و پایدار است.' };
    }
    const count = await this.autoRepair();
    return {
      healthy: true,
      repaired: true,
      message: `رفع اشکال و بازسازی با موفقیت انجام شد (${count} حساب اصلاح گردید).`,
    };
  }

  public static init() { return db.getDB(); }
  public static getDefaultSettings() { return DEFAULT_SETTINGS; }
  public static getSettings() { return db.getSettings(); }
  public static saveSettings(settings: AppSettings) { return db.saveSettings(settings); }
  public static getCustomers(includeDeleted?: boolean) { return db.getCustomers(includeDeleted); }
  public static getCustomerById(id: string) { return db.getCustomerById(id); }
  public static saveCustomer(customer: Customer) { return db.saveCustomer(customer); }
  public static softDeleteCustomer(id: string) { return db.softDeleteCustomer(id); }
  public static restoreCustomer(id: string) { return db.restoreCustomer(id); }
  public static permanentDeleteCustomer(id: string) { return db.permanentDeleteCustomer(id); }
  public static getTransactions(includeDeleted?: boolean) { return db.getTransactions(includeDeleted); }
  public static getTransactionsByCustomer(customerId: string) { return db.getTransactionsByCustomer(customerId); }
  public static recalculateCustomerBalance(customerId: string) { return db.recalculateCustomerBalance(customerId); }
  public static saveTransaction(tx: JournalTransaction) { return db.saveTransaction(tx); }
  public static softDeleteTransaction(id: string) { return db.softDeleteTransaction(id); }
  public static restoreTransaction(id: string) { return db.restoreTransaction(id); }
  public static permanentDeleteTransaction(id: string) { return db.permanentDeleteTransaction(id); }
  public static clearAllTransactions() { return db.clearAllTransactions(); }
  public static getHawalas(includeDeleted?: boolean) { return db.getHawalas(includeDeleted); }
  public static getHawalaById(id: string) { return db.getHawalaById(id); }
  public static saveHawala(hawala: Hawala) { return db.saveHawala(hawala); }
  public static updateHawalaStatus(id: string, status: HawalaStatus) { return db.updateHawalaStatus(id, status); }
  public static softDeleteHawala(id: string) { return db.softDeleteHawala(id); }
  public static restoreHawala(id: string) { return db.restoreHawala(id); }
  public static permanentDeleteHawala(id: string) { return db.permanentDeleteHawala(id); }
  public static clearAllHawalas() { return db.clearAllHawalas(); }
  public static getTrashItems() { return db.getTrashItems(); }
  public static restoreTrashItem(trashId: string) { return db.restoreTrashItem(trashId); }
  public static permanentlyDeleteTrashItem(trashId: string) { return db.permanentlyDeleteTrashItem(trashId); }
  public static emptyTrash() { return db.emptyTrash(); }
  public static getAuditLogs(limit?: number) { return db.getAuditLogs(limit); }
  public static addAuditLog(actionType: any, action: string, description: string, recordId?: string, details?: any) {
    return db.addAuditLog(actionType, action, description, recordId, details);
  }
  public static clearAuditLogs() { return db.clearAuditLogs(); }
  public static getNextHawalaNumber() { return db.getNextHawalaNumber(); }
  public static createFullBackup() { return db.createFullBackup(); }
  public static exportFullBackup() { return db.exportFullBackup(); }
  public static restoreFullBackup(backupData: BackupData) { return db.restoreFullBackup(backupData); }
  public static importFullBackup(jsonString: string) { return db.importFullBackup(jsonString); }
  public static performHealthCheck() { return db.performHealthCheck(); }
  public static autoRepair() { return db.autoRepair(); }
  public static healthCheckAndRepair() { return db.healthCheckAndRepair(); }
  public static clearEntireDatabase() { return db.clearEntireDatabase(); }
}

export const db = new LocalDatabase();

