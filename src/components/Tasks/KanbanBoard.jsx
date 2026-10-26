import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, Edit03Icon } from '@hugeicons/core-free-icons';


const STATUSES = [
  {
    id: "todo",
    label: "To-do",
    pillClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
    dotColor: "bg-purple-500",
    countColor: "text-purple-600 dark:text-purple-400",
    columnLightBg: "bg-[#f7f7f6]",
    columnDarkBg: "dark:bg-[#191919]",
    buttonClass: "text-purple-600 dark:text-purple-400 border border-purple-600/10 dark:border-purple-400/10 hover:bg-purple-500/10",
  },
  {
    id: "in_progress",
    label: "In progress",
    pillClass: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    dotColor: "bg-amber-500",
    countColor: "text-amber-600 dark:text-amber-400",
    columnLightBg: "bg-[#f7f7f6]",
    columnDarkBg: "dark:bg-[#191919]",
    buttonClass: "text-amber-600 dark:text-amber-400 border border-amber-600/10 dark:border-amber-400/10 hover:bg-amber-500/10",
  },
  {
    id: "in_review",
    label: "In review",
    pillClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    dotColor: "bg-blue-500",
    countColor: "text-blue-600 dark:text-blue-400",
    columnLightBg: "bg-[#f7f7f6]",
    columnDarkBg: "dark:bg-[#191919]",
    buttonClass: "text-blue-600 dark:text-blue-400 border border-blue-600/10 dark:border-blue-400/10 hover:bg-blue-500/10",
  },
  {
    id: "completed",
    label: "Complete",
    pillClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dotColor: "bg-emerald-500",
    countColor: "text-emerald-600 dark:text-emerald-400",
    columnLightBg: "bg-[#f7f7f6]",
    columnDarkBg: "dark:bg-[#191919]",
    buttonClass: "text-emerald-600 dark:text-emerald-400 border border-emerald-600/10 dark:border-emerald-400/10 hover:bg-emerald-500/10",
  },
];

