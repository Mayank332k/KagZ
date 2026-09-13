import React, { useState, useRef, useContext } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import AIChat from '../../components/Chat/AIChat';
import { ChatContext } from '../../context/ChatContext';
import { motion, AnimatePresence } from 'framer-motion';

const Dashboard = () => {
  const location = useLocation();
  const { isRightChatOpen } = useContext(ChatContext);
  const isChatRoute = location.pathname === '/dashboard/chat';

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
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-noema-bg)] dark:bg-[var(--color-dark-bg)] text-gray-800 dark:text-gray-200 font-sans">
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
              className="h-full shrink-0 overflow-hidden relative flex flex-row border-l border-gray-200/80 dark:border-[var(--color-dark-border)] bg-white dark:bg-[var(--color-dark-bg)]"
            >
              {/* Drag Handle on Left Edge of Right Panel */}
              <div
                onMouseDown={handleMouseDownRight}
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 transition-colors z-50"
                title="Drag to resize"
              />

              {/* Panel Content */}
              <div className="flex-1 h-full overflow-hidden">
                <AIChat isRightPanel={true} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Dashboard;
