import React, { useState, useEffect } from 'react';

const WORD = 'CONNECTING';
const GLITCH_GLYPHS = ['/', '\\', '>', '<', '_', '-', '|', '~'];

export const ConnectingScreen = () => {
  const [glitches, setGlitches] = useState({}); // { [index]: glyph }

  useEffect(() => {
    let timeoutId;
    let isMounted = true;

    const tick = () => {
      if (!isMounted) return;

      // 75% of frames have 1-2 active glitch glyphs, 25% brief clean frame
      if (Math.random() < 0.25) {
        setGlitches({});
        timeoutId = setTimeout(tick, 90 + Math.random() * 50);
        return;
      }

      const count = Math.random() < 0.65 ? 1 : 2;
      const newGlitches = {};
      for (let i = 0; i < count; i++) {
        const randIdx = Math.floor(Math.random() * WORD.length);
        const randGlyph = GLITCH_GLYPHS[Math.floor(Math.random() * GLITCH_GLYPHS.length)];
        newGlitches[randIdx] = randGlyph;
      }

      setGlitches(newGlitches);
      // Next mutation after 80ms - 140ms
      timeoutId = setTimeout(tick, 80 + Math.random() * 60);
    };

    tick();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#000000] text-neutral-400 select-none overflow-hidden">
      {/* Clean Monochromatic Monospace Glitching CONNECTING text */}
      <div
        className="flex items-center text-[12px] sm:text-[13px] font-medium tracking-[0.32em] uppercase"
        style={{
          fontFamily:
            "'Space Mono', 'Chakra Petch', 'Share Tech Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
      >
        {WORD.split('').map((char, idx) => {
          const isGlitched = glitches[idx] !== undefined;
          const displayChar = isGlitched ? glitches[idx] : char;

          return (
            <span
              key={`${char}-${idx}`}
              className={`inline-block select-none transition-all duration-75 ${
                isGlitched
                  ? 'text-white font-semibold -translate-y-[0.5px] scale-[1.02]'
                  : 'text-neutral-400 font-medium'
              }`}
            >
              {displayChar}
            </span>
          );
        })}
        {/* Subtle blinking squarish cursor */}
        <span className="inline-block w-[5px] h-[12px] bg-white/70 ml-1.5 animate-pulse" />
      </div>
    </div>
  );
};

export default ConnectingScreen;
