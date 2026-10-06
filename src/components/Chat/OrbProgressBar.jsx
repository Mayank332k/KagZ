import React, { useRef, useEffect } from 'react';

/**
 * OrbProgressBar: Dense Stardust Ribbon
 * 
 * - Composed of 50 dense micro ORB particle elements forming a fluid cosmic stream.
 * - Progress % controls the active particles (20% -> 10 active particles, 50% -> 25 active, 100% -> all active).
 * - Active particles form a luminous ribbon that orbits, rotates, drifts through random positions, and twinkles randomly.
 * - Leading frontier particle features an active luminous pulse heading the wave.
 * - Inactive particles remain as subtle, dormant stardust dust along the baseline path.
 * - 100% visual fidelity with NOEMA's ThinkingOrb aesthetic.
 */
const OrbProgressBar = React.memo(({ progress = 0, className = '' }) => {
  const canvasRef = useRef(null);
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    const startTime = performance.now();
    const NUM_ELEMENTS = 50;

    // Seeds for organic dissolve curl and individualized particle kinetics
    const seeds = Array.from({ length: NUM_ELEMENTS }, (_, i) => ({
      jitterAngle: (i * 2.39996) % (Math.PI * 2),
      twinkleOffset: (i * 1.41421) % (Math.PI * 2),
      driftFreqX: 1.4 + ((i * 3.7) % 1.5),
      driftFreqY: 1.7 + ((i * 2.9) % 1.6),
      orbitSpeed: 1.8 + ((i * 1.9) % 1.6),
      orbitRadius: 1.6 + ((i * 2.1) % 1.5),
    }));

    const render = (now) => {
      const elapsed = (now - startTime) / 1000;
      const isDark = document.documentElement.classList.contains('dark');
      const r = isDark ? 255 : 24;
      const g = isDark ? 255 : 24;
      const b = isDark ? 255 : 26;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth || 300;
      const height = canvas.clientHeight || 20;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const margin = 8;
      const trackWidth = Math.max(10, width - margin * 2);
      const baselineY = height / 2;

      const currentPct = Math.min(100, Math.max(0, progressRef.current || 0));
      const numActive = Math.round((currentPct / 100) * NUM_ELEMENTS);
      const activeEndX = margin + (Math.max(0, numActive - 0.5) / (NUM_ELEMENTS - 1)) * trackWidth;

      // 1. Inactive baseline stardust track (subtle dashed guidance)
      ctx.save();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.08 : 0.05})`;
      ctx.lineWidth = 0.55;
      ctx.setLineDash([1.2, 2.6]);
      ctx.beginPath();
      ctx.moveTo(margin, baselineY);
      ctx.lineTo(width - margin, baselineY);
      ctx.stroke();
      ctx.restore();

      // 2. Active stream core filament (soft continuous stardust aura beneath particles)
      if (numActive > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.22 : 0.14})`;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(margin, baselineY);
        ctx.lineTo(activeEndX, baselineY);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Render 50 stardust particles along the ribbon
      for (let i = 0; i < NUM_ELEMENTS; i++) {
        const seed = seeds[i];
        const baseX = margin + (i / (NUM_ELEMENTS - 1)) * trackWidth;
        const baseY = baselineY;
        const isActive = i < numActive;
        const isFrontier = isActive && i === numActive - 1;

        let renderX = baseX;
        let renderY = baseY;
        let renderSize = 0.62;
        let renderAlpha = isDark ? 0.14 : 0.09;
        let renderAngle = 0;

        if (isActive) {
          // --- Active Particle Kinetics (Requirement 8) ---
          // a. Continuous local orbit & rotation
          const orbitAngle = elapsed * seed.orbitSpeed + seed.jitterAngle;
          const orbX = Math.cos(orbitAngle) * seed.orbitRadius;
          const orbY = Math.sin(orbitAngle) * (seed.orbitRadius * 0.75);

          // b. Multi-frequency wandering drift through random positions
          const wanderX = Math.sin(elapsed * seed.driftFreqX + seed.jitterAngle) * 1.3;
          const wanderY = Math.cos(elapsed * seed.driftFreqY + seed.twinkleOffset) * 1.5;

          renderX = baseX + orbX + wanderX;
          renderY = baseY + orbY + wanderY;

          // c. Random cosmic twinkling / blinking
          const blink = Math.sin(elapsed * (2.8 + (seed.twinkleOffset % 2.5)) + seed.twinkleOffset);
          const blinkFactor = Math.pow(Math.max(0, (blink + 1) / 2), 1.6);
          renderAlpha = Math.min(1.0, 0.40 + 0.60 * blinkFactor);

          // d. Organic scale breathing
          const pulse = 1.0 + 0.26 * Math.sin(elapsed * 2.6 + i * 0.4);
          renderSize = 0.88 * pulse;

          renderAngle = orbitAngle + Math.PI / 2 + Math.sin(elapsed * 2.2 + i * 0.5) * 0.35;

          // Frontier lead particle: radiant beacon leading the wave
          if (isFrontier) {
            renderSize *= 1.35;
            renderAlpha = Math.max(0.85, renderAlpha);
          }
        }

        // Draw particle as authentic delicate ORB leaf/petal bezier shape
        const len = Math.max(0.75, renderSize * 2.0);
        const wid = Math.max(0.38, renderSize * 0.90);

        ctx.save();
        if (isActive) {
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.85 : 0.40})`;
          ctx.shadowBlur = isDark ? (isFrontier ? 4.5 : 2.5) : 1.8;
        }
        ctx.translate(renderX, renderY);
        ctx.rotate(renderAngle);

        ctx.beginPath();
        ctx.moveTo(len, 0);
        ctx.bezierCurveTo(len * 0.35, -wid, -len * 0.45, -wid, -len * 0.82, 0);
        ctx.bezierCurveTo(-len * 0.45, wid, len * 0.35, wid, len, 0);
        ctx.closePath();

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${renderAlpha})`;
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-[20px] select-none pointer-events-none ${className}`}
      aria-label={`Research progress: ${progress}%`}
      aria-hidden="true"
    />
  );
});

export default OrbProgressBar;
