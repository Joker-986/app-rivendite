import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign Vite WebSocket errors in this environment
if (typeof window !== 'undefined') {
  const isViteError = (msg: string) => 
    msg?.includes('WebSocket') || 
    msg?.includes('vite') || 
    msg?.includes('HMR');

  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && isViteError(event.reason.message)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    if (isViteError(event.message)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  // Filter console.error for these specific messages
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (args[0] && typeof args[0] === 'string' && isViteError(args[0])) {
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
