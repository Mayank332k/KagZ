import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Loading03Icon } from 'hugeicons-react';
import useAsyncAction from '../../hooks/useAsyncAction';

const TaskEditModal = ({ isOpen, onClose, task, onSave }) => {
  const [taskText, setTaskText] = useState("");

  const { execute: runSave, isLoading, retryCount } = useAsyncAction(
    async () => {
      await onSave(taskText.trim());
      onClose();
    },
    { maxRetries: 3 }
  );

  useEffect(() => {
    if (task) {
      setTaskText(task.task || task.title || "");
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSave = () => {
    if (!taskText.trim() || taskText.trim() === (task.task || task.title) || isLoading) return;
    runSave();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={isLoading ? undefined : onClose}
    >
      <div
        className="bg-[#ffffff] dark:bg-[var(--color-dark-sidebar)] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden text-sm font-sans relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[var(--color-dark-border)]">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Edit Task</h2>
          <button 
            onClick={onClose} 
            disabled={isLoading}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-gray-500 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-2 flex flex-col gap-4">
          <textarea
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            disabled={isLoading}
            placeholder="What needs to be done?"
            className="w-full bg-transparent border-none p-0 text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-0 min-h-[160px] resize-none disabled:opacity-60"
            autoFocus
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex justify-end gap-5 items-center">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors font-medium text-[14px] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!taskText.trim() || taskText.trim() === (task.task || task.title) || isLoading}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors font-medium text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && <Loading03Icon className="w-4 h-4 animate-spin shrink-0" />}
            <span>{isLoading ? (retryCount > 0 ? `Retrying (${retryCount}/3)...` : 'Saving...') : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskEditModal;
