import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CodeFolderIcon, TextIcon } from 'hugeicons-react';

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

  useEffect(() => {
    if (isOpen) {
      setInputValue(initialValue);
      setSelectedPageType('document'); // reset on open
      // Slight delay to ensure element is mounted before focusing
      setTimeout(() => {
        inputRef.current?.focus();
        if (type === 'input') {
          inputRef.current?.select();
        }
      }, 100);
    }
  }, [isOpen, initialValue, type]);

  const handleConfirm = async () => {
    if ((type === 'input' && !inputValue.trim()) || confirmDisabled) return;
    const result = await onConfirm(type === 'input' ? inputValue.trim() : null, selectedPageType);
    if (result !== false) onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center font-sans">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          
          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="relative w-[19rem] bg-[rgb(255,255,255)] dark:bg-[var(--color-dark-surface)] rounded-[15px] shadow-2xl border border-gray-200 dark:border-[var(--color-dark-border)] overflow-hidden"
          >
            <div className="p-4">
              <h3 className="text-[17px] font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
              {description && <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-snug">{description}</p>}
              
              {type === 'input' && (
                <div className="mt-4 flex flex-col gap-4">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[var(--color-dark-border)] rounded-lg px-3 py-2 text-[15px] outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#202020] focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 dark:text-gray-100"
                  />

                  {showPageTypeSelector && (
                    <div className="flex items-center bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[var(--color-dark-border)] rounded-lg p-1">
                      <button 
                        onClick={() => setSelectedPageType('document')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${selectedPageType === 'document' ? 'bg-white dark:bg-[#262626] shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                      >
                        <TextIcon className="w-4 h-4" /> Document
                      </button>
                      <button 
                        onClick={() => setSelectedPageType('code')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${selectedPageType === 'code' ? 'bg-white dark:bg-[#262626] shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                      >
                        <CodeFolderIcon className="w-4 h-4" /> Code
                      </button>
                    </div>
                  )}

                  {locationSelector}
                </div>
              )}
            </div>
            
            <div className="px-4 pb-4 pt-1 flex flex-col gap-2">
              <button
                onClick={handleConfirm}
                disabled={(type === 'input' && !inputValue.trim()) || confirmDisabled}
                className={`w-full px-4 py-2 text-[14px] font-medium text-white rounded-[8px] transition-all
                  ${isDanger 
                    ? 'bg-[rgb(216,57,51)] hover:opacity-90 focus:ring-2 focus:ring-[rgba(216,57,51,0.2)]' 
                    : 'bg-black dark:bg-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20'}
                  disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center`}
              >
                {confirmText}
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 text-[14px] font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-transparent border border-gray-200 dark:border-[var(--color-dark-border)] hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 rounded-[8px] transition-colors"
              >
                {cancelText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ActionModal;
