import React from "react";
import { Cat, Monitor } from "lucide-react";

const MobileOverlay = () => {
  return (
    <div className="fixed inset-0 z-[999999] bg-white dark:bg-[#0A0A0A] flex flex-col items-center justify-center p-8 overflow-hidden md:hidden">
      {/* Abstract Background Cat Outline */}
      <div className="absolute inset-0 flex items-center justify-center opacity-5 dark:opacity-10 pointer-events-none">
        <Cat className="w-[120vw] h-[120vw] stroke-[0.2]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center max-w-sm mx-auto text-center">
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-blue-100 dark:border-blue-900/30">
          <Monitor className="w-8 h-8 stroke-[1.5]" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Desktop Experience Required
        </h1>
        
        <p className="text-[15px] leading-relaxed text-gray-600 dark:text-gray-400 mb-8">
          This workspace is designed and optimized for larger screens. To ensure you have access to all the powerful tools and features without compromise, please open NOEMA on a desktop or laptop device.
        </p>

        <div className="flex items-center gap-2 text-[13px] font-medium text-gray-400 dark:text-gray-500">
          <Cat className="w-4 h-4" />
          <span>We'll be waiting for you!</span>
        </div>
      </div>
    </div>
  );
};

export default MobileOverlay;
