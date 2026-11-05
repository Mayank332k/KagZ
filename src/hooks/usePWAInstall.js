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
    if (isInstalled || !deferredPrompt) return;

    try {
      const dismissedUntil = localStorage.getItem(DISMISS_KEY);
      if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

      const currentViews = Number(sessionStorage.getItem(SESSION_VIEWS_KEY) || 0) + 1;
      sessionStorage.setItem(SESSION_VIEWS_KEY, String(currentViews));

      // If user has engaged with 2 or more pages, trigger prompt
      if (currentViews >= 2) {
        setShowBanner(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, [isInstalled, deferredPrompt]);

  // Engagement timer (30s on site)
  useEffect(() => {
    if (isInstalled || !deferredPrompt) {
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
    }, 30000);

    return () => clearTimeout(timer);
  }, [deferredPrompt, isInstalled]);

  const installApp = useCallback(async () => {
    if (!globalDeferredPrompt && !deferredPrompt) return false;
    const promptEvent = deferredPrompt || globalDeferredPrompt;
    try {
      promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      if (choiceResult?.outcome === 'accepted') {
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
        setIsInstalled(true);
        setShowBanner(false);
        notifyListeners();
        return true;
      }
      return false;
    } catch (err) {
      console.warn('PWA installation prompt failed:', err);
      return false;
    }
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
    isInstallable: !!deferredPrompt && !isInstalled,
    isInstalled,
    showBanner,
    installApp,
    dismissPrompt,
    recordPageView,
  };
};

export default usePWAInstall;
