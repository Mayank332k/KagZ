import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Alert02Icon, Tick02Icon, InformationCircleIcon } from 'hugeicons-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 2000) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3 pointer-events-none">
          <AnimatePresence>
            {toasts.map(toast => (
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
    </ToastContext.Provider>
  );
};
