import React from 'react';

const WORD = 'CONNECTING';
const FLIP_COUNT = 5; // last 5 characters: C T I N G
const FLIP_START = WORD.length - FLIP_COUNT;
const FLIP_STAGGER_MS = 55;

export const ConnectingScreen = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#000000] text-neutral-400 select-none overflow-hidden">
      <style>{`
        .connecting-word {
          perspective: 600px;
        }
        .connecting-char {
          display: inline-block;
          transform-style: preserve-3d;
          backface-visibility: visible;
        }
        .connecting-flip {
          will-change: transform;
          transform-origin: 50% 50%;
          animation-duration: 1800ms;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
        }
        .connecting-flip-fwd { animation-name: connectingFlipFwd; }
        .connecting-flip-rev { animation-name: connectingFlipRev; }

        @keyframes connectingFlipFwd {
          0%       { transform: translateY(0) rotateX(0deg);       color: #a3a3a3; }
          11.667%  { transform: translateY(-3.5px) rotateX(180deg); color: #ffffff; }
          23.333%  { transform: translateY(0) rotateX(360deg);     color: #a3a3a3; }
          100%     { transform: translateY(0) rotateX(360deg);     color: #a3a3a3; }
        }
        @keyframes connectingFlipRev {
          0%       { transform: translateY(0) rotateX(0deg);        color: #a3a3a3; }
          11.667%  { transform: translateY(-3.5px) rotateX(-180deg); color: #ffffff; }
          23.333%  { transform: translateY(0) rotateX(-360deg);     color: #a3a3a3; }
          100%     { transform: translateY(0) rotateX(-360deg);     color: #a3a3a3; }
        }

        .connecting-square {
          display: inline-block;
          width: 9px;
          height: 9px;
          margin-left: 6px;
          background-image: radial-gradient(circle, rgba(255, 255, 255, 0.92) 0.75px, transparent 0.85px);
          background-size: 2.2px 2.2px;
          background-position: center;
          /* Same 1800ms cycle as the flip wave — pulses during the wave, then rests */
          animation: connectingSquarePulse 1800ms ease-in-out infinite;
        }
        @keyframes connectingSquarePulse {
          0%      { transform: scale(1);    opacity: 0.7; }
          17.778% { transform: scale(1.14); opacity: 1; }   /* 320ms — wave midpoint */
          35.556% { transform: scale(1);    opacity: 0.7; } /* 640ms — wave finished */
          100%    { transform: scale(1);    opacity: 0.7; }
        }
      `}</style>

      {/* Monochromatic CONNECTING wordmark with a sequential backflip wave on the last 5 characters */}
      <div
        className="connecting-word flex items-center text-[12px] sm:text-[13px] font-medium tracking-[0.32em] uppercase"
        style={{
          fontFamily:
            "'Space Mono', 'Chakra Petch', 'Share Tech Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
      >
        {WORD.split('').map((char, idx) => {
          const isFlip = idx >= FLIP_START;
          const flipIndex = idx - FLIP_START;
          const direction = flipIndex % 2 === 0 ? 'fwd' : 'rev';

          return (
            <span
              key={`${char}-${idx}`}
              className={`connecting-char select-none ${
                isFlip ? `connecting-flip connecting-flip-${direction}` : ''
              }`}
              style={isFlip ? { animationDelay: `${flipIndex * FLIP_STAGGER_MS}ms` } : undefined}
            >
              {char}
            </span>
          );
        })}
        {/* Character-sized dense dotted square that pulses in sync with the wave */}
        <span className="connecting-square" aria-hidden="true" />
      </div>
    </div>
  );
};

export default ConnectingScreen;
