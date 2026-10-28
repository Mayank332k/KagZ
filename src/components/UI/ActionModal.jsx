import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loading03Icon } from 'hugeicons-react';
import useAsyncAction from '../../hooks/useAsyncAction';

const ActionModal = ({
  isOpen,
  onClose,
  title,
  type = 'input', // 'input' or 'confirm'
  initialValue = '',
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  placeholder = 'Enter value...',
  description = '',
  showPageTypeSelector = false,
  locationSelector = null,
  confirmDisabled = false
}) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const [selectedPageType, setSelectedPageType] = useState('document');
  const inputRef = useRef(null);

  const { execute: runConfirm, isLoading, retryCount } = useAsyncAction(
    async () => {
      const result = await onConfirm(type === 'input' ? inputValue.trim() : null, selectedPageType);
      if (result !== false) {
        onClose();
      }
    },
    { maxRetries: 3 }
  );

  useEffect(() => {
    if (isOpen) {
      setInputValue(initialValue);
      setSelectedPageType('document'); // reset on open
      setTimeout(() => {
        inputRef.current?.focus();
        if (type === 'input') {
          inputRef.current?.select();
        }
      }, 50);
    }
  }, [isOpen, initialValue, type]);

  const handleConfirm = () => {
    if ((type === 'input' && !inputValue.trim()) || confirmDisabled || isLoading) return;
    runConfirm();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape' && !isLoading) onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center font-sans p-4">
          {/* Backdrop Scrim (§5: --c-scrim: 0.6 light / 0.8 dark) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-[2px]"
            onClick={isLoading ? undefined : onClose}
          />
          
          {/* Modal Container (§3: 16px radius, --shadow-pop-md, 160ms ease-out) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="relative w-[360px] max-w-[calc(100vw-32px)] bg-white dark:bg-[#202020] rounded-[16px] border border-[#f0efed] dark:border-[#2c2c2b] shadow-[0_14px_28px_-6px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_14px_28px_-6px_rgba(0,0,0,0.4),0_2px_4px_-1px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.06)] overflow-hidden select-none"
          >
            <div className="p-5 pb-4">
              <h3 className="text-[16px] leading-[22px] font-semibold text-[#2c2c2b] dark:text-[#f0efed] tracking-tight">
                {title}
              </h3>
              
              {description && (
                <p className="text-[14px] leading-[20px] text-[#7d7a75] dark:text-[#ada9a3] mt-1.5 font-normal">
                  {description}
                </p>
              )}
              
              {type === 'input' && (
                <div className="mt-3.5 flex flex-col gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full h-8 px-2.5 rounded-[6px] text-[14px] leading-[16.8px] bg-[#f4f3f3] dark:bg-[#262626] border border-[#e6e5e3] dark:border-[#383836] text-[#2c2c2b] dark:text-[#f0efed] placeholder-[#a19e99] dark:placeholder-[#7d7a75] outline-none focus:border-[#2383e2] dark:focus:border-[#4fa7ff] focus:ring-2 focus:ring-[#2383e2]/25 transition-all"
                  />

                  {showPageTypeSelector && (
                    <div className="flex items-center bg-[#f4f3f3] dark:bg-[#262626] border border-[#e6e5e3] dark:border-[#383836] rounded-[6px] p-0.5">
                      <button 
                        type="button"
                        onClick={() => setSelectedPageType('document')}
                        className={`flex-1 h-7 flex items-center justify-center gap-1.5 rounded-[4px] text-[13px] font-medium transition-colors cursor-pointer ${
                          selectedPageType === 'document' 
                            ? 'bg-white dark:bg-[#202020] shadow-sm text-[#2c2c2b] dark:text-[#f0efed]' 
                            : 'text-[#7d7a75] dark:text-[#ada9a3] hover:text-[#2c2c2b] dark:hover:text-[#f0efed]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px] leading-none select-none">description</span>
                        <span>Document</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setSelectedPageType('code')}
                        className={`flex-1 h-7 flex items-center justify-center gap-1.5 rounded-[4px] text-[13px] font-medium transition-colors cursor-pointer ${
                          selectedPageType === 'code' 
                            ? 'bg-white dark:bg-[#202020] shadow-sm text-[#2c2c2b] dark:text-[#f0efed]' 
                            : 'text-[#7d7a75] dark:text-[#ada9a3] hover:text-[#2c2c2b] dark:hover:text-[#f0efed]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px] leading-none select-none">code</span>
                        <span>Code</span>
                      </button>
                    </div>
                  )}

                  {locationSelector}
                </div>
              )}
            </div>
            
            {/* Footer Buttons — 32px height, 6px radius (§3) */}
            <div className="px-5 pb-5 pt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="h-8 px-3.5 rounded-[6px] text-[14px] leading-[16.8px] font-normal text-[#2c2c2b] dark:text-[#f0efed] border border-[#e6e5e3] dark:border-[#383836] bg-transparent hover:bg-black/[0.031] dark:hover:bg-white/[0.055] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {cancelText}
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={(type === 'input' && !inputValue.trim()) || confirmDisabled || isLoading}
                className={`h-8 px-3.5 rounded-[6px] text-[14px] leading-[16.8px] font-medium text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDanger 
                    ? 'bg-[#eb5757] hover:bg-[#d83933] active:scale-[0.98]' 
                    : 'bg-[#2383e2] hover:bg-[#105fad] active:scale-[0.98]'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loading03Icon className="w-4 h-4 animate-spin shrink-0" />
                    <span>{retryCount > 0 ? `Retrying (${retryCount}/3)...` : confirmText}</span>
                  </>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ActionModal;
