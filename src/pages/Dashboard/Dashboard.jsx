import React, { useState, useRef, useContext, useEffect, lazy, Suspense } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import { ChatContext } from '../../context/ChatContextDefinition';
import { motion, AnimatePresence } from 'framer-motion';

const AIChat = lazy(() => import('../../components/Chat/AIChat'));

const Dashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isRightChatOpen, setIsRightChatOpen, chatStartupMode, clearChat } = useContext(ChatContext);
  const isChatRoute = location.pathname === '/dashboard/chat';

  // Save current route for 'resume' mode
  useEffect(() => {
    if (location.pathname.startsWith('/dashboard/')) {
      if (location.pathname !== '/dashboard/chat') {
        localStorage.setItem('noema-last-page-route', location.pathname + location.search);
      }
      const mode = localStorage.getItem('noema-chat-startup-mode') || 'resume';
      if (mode === 'resume') {
        localStorage.setItem('noema-last-route', location.pathname + location.search);
      }
    }
  }, [location.pathname, location.search]);

  // Handle reload behavior: fresh reload on new page vs resume last state
  useEffect(() => {
    const mode = localStorage.getItem('noema-chat-startup-mode') || 'resume';
    try {
      const navEntries = performance.getEntriesByType?.('navigation');
      const isReload = navEntries?.[0]?.type === 'reload' || performance.navigation?.type === 1;

      if (isReload && mode === 'fresh') {
        clearChat();
        if (location.pathname !== '/dashboard/page/new') {
          navigate('/dashboard/page/new', { replace: true });
        }
      }
    } catch (err) {
      console.warn('Navigation check failed:', err);
    }
  }, []);


  // Resizable Right Chat Panel State (min: 320, max: 750, default: 440)
  const [rightPanelWidth, setRightPanelWidth] = useState(440);
  const isResizingRight = useRef(false);

  const handleMouseDownRight = (e) => {
    e.preventDefault();
    isResizingRight.current = true;
    document.addEventListener('mousemove', handleMouseMoveRight);
    document.addEventListener('mouseup', handleMouseUpRight);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseMoveRight = (e) => {
    if (!isResizingRight.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 320 && newWidth <= 750) {
      setRightPanelWidth(newWidth);
    }
  };

  const handleMouseUpRight = () => {
    isResizingRight.current = false;
    document.removeEventListener('mousemove', handleMouseMoveRight);
    document.removeEventListener('mouseup', handleMouseUpRight);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  };

  return (
    <div 
      className="flex h-screen w-screen overflow-hidden text-[var(--c-text-primary)] font-sans bg-[var(--c-surface)]"
    >
      <Sidebar />
      <main className="flex-1 h-full overflow-hidden flex flex-row">
        <div className="flex-1 h-full overflow-hidden flex flex-col">
          <Outlet />
        </div>
        
        {/* Right side chat panel when chat is shifted to sidebar */}
        <AnimatePresence>
          {!isChatRoute && isRightChatOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: rightPanelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full shrink-0 overflow-hidden relative flex flex-row border-l border-[var(--c-border-hairline)] bg-[var(--c-surface-elevated)]"
            >
              {/* Drag Handle on Left Edge of Right Panel */}
              <div
                onMouseDown={handleMouseDownRight}
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 transition-colors z-50"
                title="Drag to resize"
              />

              {/* Panel Content */}
              <div className="flex-1 h-full overflow-hidden">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full w-full">
                    <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-gray-800 dark:border-t-white rounded-full animate-spin" />
                  </div>
                }>
                  <AIChat isRightPanel={true} />
                </Suspense>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Action Button (FAB) — §6.7 & §7.5 measured */}
        {!isChatRoute && !isRightChatOpen && (
          <button
            onClick={() => setIsRightChatOpen(true)}
            aria-label="Open AI Assistant"
            title="Ask AI"
            className="fixed right-4 bottom-4 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer bg-white dark:bg-[#202020] text-[#2c2c2b] dark:text-[#f0efed] shadow-[0_0_0_1px_var(--c-border,#e6e5e3),0_4px_12px_-2px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_var(--c-border,#383836),0_4px_12px_-2px_rgba(0,0,0,0.2)] transition-transform duration-[250ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.06] z-50 group"
          >
            <span className="material-symbols-outlined text-[20px] leading-none select-none text-[#2383e2] dark:text-[#4fa7ff]">
              auto_awesome
            </span>
          </button>
        )}
      </main>
    </div>
  );
};

export const DashboardRoute = () => {
  return <Dashboard />;
};

export default Dashboard;
