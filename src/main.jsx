import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { beginTrackedSpan, initPerfMonitor } from './utils/perfMonitor'

const renderFatalError = (message) => {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = `
    <div style="min-height:100vh;background:#020617;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;">
      <div style="width:min(720px,100%);background:rgba(0,0,0,0.55);border:1px solid rgba(244,63,94,0.35);border-radius:24px;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,0.45);font-family:system-ui,sans-serif;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(251,113,133,0.8);">Fatal Error</p>
        <h1 style="margin:0 0 16px;font-size:28px;">LifeQuest could not finish loading.</h1>
        <pre style="white-space:pre-wrap;overflow:auto;background:rgba(15,23,42,0.9);padding:16px;border-radius:16px;color:#fecdd3;">${message}</pre>
        <p style="margin:16px 0 0;color:#cbd5e1;">If this happened after an update, try a hard refresh or clearing the installed app cache/service worker.</p>
      </div>
    </div>
  `;
};

window.addEventListener('error', (event) => {
  const message = event?.error?.stack || event?.message || 'Unknown window error';
  renderFatalError(message);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  const message = reason?.stack || reason?.message || `${reason}` || 'Unknown promise rejection';
  renderFatalError(message);
});

try {
  initPerfMonitor()
  beginTrackedSpan('app-bootstrap')

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (error) {
  renderFatalError(error?.stack || error?.message || 'Unknown bootstrap crash');
}
