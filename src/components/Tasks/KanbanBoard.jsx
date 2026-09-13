import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, Plus, Edit2, Trash2 } from 'lucide-react';
import { Loading03Icon, Delete01Icon } from 'hugeicons-react';

const STATUSES = [
  {
    id: "todo",
    label: "To-do",
    lightColor: "bg-purple-100 text-black",
    darkColor: "dark:bg-purple-900/50 dark:text-purple-300",
    dotColor: "bg-purple-500",
    countColor: "text-purple-600 dark:text-purple-400",
    columnLightBg: "bg-purple-50/50",
    columnDarkBg: "dark:bg-purple-900/10",
    buttonClass: "text-purple-600 dark:text-purple-400 border border-purple-600/5 dark:border-purple-400/5 hover:bg-purple-50 dark:hover:bg-purple-900/30",
  },
  {
    id: "in_progress",
    label: "In progress",
    lightColor: "bg-amber-100 text-black",
    darkColor: "dark:bg-amber-900/50 dark:text-amber-300",
    dotColor: "bg-amber-500",
    countColor: "text-amber-600 dark:text-amber-400",
    columnLightBg: "bg-amber-50/50",
    columnDarkBg: "dark:bg-amber-900/10",
    buttonClass: "text-amber-600 dark:text-amber-400 border border-amber-600/5 dark:border-amber-400/5 hover:bg-amber-50 dark:hover:bg-amber-900/30",
  },
  {
    id: "in_review",
    label: "In review",
    lightColor: "bg-blue-100 text-black",
    darkColor: "dark:bg-blue-900/50 dark:text-blue-300",
    dotColor: "bg-blue-500",
    countColor: "text-blue-600 dark:text-blue-400",
    columnLightBg: "bg-blue-50/50",
    columnDarkBg: "dark:bg-blue-900/10",
    buttonClass: "text-blue-600 dark:text-blue-400 border border-blue-600/5 dark:border-blue-400/5 hover:bg-blue-50 dark:hover:bg-blue-900/30",
  },
  {
    id: "completed",
    label: "Complete",
    lightColor: "bg-green-100 text-black",
    darkColor: "dark:bg-green-900/50 dark:text-green-300",
    dotColor: "bg-green-500",
    countColor: "text-green-600 dark:text-green-400",
    columnLightBg: "bg-green-50/50",
    columnDarkBg: "dark:bg-green-900/10",
    buttonClass: "text-green-600 dark:text-green-400 border border-green-600/5 dark:border-green-400/5 hover:bg-green-50 dark:hover:bg-green-900/30",
  },
];

const KanbanBoard = ({ tasks, onTaskUpdate, allowCreation = false, onCreateTask, onTaskEdit, onTaskDelete, isLoading = false }) => {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [addingTaskStatus, setAddingTaskStatus] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [activeTaskMenu, setActiveTaskMenu] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [isDraggingOverDelete, setIsDraggingOverDelete] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setActiveTaskMenu(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

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
              <Delete01Icon
                className={`w-7 h-7 transition-colors duration-300 ${
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
              <div key={colIdx} className="flex flex-col w-[280px] md:w-[300px] shrink-0 max-h-full rounded-[20px] p-3 bg-gray-50/50 dark:bg-[#1a1a1a]">
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
          const columnTasks = tasks.filter((t) => t.status === status.id);

          return (
            <motion.div
              key={status.id}
              className={`flex flex-col w-[280px] md:w-[300px] shrink-0 max-h-full rounded-[20px] p-3 ${status.columnLightBg} ${status.columnDarkBg}`}
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
                  className={`flex items-center px-2.5 py-1 rounded-full ${status.lightColor} ${status.darkColor}`}
                >
                  <div
                    className={`w-3 h-3 rounded-full mr-2 ${status.dotColor}`}
                  ></div>
                  <span className="text-[12px] font-semibold tracking-wide">
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
                  {columnTasks.map((task) => (
                    <motion.div
                      key={task._id || task.id}
                      id={`task-${task._id || task.id}`}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task._id || task.id)}
                      onDragEnd={(e) => handleDragEnd(e, task._id || task.id)}
                      className={`group bg-white dark:bg-[#1f1f1f] border border-gray-100 dark:border-white/5 rounded-[12px] p-3.5 cursor-grab active:cursor-grabbing transition-colors duration-200 flex flex-col gap-2 relative ${activeTaskMenu === (task._id || task.id) ? 'z-[100]' : 'z-10'}`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-[14px] leading-[1.4] font-medium text-gray-800 dark:text-gray-200 break-words">
                          {task.task || task.title}
                        </p>
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTaskMenu(activeTaskMenu === (task._id || task.id) ? null : (task._id || task.id));
                            }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-opacity p-0.5 rounded hover:bg-gray-100 dark:hover:bg-[#333]"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          
                          {activeTaskMenu === (task._id || task.id) && (
                            <div 
                              className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#202020] rounded-[10px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 dark:border-white/10 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setActiveTaskMenu(null);
                                    if (onTaskEdit) onTaskEdit(task);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13.5px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2c2c2c] transition-colors"
                                >
                                  <Edit2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                  <span className="font-medium">Edit task</span>
                                </button>
                                <div className="h-[1px] w-full bg-gray-50 dark:bg-white/5" />
                                <button
                                  onClick={() => {
                                    setActiveTaskMenu(null);
                                    if (onTaskDelete) onTaskDelete(task._id || task.id);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13.5px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 text-red-400 dark:text-red-400/80" />
                                  <span className="font-medium">Delete task</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Inline Task Input */}
                {allowCreation && addingTaskStatus === status.id && (
                  <form
                    onSubmit={handleCreateSubmit}
                    className="mt-2 bg-white dark:bg-[#1f1f1f] border border-blue-500 rounded-lg p-3.5 shadow-sm"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onBlur={handleCreateSubmit}
                      placeholder="Task title..."
                      className="w-full bg-transparent text-[14px] font-medium text-gray-800 dark:text-gray-200 outline-none placeholder:font-normal placeholder:text-gray-400"
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
                    <Plus className="w-4 h-4 mr-2" />
                    New task
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
    </>
  );
};

export default KanbanBoard;
