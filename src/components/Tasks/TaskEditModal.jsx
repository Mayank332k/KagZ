import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

const TaskEditModal = ({ isOpen, onClose, task, onSave }) => {
  const [taskText, setTaskText] = useState("");

  useEffect(() => {
    if (task) {
      setTaskText(task.task || task.title || "");
    }
  }, [task]);

  if (!isOpen || !task) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
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
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-2 flex flex-col gap-4">
          <textarea
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full bg-transparent border-none p-0 text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-0 min-h-[160px] resize-none"
            autoFocus
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex justify-end gap-5">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors font-medium text-[14px]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(taskText.trim())}
            disabled={!taskText.trim() || taskText.trim() === (task.task || task.title)}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors font-medium text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskEditModal;
