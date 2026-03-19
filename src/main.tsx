import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Service Worker Registration and Update Detection
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('SW registered: ', registration);
      
      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 1000 * 60 * 60); // Check every hour
    }).catch((registrationError) => {
      console.log('SW registration failed: ', registrationError);
    });

    // Reload the page when a new service worker takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        window.location.reload();
        refreshing = true;
      }
    });
  });
}

// Suppress benign Vite WebSocket errors in this environment
if (typeof window !== 'undefined') {
  const isBenignError = (msg: string) => 
    msg?.includes('WebSocket') || 
    msg?.includes('vite') || 
    msg?.includes('HMR') ||
    msg?.includes('Cannot set property fetch');

  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && isBenignError(event.reason.message)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    if (isBenignError(event.message)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  // Filter console.error for these specific messages
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (args[0] && typeof args[0] === 'string' && isBenignError(args[0])) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