const KanbanBoard = ({ tasks, onTaskUpdate, allowCreation = false, onCreateTask, onTaskEdit, onTaskDelete, isLoading = false }) => {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [addingTaskStatus, setAddingTaskStatus] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [activeTaskMenu, setActiveTaskMenu] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [isDraggingOverDelete, setIsDraggingOverDelete] = useState(false);

  const tasksByStatus = useMemo(() => {
    const grouped = { todo: [], in_progress: [], in_review: [], completed: [] };
    if (!tasks || !Array.isArray(tasks)) return grouped;
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (grouped[t.status]) {
        grouped[t.status].push(t);
      } else {
        grouped.todo.push(t);
      }
    }
    return grouped;
  }, [tasks]);

  useEffect(() => {
    const handleClose = () => setActiveTaskMenu(null);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, []);

  const handleOpenTaskMenu = (e, task) => {
    e.stopPropagation();
    const taskId = task._id || task.id;
    if (activeTaskMenu?.taskId === taskId) {
      setActiveTaskMenu(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 180;
    const menuHeight = 88;

    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    let top = rect.bottom + 4;
    // If opening downwards would overflow screen bottom, flip above
    if (top + menuHeight > window.innerHeight - 10) {
      top = Math.max(10, rect.top - menuHeight - 4);
    }

    setActiveTaskMenu({
      taskId,
      task,
      top,
      left,
    });
  };

  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData("taskId", taskId);
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnd = (e) => {
    setDraggedTaskId(null);
    e.currentTarget.classList.remove('opacity-50');
  };

  const handleDragOver = (e, statusId) => {
    e.preventDefault(); // Necessary to allow dropping
    if (dragOverStatus !== statusId) setDragOverStatus(statusId);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOverStatus(null);
  };

  const handleDrop = (e, statusId) => {
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId && onTaskUpdate) {
      onTaskUpdate(taskId, statusId);
    }
    setDraggedTaskId(null);
    setDragOverStatus(null);
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !addingTaskStatus) {
      setAddingTaskStatus(null);
      return;
    }
    
    if (onCreateTask) {
      onCreateTask(newTaskTitle, addingTaskStatus);
    }
    setNewTaskTitle("");
    setAddingTaskStatus(null);
  };

  return (
    <>

      <AnimatePresence>
        {draggedTaskId && (
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.8 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto"
            onDragOver={(e) => {
              e.preventDefault();
              if (!isDraggingOverDelete) setIsDraggingOverDelete(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingOverDelete(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOverDelete(false);
              setDraggedTaskId(null);
              const taskId = e.dataTransfer.getData("taskId");
              if (taskId && onTaskDelete) {
                onTaskDelete(taskId);
              }
            }}
          >
            <div
              className={`flex items-center justify-center w-[68px] h-[68px] rounded-full shadow-2xl transition-all duration-300 ${
                isDraggingOverDelete
                  ? "bg-red-500 scale-125 shadow-red-500/40 border-2 border-red-400"
                  : "bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10"
              }`}
            >
              <HugeiconsIcon
                icon={Delete02Icon}
                size={30}
                className={`select-none transition-colors duration-300 ${
                  isDraggingOverDelete ? "text-white" : "text-red-500"
                }`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-transparent h-full w-full">
      <div className="flex h-full p-4 md:p-8 gap-4 md:gap-6 min-w-max items-start">
        {isLoading ? (
          <div className="flex w-full gap-6 px-1">
            {Array.from({ length: 3 }).map((_, colIdx) => (
              <div key={colIdx} className="flex flex-col w-[280px] md:w-[300px] shrink-0 max-h-full rounded-[16px] p-3 bg-[#f7f7f6] dark:bg-[#191919]">
                <div className="flex items-center justify-between mb-4 px-1 animate-pulse">
                   <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-gray-200/80 dark:bg-white/10" />
                      <div className="w-24 h-5 rounded-md bg-gray-200/80 dark:bg-white/10" />
                   </div>
                   <div className="w-6 h-4 rounded-full bg-gray-200/80 dark:bg-white/10" />
                </div>
                <div className="flex flex-col gap-2">
                   {Array.from({ length: colIdx === 1 ? 1 : 2 }).map((_, cardIdx) => (
                     <div key={cardIdx} className="bg-white dark:bg-[#202020] rounded-[16px] p-3.5 border border-gray-100 dark:border-[#2a2a2a] shadow-sm animate-pulse">
                       <div className="flex items-center gap-2 mb-3">
                         <div className="w-[18px] h-[18px] rounded-[4.5px] bg-gray-200/80 dark:bg-[#333] shrink-0" />
                         <div className="w-full h-4 rounded-md bg-gray-200/80 dark:bg-[#333]" />
                       </div>
                       <div className="w-2/3 h-3 rounded bg-gray-200/60 dark:bg-[#2a2a2a] mb-3 ml-6" />
                       <div className="w-20 h-5 rounded-md bg-gray-100 dark:bg-white/5" />
                     </div>
                   ))}
                </div>
              </div>
            ))}
          </div>
        ) : STATUSES.map((status) => {
          const columnTasks = tasksByStatus[status.id] || [];

          return (
            <motion.div
              key={status.id}
              className={`flex flex-col w-[280px] md:w-[300px] shrink-0 max-h-full rounded-[16px] p-3 ${status.columnLightBg} ${status.columnDarkBg}`}
              onDragOver={(e) => handleDragOver(e, status.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status.id)}
              animate={{
                scale: dragOverStatus === status.id ? 1.04 : 1,
                opacity: draggedTaskId ? (dragOverStatus === status.id ? 1 : 0.6) : 1
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              {/* Column Header */}
              <div className="flex items-center mb-4">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${status.pillClass}`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dotColor}`}
                  />
                  <span className="text-[11.5px] font-semibold tracking-wide">
                    {status.label}
                  </span>
                </div>
                <span className={`ml-3 text-[13px] font-semibold ${status.countColor}`}>
                  {columnTasks.length}
                </span>
              </div>

              {/* Task List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pb-2 flex flex-col gap-1.5">
                <AnimatePresence>
                  {columnTasks.map((task) => {
                    const taskId = task._id || task.id;
                    return (
                      <motion.div
                        key={taskId}
                        id={`task-${taskId}`}
                        layout={draggedTaskId === taskId ? taskId : false}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, taskId)}
                        onDragEnd={(e) => handleDragEnd(e, taskId)}
                        className={`group bg-white dark:bg-[#202020] border border-black/[0.06] dark:border-white/[0.07] rounded-[6px] px-3 py-1.5 cursor-grab active:cursor-grabbing transition-colors duration-200 flex flex-col relative ${activeTaskMenu === taskId ? 'z-[100]' : 'z-10'}`}
                      >
                        <div className="flex justify-between items-center gap-2 min-h-[22px]">
                          <p className="text-[14px] leading-[18px] font-medium text-[#2c2c2b] dark:text-[#f0efed] break-words">
                            {task.task || task.title}
                          </p>
                          <div className="relative shrink-0">
                            <button 
                              onClick={(e) => handleOpenTaskMenu(e, task)}
                              className={`opacity-0 group-hover:opacity-100 ${activeTaskMenu?.taskId === taskId ? 'opacity-100' : ''} text-[#7d7a75] hover:text-[#2c2c2b] dark:text-[#a19e99] dark:hover:text-[#f0efed] transition-opacity p-0.5 rounded-[4px] hover:bg-black/[0.031] dark:hover:bg-white/[0.055]`}
                              title="Task options"
                            >
                              <span className="material-symbols-outlined text-[16px] leading-none select-none">more_horiz</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Inline Task Input */}
                {allowCreation && addingTaskStatus === status.id && (
                  <form
                    onSubmit={handleCreateSubmit}
                    className="mt-1 bg-white dark:bg-[#1f1f1f] border border-blue-500 rounded-[8px] px-3 py-1 shadow-sm flex items-center min-h-[32px]"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onBlur={handleCreateSubmit}
                      placeholder="Task title..."
                      className="w-full bg-transparent text-[13.5px] leading-snug font-medium text-gray-800 dark:text-gray-200 outline-none placeholder:font-normal placeholder:text-gray-400"
                    />
                  </form>
                )}
              </div>

              {/* Add new task button */}
              {allowCreation && (
                <div className="mt-1">
                  <button
                    onClick={() => {
                      setAddingTaskStatus(status.id);
                      setNewTaskTitle("");
                    }}
                    className={`flex items-center text-[13px] font-medium w-full px-2 py-1.5 rounded-[8px] transition-colors ${status.buttonClass}`}
                  >
                    <span className="material-symbols-outlined text-[16px] mr-1.5 leading-none select-none">
                      assignment_add
                    </span>
                    New task
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>

      {activeTaskMenu && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[99998]"
            onClick={(e) => {
              e.stopPropagation();
              setActiveTaskMenu(null);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveTaskMenu(null);
            }}
          />
          <div 
            role="listbox"
            className="fixed z-[99999] w-[200px] bg-white dark:bg-[#202020] rounded-[6px] border border-[#f0efed] dark:border-[#2c2c2b] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] overflow-hidden p-1 select-none transition-all duration-160 ease-out animate-in fade-in"
            style={{
              top: activeTaskMenu.top,
              left: activeTaskMenu.left,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="option"
              onClick={() => {
                const task = activeTaskMenu.task;
                setActiveTaskMenu(null);
                if (onTaskEdit) onTaskEdit(task);
              }}
              className="w-full h-[30px] flex items-center gap-2 px-2 rounded-[4px] text-[14px] leading-[16.8px] font-normal text-[#2c2c2b] dark:text-[#f0efed] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] transition-colors cursor-pointer"
            >
              <div className="w-5 h-5 flex items-center justify-center text-[#7d7a75] dark:text-[#a19e99] shrink-0">
                <HugeiconsIcon icon={Edit03Icon} size={15} className="select-none" />
              </div>
              <span>Edit task</span>
            </button>
            <div className="h-px w-full bg-[#f0efed] dark:bg-[#2c2c2b] my-1" role="separator" />
            <button
              type="button"
              role="option"
              onClick={() => {
                const taskId = activeTaskMenu.task._id || activeTaskMenu.task.id;
                setActiveTaskMenu(null);
                if (onTaskDelete) onTaskDelete(taskId);
              }}
              className="w-full h-[30px] flex items-center gap-2 px-2 rounded-[4px] text-[14px] leading-[16.8px] font-normal text-[#eb5757] dark:text-[#ff7b72] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] transition-colors cursor-pointer"
            >
              <div className="w-5 h-5 flex items-center justify-center text-current shrink-0">
                <HugeiconsIcon icon={Delete02Icon} size={15} className="select-none" />
              </div>
              <span>Delete task</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default KanbanBoard;
