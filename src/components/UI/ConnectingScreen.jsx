import React, { useState, useEffect } from 'react';

const WORD = 'CONNECTING';
const GLYPHS = '01#@$%&*<>[]{}|+_~=X/\\';

const GLITCH_MAP = {
  C: ['0', '<', '[', '{', '(', '¢', '©'],
  O: ['0', 'Ø', '[]', '()', '¤', 'Q'],
  N: ['//', '|\\|', 'ñ', 'И', 'Z', 'H'],
  E: ['3', '€', 'Ξ', '≡', '£', '&'],
  T: ['7', '+', '†', '⊤', '1', '|'],
  I: ['1', '|', '!', '¦', '/', ']'],
  G: ['6', '&', '9', 'C', 'Q', '0'],
};

const GlitchLetter = ({ char, index }) => {
  const [displayChar, setDisplayChar] = useState(char);
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    let timeoutId;
    let cancelId;
    let isMounted = true;

    const scheduleNextGlitch = () => {
      // Each letter glitches at its own fraction of a second (randomized between 120ms and 950ms)
      const delay = 120 + Math.random() * 850 + (index % 3) * 60;

      timeoutId = setTimeout(() => {
        if (!isMounted) return;

        // Choose a glitch character
        const pool = GLITCH_MAP[char] || GLYPHS;
        const randomGlyph = pool[Math.floor(Math.random() * pool.length)];

        setDisplayChar(randomGlyph);
        setIsGlitching(true);

        // Snap back after a fraction of time (40ms - 90ms)
        const snapDelay = 40 + Math.random() * 50;
        cancelId = setTimeout(() => {
          if (!isMounted) return;
          setDisplayChar(char);
          setIsGlitching(false);
          scheduleNextGlitch();
        }, snapDelay);
      }, delay);
    };

    scheduleNextGlitch();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      clearTimeout(cancelId);
    };
  }, [char, index]);

  return (
    <span
      className={`inline-block transition-transform duration-75 select-none ${
        isGlitching
          ? 'text-[#00f0ff] -translate-y-[0.5px] skew-x-[-2deg]'
          : 'text-neutral-200'
      }`}
      style={{
        textShadow: isGlitching
          ? '-1px 0 #00ffff, 1px 0 #ff0055, 0 0 4px rgba(0,240,255,0.6)'
          : 'none',
      }}
    >
      {displayChar}
    </span>
  );
};

export const ConnectingScreen = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#000000] text-neutral-200 select-none overflow-hidden">
      {/* Squarish Small Glitching CONNECTING text */}
      <div
        className="flex items-center text-[12px] sm:text-[13px] font-medium tracking-[0.32em] uppercase"
        style={{
          fontFamily:
            "'Space Mono', 'Chakra Petch', 'Share Tech Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
      >
        {WORD.split('').map((char, idx) => (
          <GlitchLetter key={`${char}-${idx}`} char={char} index={idx} />
        ))}
        {/* Blinking squarish cursor */}
        <span className="inline-block w-[5px] h-[12px] bg-white/70 ml-1.5 animate-pulse" />
      </div>
    </div>
  );
};

export default ConnectingScreen;

