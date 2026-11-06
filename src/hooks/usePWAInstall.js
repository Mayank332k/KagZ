import { useState, useEffect, useCallback } from 'react';

const DISMISS_KEY = 'kagz_pwa_dismissed_until';
const SESSION_VIEWS_KEY = 'kagz_pwa_page_views';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Module-level state so any component subscribing stays in perfect sync
let globalDeferredPrompt = null;
const promptListeners = new Set();

const notifyListeners = () => {
  promptListeners.forEach((fn) => fn(globalDeferredPrompt));
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    notifyListeners();
  });
}

// Helper to check if running in standalone PWA mode
const checkIsStandalone = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
};

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState(checkIsStandalone);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const onPromptChange = (prompt) => {
      setDeferredPrompt(prompt);
      if (!prompt && checkIsStandalone()) {
        setIsInstalled(true);
      }
    };

    promptListeners.add(onPromptChange);
    return () => {
      promptListeners.delete(onPromptChange);
    };
  }, []);

  // Increment session page views and evaluate engagement
  const recordPageView = useCallback(() => {
    if (isInstalled) return;

    try {
      const dismissedUntil = localStorage.getItem(DISMISS_KEY);
      if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

      const currentViews = Number(sessionStorage.getItem(SESSION_VIEWS_KEY) || 0) + 1;
      sessionStorage.setItem(SESSION_VIEWS_KEY, String(currentViews));

      // Trigger prompt on 2+ page navigation
      if (currentViews >= 2) {
        setShowBanner(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, [isInstalled]);

  // Initial engagement timer (shows after 2.5s on site)
  useEffect(() => {
    if (isInstalled) {
      return;
    }

    try {
      const dismissedUntil = localStorage.getItem(DISMISS_KEY);
      if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;
    } catch {
      // Ignore storage errors
    }

    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, [isInstalled]);

  const installApp = useCallback(async () => {
    const promptEvent = deferredPrompt || globalDeferredPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult?.outcome === 'accepted') {
          globalDeferredPrompt = null;
          setDeferredPrompt(null);
          setIsInstalled(true);
          setShowBanner(false);
          notifyListeners();
          return { success: true };
        }
        return { success: false, reason: 'dismissed' };
      } catch (err) {
        console.warn('PWA installation prompt failed:', err);
        return { success: false, error: err };
      }
    }

    // Fallback if browser (e.g. Brave / Safari) doesn't expose programmatic prompt
    return { success: false, fallback: true };
  }, [deferredPrompt]);

  const dismissPrompt = useCallback(() => {
    setShowBanner(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DURATION_MS));
    } catch {
      // Ignore storage errors
    }
  }, []);

  return {
    isInstallable: !isInstalled,
    hasNativePrompt: !!(deferredPrompt || globalDeferredPrompt),
    isInstalled,
    showBanner,
    installApp,
    dismissPrompt,
    recordPageView,
  };
};

export default usePWAInstall;
