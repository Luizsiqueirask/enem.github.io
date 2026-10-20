// Ensure window.fetch has both getter and setter in iframe/strict mode environments
if (typeof window !== 'undefined') {
  try {
    const rawFetch = window.fetch;
    let currentFetch = typeof rawFetch === 'function' ? rawFetch.bind(window) : rawFetch;
    const desc = {
      configurable: true,
      enumerable: true,
      get() {
        return currentFetch;
      },
      set(fn: any) {
        currentFetch = fn;
      }
    };
    try {
      Object.defineProperty(window, 'fetch', desc);
    } catch {}
    if (typeof Window !== 'undefined' && Window.prototype) {
      try {
        Object.defineProperty(Window.prototype, 'fetch', desc);
      } catch {}
    }
  } catch {}
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
