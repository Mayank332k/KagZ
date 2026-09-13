import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Alert02Icon, Tick02Icon, InformationCircleIcon } from 'hugeicons-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3 pointer-events-none">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`
                pointer-events-auto
                flex items-center gap-3 px-4 py-3 rounded-[12px] shadow-lg
                backdrop-blur-xl border
                transform transition-all duration-300 animate-slide-in-right
                ${toast.type === 'error' 
                  ? 'bg-red-500/10 border-red-500/20 text-red-500 dark:bg-red-500/15 dark:text-red-400' 
                  : toast.type === 'success'
                  ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:bg-green-500/15 dark:text-green-400'
                  : 'bg-white/80 border-gray-200 text-gray-700 dark:bg-[#232323]/90 dark:border-[var(--color-dark-border)] dark:text-gray-200'
                }
              `}
              style={{ minWidth: '280px' }}
            >
              {toast.type === 'error' && <Alert02Icon className="w-5 h-5 shrink-0" />}
              {toast.type === 'success' && <Tick02Icon className="w-5 h-5 shrink-0" />}
              {toast.type === 'info' && <InformationCircleIcon className="w-5 h-5 shrink-0" />}
              
              <span className="text-[14px] font-medium tracking-wide">
                {toast.message}
              </span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};
