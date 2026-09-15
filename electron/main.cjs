const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Enable file access and relax file protocol restrictions for bundled ES modules
app.commandLine.appendSwitch('allow-file-access-from-files');
app.commandLine.appendSwitch('disable-web-security');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'STS Sadat – سیستم خدمات مالی، حواله و حساب‌های مشتریان',
    backgroundColor: '#090d16',
    autoHideMenuBar: false,
    show: false, // Show gracefully when ready-to-show
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false, // Critical for loading Vite ES modules from file:// protocol
      allowRunningInsecureContent: true,
    },
  });

  // Graceful show on ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load app from local dist in production, or localhost in development
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const appDir = app.getAppPath();
    const candidatePaths = [
      path.join(appDir, 'dist/index.html'),
      path.join(__dirname, '../dist/index.html'),
      path.join(__dirname, 'dist/index.html'),
    ];

    let resolvedPath = candidatePaths.find((p) => fs.existsSync(p));

    if (resolvedPath) {
      mainWindow.loadFile(resolvedPath);
    } else {
      mainWindow.loadURL('http://localhost:3000');
    }
  }

  // Handle failure to load gracefully
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
    console.warn('Page failed to load:', errorCode, errorDesc);
  });

  // Shortcut F12 or Ctrl+Shift+I for DevTools inspection if needed
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Create custom application menu in Persian
  const menuTemplate = [
    {
      label: 'پرونده',
      submenu: [
        {
          label: 'چاپ صفحه / سند جاری',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow && mainWindow.webContents.print(),
        },
        { type: 'separator' },
        {
          label: 'خروج از برنامه',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'نمایش',
      submenu: [
        { role: 'reload', label: 'بارگذاری مجدد' },
        { role: 'forceReload', label: 'بارگذاری مجدد قطعی' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'بزرگنمایی عادی' },
        { role: 'zoomIn', label: 'بزرگ‌نمایی' },
        { role: 'zoomOut', label: 'کوچک‌نمایی' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'تمام صفحه' },
      ],
    },
    {
      label: 'راهنما',
      submenu: [
        {
          label: 'درباره نرم‌افزار STS سادات',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'درباره نرم‌افزار',
              message: 'سامانه خدمات مالی، حواله و مدیریت مشتریان STS سادات',
              detail: 'نسخه ۱.۰.۰\nتوسعه یافته برای صرافی‌ها و خدمات پولی افغانستان\nکارکرد ۱۰۰٪ آفلاین و ذخیره‌سازی امن محلی',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
