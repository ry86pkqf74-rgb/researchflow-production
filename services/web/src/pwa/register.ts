/**
 * PWA Service Worker Registration
 * Task 161: PWA features (manifest + service worker + offline)
 */

import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker() {
  // Show a toast/banner when a new version is available.
  // Keep UI minimal; do not auto-reload while user is editing.
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent('pwa:need-refresh'));
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('pwa:offline-ready'));
    },
    onRegistered(registration) {
      // Check for updates periodically
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  return updateSW;
}

// Hook for components to trigger manual update
export function usePWAUpdate() {
  return {
    update: () => {
      window.dispatchEvent(new CustomEvent('pwa:trigger-update'));
    },
  };
}
