import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker safely for 100% offline access and local caching
try {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('App updated, ready to work offline');
      },
      onOfflineReady() {
        console.log('App is ready for offline use');
      },
    });
  }
} catch (err) {
  console.warn('Service worker registration was skipped or unsupported:', err);
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

