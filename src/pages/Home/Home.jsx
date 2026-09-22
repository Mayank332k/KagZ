import React, { useState, useEffect, useContext, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Plus, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import { ArtboardToolIcon, NotebookIcon, AppleReminderIcon, Time02Icon, Folder01Icon, DashboardSquare02Icon } from 'hugeicons-react';
import ActionModal from '../../components/UI/ActionModal';
import { workspacesAPI, pagesAPI, tasksAPI, foldersAPI } from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import KanbanBoard from '../../components/Tasks/KanbanBoard';


const getIcon = (type) => {
  if (type === 'workspace') return ArtboardToolIcon;
  if (type === 'code') return AppleReminderIcon;
  if (type === 'todo') return AppleReminderIcon;
  return NotebookIcon;
};


const SkeletonWorkspaceCard = () => (
  <div className="flex flex-col p-5 bg-white dark:bg-[#151515] border border-gray-200/80 dark:border-white/5 rounded-[16px] h-[260px] relative overflow-hidden shadow-sm dark:shadow-none">
    {/* Top: Icon + Name */}
    <div className="flex items-center gap-3.5 mb-4 animate-pulse">
      <div className="w-[42px] h-[42px] rounded-xl bg-gray-200/60 dark:bg-white/10 shrink-0" />
      <div className="h-5 w-32 bg-gray-200/60 dark:bg-white/10 rounded-md" />
    </div>

    {/* Tags: Pages + Date */}
    <div className="flex items-center gap-2.5 mb-6 animate-pulse">
      <div className="h-7 w-20 bg-gray-100 dark:bg-white/5 rounded-lg" />
      <div className="h-7 w-24 bg-gray-100 dark:bg-white/5 rounded-lg" />
    </div>

    {/* Contents List */}
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3 animate-pulse opacity-100">
        <div className="w-[18px] h-[18px] bg-gray-200/60 dark:bg-white/10 rounded-md shrink-0" />
        <div className="h-4 w-40 bg-gray-200/60 dark:bg-white/10 rounded" />
      </div>
      <div className="flex items-center gap-3 animate-pulse opacity-75">
        <div className="w-[18px] h-[18px] bg-gray-200/60 dark:bg-white/10 rounded-md shrink-0 ml-[18px]" />
        <div className="h-4 w-32 bg-gray-200/60 dark:bg-white/10 rounded" />
      </div>
      <div className="flex items-center gap-3 animate-pulse opacity-50">
        <div className="w-[18px] h-[18px] bg-gray-200/60 dark:bg-white/10 rounded-md shrink-0 ml-[18px]" />
        <div className="h-4 w-28 bg-gray-200/60 dark:bg-white/10 rounded" />
      </div>
    </div>
  </div>
);

const Home = () => {

  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [workspaces, setWorkspaces] = useState([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);


  const [activeMenu, setActiveMenu] = useState(null);
  const [modalState, setModalState] = useState({
    isOpen: false,
    action: null,
    item: null,
    type: null
  });
  const [taskToEdit, setTaskToEdit] = useState(null);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await workspacesAPI.getAll();
        const wsList = res.data.workspaces || [];
        
        // Fetch page counts and top items for workspaces
        const withCounts = await Promise.all(wsList.map(async (ws) => {
          try {
            const [pageRes, folderRes] = await Promise.all([
              pagesAPI.getByWorkspace(ws._id),
              foldersAPI.getByWorkspace(ws._id).catch(() => ({ data: { folders: [] } }))
            ]);
            
            const pages = pageRes.data.pages || [];
            const folders = folderRes.data.folders || [];
            
            const buildTree = (parentId = null, depth = 0) => {
              const childFolders = folders
                .filter((f) => f.parentId === parentId)
                .map((f) => ({ _id: f._id, type: 'folder', name: f.name, depth }));

              const childPages = pages
                .filter((p) => p.folderId === parentId)
                .map((p) => ({ _id: p._id, type: p.type || 'page', name: p.title, depth }));

              const combined = [...childFolders, ...childPages].sort((a, b) => {
                if (a.type === "folder" && b.type !== "folder") return -1;
                if (a.type !== "folder" && b.type === "folder") return 1;
                return (a.name || "").localeCompare(b.name || "");
              });
              
              let result = [];
              for (const item of combined) {
                result.push(item);
                if (item.type === "folder") {
                  result = result.concat(buildTree(item._id, depth + 1));
                }
              }
              return result;
            };
            
            const flatTree = buildTree(null);
            const allItems = flatTree.slice(0, 3);
            
            return { 
              ...ws, 
              pagesCount: pages.length, 
              foldersCount: folders.length,
              topItems: allItems 
            };
          } catch {
            return { ...ws, pagesCount: 0, foldersCount: 0, topItems: [] };
          }
        }));
        
        setWorkspaces(withCounts);
      } catch {
        setWorkspaces([]);
      } finally {
        setWorkspacesLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const res = await tasksAPI.getTasks();
        if (res?.data?.tasks) {
          setTasks(res.data.tasks);
        }
      } catch (error) {
        console.error("Failed to fetch tasks", error);
      } finally {
        setTasksLoading(false);
      }
    };
    loadTasks();
  }, []);

  const handleTaskUpdate = async (taskId, targetStatusId) => {
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

  const handleTaskEdit = (task) => {
    setTaskToEdit(task);
  };



  const handleTaskDelete = (taskId) => {
    setModalState({ isOpen: true, action: 'DELETE', item: { _id: taskId }, type: 'task' });
  };

  const handleAddWorkspace = async (name) => {
    if (!name) return;
    try {
      const res = await workspacesAPI.create(name);
      if (res.data.success) {
        setWorkspaces((prev) => [...prev, { ...res.data.workspace, pagesCount: 0 }]);
      }
    } catch {
      // silent fail
    }
  };

  const handleModalConfirm = async (val) => {
    if (!modalState.item) return;
    const { action, item, type } = modalState;
    try {
      if (type === 'workspace') {
        if (action === 'RENAME' && val) {
          await workspacesAPI.update(item._id, { name: val });
          setWorkspaces(prev => prev.map(w => w._id === item._id ? { ...w, name: val } : w));
        } else if (action === 'DELETE') {
          await workspacesAPI.delete(item._id);
          setWorkspaces(prev => prev.filter(w => w._id !== item._id));
        }
      } else if (type === 'task') {
        if (action === 'DELETE') {
          setTasks(prev => prev.filter(t => t._id !== item._id && t.id !== item._id));
          await tasksAPI.deleteTask(item._id);
        }
      }
    } catch (err) {
      console.error(err);
    }
    setModalState({ isOpen: false, action: null, item: null, type: null });
  };



  const timeAgo = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);
    if (diffSec < 60) return 'Edited just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Edited ${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Edited ${diffHr} hr${diffHr === 1 ? '' : 's'} ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `Edited ${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
    const diffWeek = Math.floor(diffDay / 7);
    if (diffWeek < 4) return `Edited ${diffWeek} week${diffWeek === 1 ? '' : 's'} ago`;
    return `Edited ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = (user?.username || user?.name || 'User').split(' ')[0];

  const getColorClasses = (idx) => {
    const colors = [
      'text-[#4F7CFA]', // blue
      'text-[#F97017]', // orange
      'text-[#16A34A]', // green
      'text-[#C026D3]', // purple
      'text-[#E11D48]', // rose
    ];
    return colors[idx % colors.length];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-1 h-full overflow-y-auto px-4 md:px-8 lg:px-12 py-6 md:py-10 bg-[#FAFAFA] dark:bg-[var(--color-dark-bg)] text-gray-900 dark:text-gray-100 transition-colors"
    >
      <div className="w-full">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 md:mb-8 gap-4 md:gap-0">
          <div>
            <h1 className="text-[24px] md:text-[32px] font-bold tracking-tight flex items-center gap-2">
              <span className="text-black dark:text-white">
                {getGreeting()}, {firstName}
              </span>
              <span className="text-2xl md:text-3xl origin-bottom-right hover:animate-wave inline-block cursor-default">👋</span>
            </h1>
            <p className="text-[15px] text-gray-500 mt-2">Here's what's happening in your workspace.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#0F0F0F] dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2.5 rounded-lg text-[14px] font-medium hover:bg-black dark:hover:bg-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            New workspace
          </button>
        </div>

        <hr className="border-gray-200/60 mb-8" />

        {/* TASK OVERVIEW SECTION */}
        <section className="mb-10 relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <DashboardSquare02Icon className="w-[26px] h-[26px] stroke-[2]" />
              <h2 className="text-[16px] md:text-[17px] font-semibold">Task Overview</h2>
            </div>
            <button 
              onClick={() => navigate('/dashboard/tasks')}
              className="text-[14px] font-medium text-gray-400 hover:text-gray-800 transition-colors flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 group"
              title="Go to Tasks"
            >
              <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="w-full -mx-4 px-4 md:-mx-8 md:px-8">
            <KanbanBoard 
              tasks={tasks}
              onTaskUpdate={handleTaskUpdate}
              onTaskEdit={handleTaskEdit}
              onTaskDelete={handleTaskDelete}
              allowCreation={false}
              isLoading={tasksLoading}
            />
          </div>
        </section>

        <hr className="border-gray-200/60 mb-8" />

        {/* WORKSPACES SECTION */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Folder01Icon className="w-[26px] h-[26px] stroke-[2]" />
              <h2 className="text-[16px] md:text-[17px] font-semibold">Workspaces</h2>
            </div>
            <button className="text-[14px] font-medium text-gray-400 hover:text-gray-800 transition-colors flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 group">
              <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Create New Workspace Card */}
            <div
              onClick={() => setShowModal(true)}
              className="flex flex-col items-center justify-center p-5 bg-[#FAFAFA] dark:bg-[var(--color-dark-surface)] border-2 border-dashed border-gray-200/80 dark:border-gray-700 rounded-[16px] cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-[#202020] transition-colors h-[260px]"
            >
              <div className="w-10 h-10 flex items-center justify-center mb-1">
                <Plus className="w-6 h-6 text-gray-500 stroke-[1.5]" />
              </div>
              <span className="text-[14.5px] font-semibold text-gray-900 dark:text-gray-100">New workspace</span>
              <span className="text-[13px] text-gray-500 mt-1 font-medium">Create a new workspace</span>
            </div>

            {workspacesLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonWorkspaceCard key={i} />
                ))
              : workspaces.map((workspace, idx) => {
                  const colorClass = getColorClasses(idx);
                  
                  return (
                    <div
                      key={workspace._id}
                      onClick={() => navigate(`/dashboard/workspace/${workspace._id}`)}
                      className="flex flex-col p-5 bg-white dark:bg-[#151515] border border-gray-200/80 dark:border-white/5 rounded-[16px] cursor-pointer hover:border-gray-300 dark:hover:border-white/10 transition-colors h-[260px] group relative overflow-hidden shadow-sm dark:shadow-none"
                    >
                      {/* Top: Icon + Name */}
                      <div className="flex items-center gap-3.5 mb-4">
                        <div className={`flex items-center justify-center ${colorClass}`}>
                          <ArtboardToolIcon className="w-[26px] h-[26px] stroke-[2.5]" />
                        </div>
                        <h3 className="text-[20px] font-bold text-gray-900 dark:text-gray-100 tracking-tight truncate pr-8">
                          {workspace.name}
                        </h3>
                      </div>

                      {/* Tags: Pages + Date */}
                      <div className="flex items-center gap-2.5 mb-6">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-[13px] font-medium">
                          <NotebookIcon className="w-4 h-4" />
                          <span>{workspace.pagesCount === 1 ? '1 page' : `${workspace.pagesCount} pages`}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-[13px] font-medium">
                          <Time02Icon className="w-4 h-4" />
                          <span>{timeAgo(workspace.updatedAt)}</span>
                        </div>
                      </div>

                      {/* Contents List */}
                      <div className="flex flex-col gap-3.5">
                        {workspace.topItems && workspace.topItems.length > 0 ? (
                          <>
                            {workspace.topItems.map((item) => {
                              const Icon = item.type === 'folder' ? Folder01Icon : getIcon(item.type);
                              return (
                                <div 
                                  key={item._id} 
                                  className="flex items-center gap-3 text-[15px] text-gray-800 dark:text-gray-200 font-medium group/item relative"
                                  style={{ marginLeft: `${item.depth * 18}px` }}
                                >
                                  {item.depth > 0 && (
                                    <div className="absolute -left-3 top-[50%] w-2 h-[1.5px] bg-gray-200 dark:bg-gray-600"></div>
                                  )}
                                  <Icon className={`w-[18px] h-[18px] stroke-[2] shrink-0 ${item.type === 'folder' ? 'text-blue-500' : 'text-gray-400'}`} />
                                  <span className="truncate">{item.name}</span>
                                </div>
                              );
                            })}
                            {(workspace.pagesCount + (workspace.foldersCount || 0)) > 3 && (
                              <div className="flex items-center gap-2 mt-1 pl-1 text-[13.5px] text-gray-500 dark:text-gray-500">
                                <span className="w-1 h-1 rounded-full bg-gray-500"></span>
                                <span>+ {(workspace.pagesCount + (workspace.foldersCount || 0)) - 3} more items</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center text-[14px] text-gray-400 mt-2">
                            Empty workspace
                          </div>
                        )}
                      </div>

                      {/* More Menu (Absolute top right) */}
                      <div className="absolute top-4 right-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(activeMenu === workspace._id ? null : workspace._id);
                          }}
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-[#2c2c2c] transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        
                        {activeMenu === workspace._id && (
                          <div 
                            className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#202020] rounded-[10px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 dark:border-[var(--color-dark-border)] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  setActiveMenu(null);
                                  setModalState({ isOpen: true, action: 'RENAME', item: workspace, type: 'workspace' });
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2c2c2c] transition-colors"
                              >
                                <Edit2 className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">Rename</span>
                              </button>
                              <div className="h-[1px] w-full bg-gray-50 dark:bg-white/5" />
                              <button
                                onClick={() => {
                                  setActiveMenu(null);
                                  setModalState({ isOpen: true, action: 'DELETE', item: workspace, type: 'workspace' });
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                                <span className="font-medium">Delete</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
          </div>
        </section>

      </div>

      <ActionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="New Workspace"
        type="input"
        onConfirm={handleAddWorkspace}
        confirmText="Create"
        cancelText="Cancel"
        placeholder="Workspace Name"
      />

      <ActionModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, action: null, item: null, type: null })}
        title={modalState.action === 'DELETE' ? 'Delete' : 'Rename'}
        type={modalState.action === 'DELETE' ? 'confirm' : 'input'}
        onConfirm={handleModalConfirm}
        confirmText={modalState.action === 'DELETE' ? 'Delete' : 'Save'}
        cancelText="Cancel"
        placeholder={modalState.action === 'RENAME' ? 'New name' : ''}
        initialValue={modalState.action === 'RENAME' ? (modalState.item?.name || modalState.item?.title) : ''}
        description={
          modalState.action === 'DELETE'
            ? `Are you sure you want to delete this ${modalState.type}? This action cannot be undone.`
            : null
        }
      />
    </motion.div>
  );
};

export default Home;
