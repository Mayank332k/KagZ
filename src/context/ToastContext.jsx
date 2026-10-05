import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Alert02Icon, Tick02Icon, InformationCircleIcon } from 'hugeicons-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 2000, options = {}) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const position = options.position || (options.center ? 'center' : 'bottom-right');
    setToasts(prev => [...prev, { id, message, type, position, ...options }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const bottomToasts = toasts.filter(t => t.position !== 'center');
  const centerToasts = toasts.filter(t => t.position === 'center');

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Bottom Right Toasts */}
      {createPortal(
        <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3 pointer-events-none">
          <AnimatePresence>
            {bottomToasts.map(toast => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={() => dismissToast(toast.id)}
                className={`
                  pointer-events-auto cursor-pointer select-none
                  flex items-center gap-3 px-4 py-3 rounded-[12px] shadow-lg
                  backdrop-blur-xl border
                  transition-colors duration-150
                  ${toast.type === 'error' 
                    ? 'bg-red-500/10 border-red-500/20 text-red-500 dark:bg-red-500/15 dark:text-red-400' 
                    : toast.type === 'success'
                    ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:bg-green-500/15 dark:text-green-400'
                    : 'bg-white/80 border-gray-200 text-gray-700 dark:bg-[#232323]/90 dark:border-[var(--color-dark-border)] dark:text-gray-200'
                  }
                `}
                style={{ minWidth: '280px' }}
                title="Click to dismiss"
              >
                {toast.type === 'error' && <Alert02Icon className="w-5 h-5 shrink-0" />}
                {toast.type === 'success' && <Tick02Icon className="w-5 h-5 shrink-0" />}
                {toast.type === 'info' && <InformationCircleIcon className="w-5 h-5 shrink-0" />}
                
                <span className="text-[14px] font-medium tracking-wide">
                  {toast.message}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body
      )}

      {/* Ultra-minimal Center Toasts (e.g., delete confirmation / delete errors) */}
      {createPortal(
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100000] pointer-events-none flex flex-col items-center gap-2">
          <AnimatePresence>
            {centerToasts.map(toast => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, scale: 0.88, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -6 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                onClick={() => dismissToast(toast.id)}
                className={`
                  pointer-events-auto cursor-pointer select-none
                  flex items-center gap-2.5 px-4 py-2 rounded-full shadow-2xl
                  backdrop-blur-2xl border text-[13px] font-medium tracking-wide
                  ${toast.type === 'error'
                    ? 'bg-neutral-900/90 dark:bg-[#181818]/95 text-red-400 border-red-500/25 shadow-red-950/20'
                    : toast.type === 'success'
                    ? 'bg-neutral-900/90 dark:bg-[#181818]/95 text-emerald-400 border-emerald-500/25 shadow-emerald-950/20'
                    : 'bg-neutral-900/90 dark:bg-[#181818]/95 text-neutral-100 border-white/10 shadow-black/30'
                  }
                `}
                title="Click to dismiss"
              >
                {toast.type === 'error' && (
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
                )}
                {toast.type === 'success' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
                )}
                {toast.type !== 'error' && toast.type !== 'success' && (
                  <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0 shadow-[0_0_8px_rgba(56,189,248,0.7)]" />
                )}
                <span>{toast.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};
