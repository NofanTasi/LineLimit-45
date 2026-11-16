import { useCallback, useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;
let needRefreshState = false;
let initialized = false;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function initServiceWorker() {
  if (initialized) return;
  initialized = true;

  updateSWFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefreshState = true;
      notifyListeners();
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      swRegistration = registration;

      // Check for updates whenever the user returns to the app/PWA
      const checkUpdate = () => {
        if (navigator.onLine) {
          void registration.update().catch(() => {});
        }
      };

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkUpdate();
        }
      });

      window.setInterval(checkUpdate, 10 * 60 * 1000);
    },
  });
}

export function usePWAUpdate() {
  const [needRefresh, setNeedRefresh] = useState(needRefreshState);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const sync = () => setNeedRefresh(needRefreshState);
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const checkAndUpdate = useCallback(async () => {
    if (isUpdating) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    setIsUpdating(true);
    try {
      if (needRefreshState && updateSWFn) {
        await updateSWFn(true);
        return;
      }

      if (swRegistration) {
        try {
          await swRegistration.update();
        } catch {
          // Proceed to cache-clear reload fallback
        }
        if (swRegistration.waiting && updateSWFn) {
          await updateSWFn(true);
          return;
        }
      }

      // Clear stale Cache Storage & SW registrations so the newest deployed build loads cleanly
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      }
      try {
        await fetch(window.location.href, { cache: 'reload' });
      } catch {
        // Ignore network fetch hint errors before hard reload
      }
      window.location.reload();
    } finally {
      setIsUpdating(false);
    }
  }, [isUpdating]);

  return {
    needRefresh,
    isUpdating,
    checkAndUpdate,
  };
}
