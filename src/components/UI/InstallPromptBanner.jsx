import { motion } from 'framer-motion';
import { Download, X } from 'lucide-react';

const InstallPromptBanner = ({ onInstall, onDismiss, style = {} }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={style}
      className="fixed z-[9999] bottom-5 right-5 max-w-[360px] w-[calc(100vw-2.5rem)] p-4 rounded-2xl bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] select-none text-left"
    >
      {/* Close button */}
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
        aria-label="Dismiss banner"
      >
        <X size={15} />
      </button>

      <div className="flex items-start gap-3.5">
        {/* App Icon */}
        <img
          src="/kagz.png"
          alt="KagZ App"
          className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-sm border border-black/5 dark:border-white/10"
        />

        <div className="flex-1 min-w-0 pr-4">
          <h4 className="text-[14px] font-semibold text-gray-900 dark:text-white leading-tight">
            Install KagZ
          </h4>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
            Offline access, faster loads aur seamless native desktop experience paayein.
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3.5">
            <button
              onClick={onInstall}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-950 dark:bg-white text-white dark:text-gray-950 rounded-lg text-[12.5px] font-medium shadow-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Download size={13} strokeWidth={2.2} />
              Install Karein
            </button>
            <button
              onClick={onDismiss}
              className="px-2.5 py-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-[12px] rounded-lg transition-colors cursor-pointer"
            >
              Baad mein
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default InstallPromptBanner;

