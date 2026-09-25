import React, { useState, useEffect } from "react";
import { Plus, ArrowLeft, Edit2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { taskBoardsAPI, tasksAPI } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import KanbanBoard from "../../components/Tasks/KanbanBoard";
import ActionModal from "../../components/UI/ActionModal";
import TaskEditModal from "../../components/Tasks/TaskEditModal";

const Tasks = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [boards, setBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [boardContextMenu, setBoardContextMenu] = useState(null);
  const [boardModal, setBoardModal] = useState({ isOpen: false, type: 'rename', board: null });

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [boardsRes, tasksRes] = await Promise.all([
          taskBoardsAPI.getBoards(),
          tasksAPI.getTasks()
        ]);
        
        if (boardsRes?.data?.boards) {
          setBoards(boardsRes.data.boards);
          if (boardsRes.data.boards.length > 0) {
            setActiveBoardId(boardsRes.data.boards[0]._id);
          }
        }
        if (tasksRes?.data?.tasks) {
          setTasks(tasksRes.data.tasks);
        }
      } catch (error) {
        console.error("Failed to fetch boards/tasks", error.response?.data || error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleTaskUpdate = async (taskId, targetStatusId) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((task) =>
        (task.id === taskId || task._id === taskId) ? { ...task, status: targetStatusId } : task,
      ),
    );

    try {
      await tasksAPI.updateTask(taskId, { status: targetStatusId });
    } catch (error) {
      console.error("Failed to update task status", error);
    }
  };

  const handleCreateTask = async (title, statusId) => {
    if (!title.trim() || !activeBoardId) return;
    
    const tempId = Date.now().toString();
    const newTask = {
      _id: tempId,
      id: tempId,
      task: title.trim(),
      title: title.trim(),
      status: statusId,
      boardId: activeBoardId
    };
    
    // Optimistic UI
    setTasks(prev => [...prev, newTask]);

    try {
      const res = await tasksAPI.createTask({
        task: title.trim(),
        boardId: activeBoardId,
        status: statusId
      });
      if (res?.data?.task) {
        setTasks(prev => prev.map(t => t._id === tempId || t.id === tempId ? { ...t, _id: res.data.task._id, id: res.data.task._id } : t));
      }
    } catch (error) {
      console.error("Failed to create task", error);
      // Remove failed task from UI
      setTasks(prev => prev.filter(t => t._id !== tempId && t.id !== tempId));
    }
  };

  const submitNewBoard = async () => {
    if (!newBoardName.trim()) {
      setIsCreatingBoard(false);
      setNewBoardName("");
      return;
    }

    try {
      const res = await taskBoardsAPI.createBoard({ name: newBoardName.trim() });
      if (res?.data?.board) {
        setBoards(prev => [...prev, res.data.board]);
        setActiveBoardId(res.data.board._id);
        showToast("Board created successfully", "success");
      }
    } catch (error) {
      console.error("Failed to create board", error);
      showToast("Failed to create board. Please try again.", "error");
    }
    setNewBoardName("");
    setIsCreatingBoard(false);
  };

  const handleBoardContextMenu = (e, board) => {
    e.preventDefault();
    setBoardContextMenu({
      x: e.clientX,
      y: e.clientY,
      board,
    });
  };

  const handleConfirmBoardModal = async (inputValue) => {
    if (!boardModal.board) return;

    if (boardModal.type === 'rename') {
      const newName = inputValue?.trim();
      if (!newName || newName === boardModal.board.name) {
        setBoardModal({ isOpen: false, type: 'rename', board: null });
        return;
      }
      try {
        const res = await taskBoardsAPI.renameBoard(boardModal.board._id, newName);
        if (res?.data?.board) {
          setBoards(prev => prev.map(b => b._id === boardModal.board._id ? res.data.board : b));
          showToast("Board renamed successfully", "success");
        }
      } catch (error) {
        console.error("Failed to rename board", error);
        showToast("Failed to rename board.", "error");
      }
    } else if (boardModal.type === 'delete') {
      try {
        await taskBoardsAPI.deleteBoard(boardModal.board._id);
        const remainingBoards = boards.filter(b => b._id !== boardModal.board._id);
        setBoards(remainingBoards);
        if (activeBoardId === boardModal.board._id) {
          setActiveBoardId(remainingBoards.length > 0 ? remainingBoards[0]._id : null);
        }
        showToast("Board deleted successfully", "success");
      } catch (error) {
        console.error("Failed to delete board", error);
        showToast("Failed to delete board.", "error");
      }
    }
    setBoardModal({ isOpen: false, type: 'rename', board: null });
  };

  const handleTaskEdit = (task) => {
    setTaskToEdit(task);
  };

  const handleSaveTaskEdit = async (newTitle) => {
    if (!taskToEdit || !newTitle) return;
    
    setTasks(prev => prev.map(t => (t._id === taskToEdit._id || t.id === taskToEdit.id) ? { ...t, task: newTitle, title: newTitle } : t));
    setTaskToEdit(null);
    try {
      await tasksAPI.updateTask(taskToEdit._id || taskToEdit.id, { task: newTitle });
    } catch (error) {
      console.error("Failed to update task", error);
    }
  };

  const handleTaskDelete = (taskId) => {
    setTaskToDelete(taskId);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    const taskId = taskToDelete;
    setTasks(prev => prev.filter(t => t._id !== taskId && t.id !== taskId));
    setTaskToDelete(null);
    try {
      await tasksAPI.deleteTask(taskId);
    } catch (error) {
      console.error("Failed to delete task", error);
    }
  };

  const displayTasks = tasks.filter(t => t.boardId === activeBoardId);

  return (
    <div className="flex flex-col w-full h-full bg-[#fbfbfa] dark:bg-[var(--color-dark-bg)]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-6 py-4 shrink-0 bg-white dark:bg-[#1a1a1a]">
        <div className="flex items-center gap-1.5 mr-4 overflow-x-auto custom-scrollbar pb-1">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center justify-center shrink-0 w-8 h-8 rounded-full text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors mr-2"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2]" />
          </button>
          {boards.map(board => (
            <button
              key={board._id}
              onClick={() => setActiveBoardId(board._id)}
              onContextMenu={(e) => handleBoardContextMenu(e, board)}
              className={`flex items-center px-3.5 py-1.5 rounded-full text-[14px] font-medium transition-colors whitespace-nowrap ${activeBoardId === board._id ? "bg-gray-100 dark:bg-[#2a2a2a] text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#222] hover:text-gray-800 dark:hover:text-gray-200"}`}
              title="Right-click to rename or delete"
            >
              {board.name}
            </button>
          ))}
          <AnimatePresence mode="popLayout">
            {isCreatingBoard ? (
              <motion.div 
                initial={{ width: 0, opacity: 0, scale: 0.8 }}
                animate={{ width: "auto", opacity: 1, scale: 1 }}
                exit={{ width: 0, opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="flex items-center px-3.5 py-1.5 rounded-full bg-gray-100 dark:bg-[#2a2a2a] ml-1 overflow-hidden origin-left"
              >
                <input 
                  type="text" 
                  autoFocus
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  onBlur={submitNewBoard}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitNewBoard();
                    if (e.key === 'Escape') {
                      setIsCreatingBoard(false);
                      setNewBoardName("");
                    }
                  }}
                  className="bg-transparent outline-none text-[14px] font-medium text-gray-900 dark:text-white w-24 placeholder:text-gray-400 placeholder:font-normal"
                  placeholder="Name..."
                />
              </motion.div>
            ) : (
              <motion.button 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setIsCreatingBoard(true)}
                className="flex items-center justify-center shrink-0 w-7 h-7 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#222] transition-colors ml-1"
              >
                <Plus className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>


      </div>

      {/* Board */}
      {!activeBoardId && !isLoading ? (
        <div className="flex w-full h-full items-center justify-center text-gray-500">
          No board selected. Please create or select a board.
        </div>
      ) : (
        <KanbanBoard 
          tasks={displayTasks}
          onTaskUpdate={handleTaskUpdate}
          onCreateTask={handleCreateTask}
          onTaskEdit={handleTaskEdit}
          onTaskDelete={handleTaskDelete}
          allowCreation={true}
          isLoading={isLoading}
        />
      )}

      <ActionModal
        isOpen={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        title="Delete Task"
        type="confirm"
        description="Are you sure you want to delete this task? This action cannot be undone."
        onConfirm={confirmDeleteTask}
        confirmText="Delete"
        cancelText="Cancel"
      />

      <ActionModal
        isOpen={boardModal.isOpen}
        onClose={() => setBoardModal({ isOpen: false, type: 'rename', board: null })}
        title={boardModal.type === 'rename' ? 'Rename Board' : 'Delete Board'}
        type={boardModal.type === 'rename' ? 'input' : 'confirm'}
        initialValue={boardModal.board?.name || ''}
        placeholder="Enter board name..."
        description={
          boardModal.type === 'delete'
            ? `Are you sure you want to delete "${boardModal.board?.name}" and all its tasks? This action cannot be undone.`
            : ''
        }
        isDanger={boardModal.type === 'delete'}
        confirmText={boardModal.type === 'rename' ? 'Save' : 'Delete'}
        cancelText="Cancel"
        onConfirm={handleConfirmBoardModal}
      />

      {boardContextMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setBoardContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setBoardContextMenu(null); }}
          />
          <div 
            className="fixed z-50 w-44 bg-white dark:bg-[#202020] rounded-[10px] shadow-[0_8px_30px_rgb(0,0,0,0.18)] border border-gray-100 dark:border-white/10 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: Math.min(boardContextMenu.y, window.innerHeight - 100),
              left: Math.min(boardContextMenu.x, window.innerWidth - 190)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                const targetBoard = boardContextMenu.board;
                setBoardContextMenu(null);
                setBoardModal({ isOpen: true, type: 'rename', board: targetBoard });
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2c2c2c] transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span>Rename board</span>
            </button>
            <div className="h-[1px] w-full bg-gray-50 dark:bg-white/5 my-0.5" />
            <button
              onClick={() => {
                const targetBoard = boardContextMenu.board;
                setBoardContextMenu(null);
                setBoardModal({ isOpen: true, type: 'delete', board: targetBoard });
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400 dark:text-red-400/80" />
              <span>Delete board</span>
            </button>
          </div>
        </>
      )}

      <TaskEditModal
        isOpen={!!taskToEdit}
        onClose={() => setTaskToEdit(null)}
        task={taskToEdit}
        onSave={handleSaveTaskEdit}
      />
    </div>
  );
};

export default Tasks;
