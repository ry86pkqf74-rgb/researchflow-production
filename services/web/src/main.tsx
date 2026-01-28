import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initSentry } from "./lib/sentry";
import { ErrorBoundary } from "./components/errors";

// Initialize Sentry for error tracking (PHI-safe)
// Configure VITE_SENTRY_DSN environment variable to enable
initSentry();

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
});

console.log('[main.tsx] Initializing React app...');

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  
  const root = createRoot(rootElement);
  console.log('[main.tsx] React root created, rendering App...');
  
  root.render(
    <ErrorBoundary context="app-root">
      <App />
    </ErrorBoundary>
  );
  
  console.log('[main.tsx] App rendered successfully');
} catch (error) {
  console.error('[main.tsx] Failed to initialize app:', error);
  document.getElementById("root")!.innerHTML = `
    <div style="padding: 2rem; font-family: system-ui;">
      <h1 style="color: #ef4444;">Application Error</h1>
      <p>Failed to initialize the application. Check console for details.</p>
      <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow: auto;">${error}</pre>
    </div>
  `;
}
// Build trigger Wed Jan 28 09:15:00 UTC 2026 - Vercel config fixed
