import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import ThinkingOrb from './ThinkingOrb';

/**
 * DeepResearchCard:
 * Premium research inspection card:
 * - Sleek card container (rounded-[20px], dark aesthetic, border-white/10)
 * - Prominent 18px topic title establishing clear visual hierarchy
 * - Persistent step-by-step checklist with clear typography tiers
 * - Custom ORB animation loader on active in-progress steps AND bottom progress action
 * - Bottom currentAction + Clean, sleek continuous progress bar matching the image + Stop button
 */
const DeepResearchCard = ({
  researchData,
  isStreaming = false,
  onStop,
}) => {
  if (!researchData) return null;

  const topic = researchData.topic || 'Deep Research';
  const isCompleted = researchData.status === 'completed' || (!isStreaming && researchData.progress === 100);

  const steps = Array.isArray(researchData.steps) && researchData.steps.length > 0
    ? researchData.steps
    : [
        {
          id: 'default-step',
          title: `Analyze and synthesize "${topic}" across multiple angles`,
          status: isCompleted ? 'completed' : 'in_progress',
        },
      ];

  const progress = typeof researchData.progress === 'number'
    ? researchData.progress
    : isCompleted
    ? 100
    : 20;

  const currentAction = researchData.currentAction || (isCompleted ? 'Research complete' : 'Researching...');

  return (
    <div className="w-full min-w-0 my-3 select-none font-sans text-left">
      {/* Sleek Research Card Container (26, 26, 26 with no border) */}
      <div className="rounded-[20px] bg-neutral-100 dark:bg-[#1a1a1a] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] w-full min-w-0 transition-all duration-300 ease-out">
        {/* 1. Topic Title (Primary Level: 18px font-semibold) */}
        <div className="mb-4">
          <h3 className="text-[18px] font-semibold text-gray-950 dark:text-white tracking-tight break-words">
            {topic}
          </h3>
        </div>

        {/* 2. Step Checklist: Persistent steps with clear visual hierarchy */}
        <div className="flex flex-col gap-3.5 mb-5">
          {steps.map((step) => {
            const stepStatus = step.status || 'pending';

            return (
              <motion.div
                key={step.id || step.title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex items-start gap-3.5 leading-relaxed min-w-0"
              >
                {/* Left State Icon */}
                <div className="shrink-0 mt-0.5 w-[18px] h-[18px] flex items-center justify-center">
                  {stepStatus === 'completed' ? (
                    <div className="w-[18px] h-[18px] rounded-full bg-gray-900 dark:bg-white text-white dark:text-black flex items-center justify-center">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  ) : stepStatus === 'in_progress' ? (
                    <ThinkingOrb size={18} stateType="research" />
                  ) : (
                    <div className="w-[18px] h-[18px] rounded-full border-[1.4px] border-dashed border-gray-400 dark:border-neutral-500/80" />
                  )}
                </div>

                {/* Step Text with Visual Hierarchy */}
                <span
                  className={`transition-colors break-words min-w-0 ${
                    stepStatus === 'completed'
                      ? 'text-gray-600 dark:text-neutral-300 font-normal text-[14px]'
                      : stepStatus === 'in_progress'
                      ? 'text-gray-950 dark:text-white font-medium text-[14.5px]'
                      : 'text-gray-400 dark:text-neutral-500 font-normal text-[13.5px]'
                  }`}
                >
                  {step.title}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* 3. Bottom Status, Continuous Progress Bar & Stop Button */}
        <div className="flex flex-col gap-2.5 pt-3.5 border-t border-black/[0.06] dark:border-white/10">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {!isCompleted && (
                <div className="shrink-0 flex items-center justify-center">
                  <ThinkingOrb size={18} stateType="research" />
                </div>
              )}
              <span className="text-[13.5px] font-medium text-gray-800 dark:text-neutral-200 truncate flex-1 min-w-0">
                {currentAction}
              </span>
            </div>

            <span className="text-[13px] font-mono font-medium text-gray-500 dark:text-neutral-400 tabular-nums ml-2 shrink-0">
              {Math.round(progress)}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Clean, sleek continuous progress track matching the image */}
            <div className="h-1 bg-black/[0.08] dark:bg-[#282828] rounded-full flex-1 overflow-hidden">
              <motion.div
                className="h-full bg-gray-900 dark:bg-white rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            </div>

            {/* Stop Button (only while actively running) */}
            {!isCompleted && onStop && (
              <button
                type="button"
                onClick={onStop}
                title="Stop research"
                aria-label="Stop research"
                className="w-6 h-6 rounded-[6px] bg-black/5 dark:bg-[#2A2A2A] hover:bg-black/10 dark:hover:bg-[#383838] text-gray-700 dark:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <div className="w-2.5 h-2.5 bg-gray-800 dark:bg-white rounded-[2px]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeepResearchCard;
