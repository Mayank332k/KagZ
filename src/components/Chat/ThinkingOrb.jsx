import React, { useRef, useEffect } from 'react';

/**
 * ThinkingOrb: State-based generative particle morphing.
 * - State 'web_search': Dotted tilted orbit with traveling comet shimmer
 * - State 'workspace_search': Dotted dog-eared document with vertical scanning shimmer
 * - State 'thinking': Continuous organic generative particle morphing
 * - Smooth stardust morph transitions between states
 */
const ThinkingOrb = React.memo(({ size = 24, stateType = 'thinking', className = '' }) => {
  const canvasRef = useRef(null);
  const stateTypeRef = useRef(stateType);

  useEffect(() => {
    stateTypeRef.current = stateType;
  }, [stateType]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    const startTime = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const NUM_PARTICLES = 48;
    const scale = size / 24;

    // Seeds for organic dissolve curl
    const seeds = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      seeds.push({
        jitterAngle: (i * 2.39996) % (Math.PI * 2),
        twinkleOffset: (i * 1.414) % (Math.PI * 2),
      });
    }

    // Precalculate spherical coords for 3D sphere (Thinking state)
    const sphereCoords = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const y = 1 - (i / (NUM_PARTICLES - 1)) * 2;
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * 2.399963229728653;
      sphereCoords.push({
        x: Math.cos(phi) * radiusAtY,
        y: y,
        z: Math.sin(phi) * radiusAtY,
      });
    }

    // 1. Refined Page Dot Matrix with Organic Unfolding & Rounded Corners (workspace_search)
    const getFileParticleTarget = (i, elapsed, openTime = 1.0) => {
      const hw = 5.2 * scale; // half width
      const hh = 6.6 * scale; // half height
      const cr = 1.5 * scale; // corner radius
      const fold = 2.4 * scale; // top-right fold size

      // Unfolding / sheet lifting progression
      const unfoldDuration = 0.75;
      const progress = Math.min(1, Math.max(0, openTime) / unfoldDuration);
      // Soft cubic ease out
      const settleEase = 1 - Math.pow(1 - progress, 3);
      // Gentle sheet lifting elevation that settles down
      const liftY = (1 - settleEase) * -1.8 * scale;
      // Gentle fold curl that settles into flat sheet
      const foldCurl = (1 - settleEase) * 1.2 * scale;

      let x = 0;
      let y = 0;
      let angle = 0;
      const isInterior = i >= 32;

      if (i < 32) {
        // --- 32 Perimeter Particles with Soft Rounded Corners ---
        if (i < 3) {
          // Top-Left Rounded Corner (3 particles)
          const cornerAng = Math.PI + 0.25 + (i / 2) * (Math.PI * 0.5 - 0.5);
          x = (-hw + cr) + Math.cos(cornerAng) * cr;
          y = (-hh + cr) + Math.sin(cornerAng) * cr;
          angle = cornerAng + Math.PI / 2;
        } else if (i < 7) {
          // Top Horizontal Edge (4 particles)
          const k = i - 3;
          x = (-hw + cr + 0.8 * scale) + (k / 3) * (hw - fold - (-hw + cr + 0.8 * scale));
          y = -hh;
          angle = 0;
        } else if (i < 11) {
          // Soft Top-Right Fold (4 particles)
          const k = i - 7;
          const t = (k + 0.5) / 4;
          const fx = (hw - fold) + t * fold;
          const fy = -hh + t * fold - (Math.sin(t * Math.PI) * foldCurl);
          x = fx;
          y = fy;
          angle = Math.PI * 0.25;
        } else if (i < 17) {
          // Right Vertical Edge (6 particles)
          const k = i - 11;
          x = hw;
          y = (-hh + fold + 0.8 * scale) + (k / 5) * (hh - cr - (-hh + fold + 0.8 * scale));
          angle = Math.PI / 2;
        } else if (i < 20) {
          // Bottom-Right Rounded Corner (3 particles)
          const k = i - 17;
          const cornerAng = 0.15 + (k / 2) * (Math.PI * 0.5 - 0.3);
          x = (hw - cr) + Math.cos(cornerAng) * cr;
          y = (hh - cr) + Math.sin(cornerAng) * cr;
          angle = cornerAng + Math.PI / 2;
        } else if (i < 24) {
          // Bottom Horizontal Edge (4 particles)
          const k = i - 20;
          x = (hw - cr - 0.8 * scale) - (k / 3) * ((hw - cr - 0.8 * scale) - (-hw + cr + 0.8 * scale));
          y = hh;
          angle = Math.PI;
        } else if (i < 27) {
          // Bottom-Left Rounded Corner (3 particles)
          const k = i - 24;
          const cornerAng = Math.PI * 0.5 + 0.15 + (k / 2) * (Math.PI * 0.5 - 0.3);
          x = (-hw + cr) + Math.cos(cornerAng) * cr;
          y = (hh - cr) + Math.sin(cornerAng) * cr;
          angle = cornerAng + Math.PI / 2;
        } else {
          // Left Vertical Edge (5 particles)
          const k = i - 27;
          x = -hw;
          y = (hh - cr - 0.8 * scale) - (k / 4) * ((hh - cr - 0.8 * scale) - (-hh + cr + 0.8 * scale));
          angle = -Math.PI / 2;
        }
      } else {
        // --- 16 Interior Particles: Sparse Minimal Grid with Whitespace ---
        const k = i - 32;
        if (k < 2) {
          // Header Accent Bar (2 particles)
          y = -4.0 * scale;
          x = (-2.8 + k * 1.6) * scale;
          angle = 0;
        } else if (k < 7) {
          // Content Line 1 (5 particles)
          const idx = k - 2;
          y = -1.2 * scale;
          x = (-2.8 + idx * 1.4) * scale;
          angle = 0;
        } else if (k < 12) {
          // Content Line 2 (5 particles)
          const idx = k - 7;
          y = 1.6 * scale;
          x = (-2.8 + idx * 1.4) * scale;
          angle = 0;
        } else {
          // Content Line 3 (4 particles, paragraph finish)
          const idx = k - 12;
          y = 4.4 * scale;
          x = (-2.8 + idx * 1.4) * scale;
          angle = 0;
        }
      }

      // Apply organic sheet lifting offset
      const finalY = y + liftY;

      // Calm, slow highlight sweep across the page (3.2s period)
      const wavePeriod = 3.2;
      const wavePhase = (elapsed / wavePeriod) % 1.0;
      const waveY = (-10 + wavePhase * 20) * scale;
      const dist = Math.abs(finalY - waveY);
      const band = 2.8 * scale;
      const shimmer = dist < band ? Math.pow(Math.cos((dist / band) * (Math.PI / 2)), 2) : 0;

      // Minimal monochrome palette with organic fade-in during reveal
      const baseAlpha = isInterior ? 0.36 : 0.58;
      const alpha = Math.min(1.0, (baseAlpha + shimmer * 0.42) * Math.min(1, settleEase + 0.1));
      const size = (isInterior ? 0.44 : 0.50) * scale + shimmer * 0.32 * scale;

      return {
        x,
        y: finalY,
        size,
        alpha,
        shimmer,
        angle,
      };
    };

    // 2. Dotted 3D Globe with Shimmer Effect (web_search)
    const getGlobeParticleTarget = (i, elapsed) => {
      const rotY = elapsed * 1.6;
      const tilt = 0.35; // 20-degree axial tilt
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosT = Math.cos(tilt), sinT = Math.sin(tilt);

      const sc = sphereCoords[i];
      // 3D rotation around Y axis
      const x1 = sc.x * cosY - sc.z * sinY;
      const z1 = sc.x * sinY + sc.z * cosY;
      // Axial tilt rotation around X axis
      const y2 = sc.y * cosT - z1 * sinT;
      const z2 = sc.y * sinT + z1 * cosT;

      const rGlobe = 7.8 * scale;
      const depth = (z2 + 1) / 2; // 0 (back) to 1 (front)

      // Luminous traveling shimmer wave sweeping across the globe
      const shimmerSpeed = 2.4;
      const beamPhase = (elapsed * shimmerSpeed) % (Math.PI * 2);
      const dotAngle = Math.atan2(z2, x1);
      const delta = ((beamPhase - dotAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const beamWidth = 1.8;

      let shimmer = 0;
      if (delta < beamWidth) {
        shimmer = Math.pow(Math.sin((delta / beamWidth) * Math.PI), 2);
      }

      // Depth transparency & shimmer intensity
      const baseAlpha = depth < 0.45 ? (0.2 + depth * 0.25) : (0.45 + (depth - 0.45) * 0.55);
      const finalAlpha = Math.min(1.0, baseAlpha + shimmer * (1.0 - baseAlpha * 0.4));
      const finalSize = (0.42 + depth * 0.22 + shimmer * 0.42) * scale;

      // Leaves align along latitude parallels of the rotating globe
      const latAngle = Math.atan2(y2, x1) + Math.PI / 2 + shimmer * 0.2;

      return {
        x: x1 * rGlobe,
        y: y2 * rGlobe,
        size: finalSize,
        alpha: finalAlpha,
        angle: latAngle,
        shimmer,
      };
    };

    // 3. Dotted WiFi Reconnect Signal (reconnecting)
    const getWifiParticleTarget = (i, elapsed) => {
      const beaconY = 5.2 * scale;
      const wavePeriod = 1.4;
      const wavePhase = (elapsed / wavePeriod) % 1.0;

      let tier = 0;
      let px = 0;
      let py = 0;
      let angle = 0;

      if (i < 4) {
        // Beacon dot at bottom center (4 particles)
        tier = 0;
        const bAng = (i / 4) * Math.PI * 2;
        px = Math.cos(bAng) * 0.7 * scale;
        py = beaconY + Math.sin(bAng) * 0.7 * scale;
        angle = bAng;
      } else if (i < 14) {
        // Arc 1: Inner WiFi arc (10 particles)
        tier = 1;
        const k = i - 4;
        const r1 = 4.2 * scale;
        const ang = Math.PI * 1.25 + (k / 9) * (Math.PI * 0.5);
        px = Math.cos(ang) * r1;
        py = beaconY + Math.sin(ang) * r1;
        angle = ang + Math.PI / 2;
      } else if (i < 30) {
        // Arc 2: Middle WiFi arc (16 particles)
        tier = 2;
        const k = i - 14;
        const r2 = 7.4 * scale;
        const ang = Math.PI * 1.25 + (k / 15) * (Math.PI * 0.5);
        px = Math.cos(ang) * r2;
        py = beaconY + Math.sin(ang) * r2;
        angle = ang + Math.PI / 2;
      } else {
        // Arc 3: Outer WiFi arc (18 particles)
        tier = 3;
        const k = i - 30;
        const r3 = 10.6 * scale;
        const ang = Math.PI * 1.25 + (k / 17) * (Math.PI * 0.5);
        px = Math.cos(ang) * r3;
        py = beaconY + Math.sin(ang) * r3;
        angle = ang + Math.PI / 2;
      }

      // Traveling upward broadcast ping
      const tierPhase = tier / 3;
      const dist = Math.abs(wavePhase - tierPhase);
      const ping = Math.max(0, Math.cos(Math.min(1, dist * 3.5) * (Math.PI / 2)));
      const baseAlpha = 0.28;
      const alpha = Math.min(1.0, baseAlpha + ping * (1.0 - baseAlpha));
      const size = (0.50 + ping * 0.38) * scale;

      return {
        x: px,
        y: py,
        size,
        alpha,
        angle,
      };
    };

    // 3. Generative Thinking Orb (thinking)
    const getThinkingParticleTarget = (subState, i, elapsed) => {
      switch (subState) {
        // Sub 0: 3D Celestial Sphere
        case 0: {
          const rotY = elapsed * 1.8;
          const rotX = 0.38;
          const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
          const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
          const sc = sphereCoords[i];
          const x1 = sc.x * cosY - sc.z * sinY;
          const z1 = sc.x * sinY + sc.z * cosY;
          const y2 = sc.y * cosX - z1 * sinX;
          const z2 = sc.y * sinX + z1 * cosX;
          const rSphere = 7.4 * scale;
          const depth = (z2 + 1) / 2;
          const angle = Math.atan2(y2, x1) + Math.PI / 2 + elapsed * 0.6;
          return {
            x: x1 * rSphere,
            y: y2 * rSphere,
            size: (0.42 + depth * 0.5) * scale,
            alpha: Math.max(0.2, depth * 0.95),
            angle,
          };
        }
        // Sub 1: Glowing Tri-Lobe Blossom
        case 1: {
          const rot = elapsed * 1.3;
          const angle = (i / NUM_PARTICLES) * Math.PI * 2;
          const baseR = 5.2 * scale;
          const amp = 2.4 * scale;
          const r = baseR + amp * Math.cos(3 * (angle - rot));
          const isVertex = i % 16 === 0;
          const angleLobe = angle + Math.PI / 2 + Math.sin(3 * (angle - rot)) * 0.5;
          return {
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r,
            size: (isVertex ? 1.0 : 0.58) * scale,
            alpha: isVertex ? 0.95 : 0.8,
            isVertex,
            angle: angleLobe,
          };
        }
        // Sub 2: Glowing Rounded Botanical Leaf with Spine Vein
        default: {
          const sway = Math.sin(elapsed * 1.5) * 0.08;
          const tilt = -0.32 + sway;
          const cosT = Math.cos(tilt);
          const sinT = Math.sin(tilt);

          let lx = 0;
          let ly = 0;
          let lAngle = 0;
          let lSize = 0.58;
          let lAlpha = 0.85;

          if (i < 28) {
            // Leaf contour perimeter (28 particles)
            const u = (i / 28) * Math.PI * 2;
            const px = Math.sin(u) * 5.4 * scale;
            const py = -Math.cos(u) * (7.6 - 1.8 * Math.cos(u)) * scale;
            lx = px * cosT - py * sinT;
            ly = px * sinT + py * cosT;
            lAngle = tilt + u + Math.PI / 2;
            lSize = 0.62 * scale;
            lAlpha = 0.9;
          } else if (i < 40) {
            // Central midrib spine (12 particles)
            const k = i - 28;
            const frac = k / 11;
            const py = (-7.0 + frac * 14.2) * scale;
            const px = Math.sin(frac * Math.PI) * 0.9 * scale;
            lx = px * cosT - py * sinT;
            ly = px * sinT + py * cosT;
            lAngle = tilt + Math.PI / 2;
            lSize = 0.54 * scale;
            lAlpha = 0.75 + 0.25 * Math.sin(elapsed * 3.0 + frac * 4);
          } else {
            // Side rib veins (8 particles)
            const k = i - 40;
            const side = k % 2 === 0 ? 1 : -1;
            const tier = Math.floor(k / 2);
            const frac = 0.25 + (tier / 3) * 0.5;
            const spineY = (-7.0 + frac * 14.2) * scale;
            const ribLen = (2.2 - Math.abs(frac - 0.5) * 1.8) * scale;
            const px = (side * ribLen);
            const py = spineY - 0.8 * scale;
            lx = px * cosT - py * sinT;
            ly = px * sinT + py * cosT;
            lAngle = tilt + (side > 0 ? 0.4 : -0.4);
            lSize = 0.48 * scale;
            lAlpha = 0.65;
          }

          return {
            x: lx,
            y: ly,
            size: lSize,
            alpha: lAlpha,
            angle: lAngle,
          };
        }
      }
    };

    // Transition & Mode State Tracking
    let currentMode = stateTypeRef.current || 'thinking';
    let morphStartTime = performance.now();
    let modeStartTime = performance.now();
    let isTransitioning = false;
    const MORPH_DURATION = 750; // 750ms smooth stardust morph

    const fromPositions = [];
    const lastPositions = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      fromPositions.push({ x: 0, y: 0, size: 0.6 * scale, alpha: 0.6 });
      lastPositions.push({ x: 0, y: 0, size: 0.6 * scale, alpha: 0.6 });
    }

    // Thinking generative sub-states
    let thinkingSubState = 0;
    let nextThinkingSubState = 1;
    let thinkingSubProgress = 0;
    let lastSubSwitchTime = performance.now();

    const render = (now) => {
      const elapsed = (now - startTime) / 1000;
      const isDark = document.documentElement.classList.contains('dark');
      const r = isDark ? 255 : 24;
      const g = isDark ? 255 : 24;
      const b = isDark ? 255 : 26;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;

      // Check for mode change
      const activeType = stateTypeRef.current || 'thinking';
      if (activeType !== currentMode) {
        for (let i = 0; i < NUM_PARTICLES; i++) {
          fromPositions[i] = { ...lastPositions[i] };
        }
        currentMode = activeType;
        morphStartTime = now;
        modeStartTime = now;
        isTransitioning = true;
      }

      // Compute transition progress
      let morphProgress = 1;
      if (isTransitioning) {
        const elapsedMorph = (now - morphStartTime) / MORPH_DURATION;
        if (elapsedMorph >= 1) {
          morphProgress = 1;
          isTransitioning = false;
        } else {
          morphProgress = elapsedMorph * elapsedMorph * (3 - 2 * elapsedMorph);
        }
      }

      // If in thinking mode, handle subtle generative sub-cycles
      if (currentMode === 'thinking') {
        const subDuration = 2400;
        const subElapsed = now - lastSubSwitchTime;
        if (subElapsed > subDuration) {
          thinkingSubState = nextThinkingSubState;
          nextThinkingSubState = (thinkingSubState + 1) % 3;
          lastSubSwitchTime = now;
          thinkingSubProgress = 0;
        } else {
          const u = subElapsed / subDuration;
          thinkingSubProgress = u < 0.4 ? 0 : (u - 0.4) / 0.6;
          thinkingSubProgress = 0.5 - 0.5 * Math.cos(thinkingSubProgress * Math.PI);
        }
      }

      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.9 : 0.35})`;
      ctx.shadowBlur = (isDark ? 3.5 : 2) * scale;

      // Draw background visual guide for Globe
      if (currentMode === 'web_search') {
        ctx.save();
        ctx.translate(cx, cy);
        // Outer horizon rim
        ctx.beginPath();
        ctx.arc(0, 0, 7.8 * scale, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.2 : 0.12})`;
        ctx.lineWidth = 0.65 * scale;
        ctx.stroke();

        // Tilted equator dashed line
        ctx.rotate(0.35);
        ctx.beginPath();
        ctx.ellipse(0, 0, 7.8 * scale, 2.5 * scale, 0, 0, Math.PI * 2);
        ctx.setLineDash([1.4 * scale, 2.4 * scale]);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.14 : 0.08})`;
        ctx.stroke();
        ctx.restore();
      }

      // Draw background visual guide for WiFi
      if (currentMode === 'reconnecting') {
        ctx.save();
        ctx.translate(cx, cy + 5.2 * scale);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.16 : 0.1})`;
        ctx.lineWidth = 0.65 * scale;
        ctx.setLineDash([1.5 * scale, 2.5 * scale]);
        [4.2, 7.4, 10.6].forEach((radius) => {
          ctx.beginPath();
          ctx.arc(0, 0, radius * scale, Math.PI * 1.25, Math.PI * 1.75);
          ctx.stroke();
        });
        ctx.restore();
      }

      // Draw background visual guide for File / Sheet
      if (currentMode === 'workspace_search') {
        ctx.save();
        ctx.translate(cx, cy);
        const ghw = 5.2 * scale;
        const ghh = 6.6 * scale;
        const gcr = 1.5 * scale;
        const gfold = 2.4 * scale;

        ctx.beginPath();
        // Top-left rounded corner
        ctx.arc(-ghw + gcr, -ghh + gcr, gcr, Math.PI, 1.5 * Math.PI);
        // Top edge to fold
        ctx.lineTo(ghw - gfold, -ghh);
        // Soft fold
        ctx.lineTo(ghw, -ghh + gfold);
        // Right edge to bottom-right corner
        ctx.arc(ghw - gcr, ghh - gcr, gcr, 0, 0.5 * Math.PI);
        // Bottom edge to bottom-left corner
        ctx.arc(-ghw + gcr, ghh - gcr, gcr, 0.5 * Math.PI, Math.PI);
        ctx.closePath();

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.12 : 0.08})`;
        ctx.lineWidth = 0.65 * scale;
        ctx.stroke();
        ctx.restore();
      }

      // Draw 48 particles with organic morphing
      for (let i = 0; i < NUM_PARTICLES; i++) {
        let target;
        if (currentMode === 'workspace_search') {
          target = getFileParticleTarget(i, elapsed, (now - modeStartTime) / 1000);
        } else if (currentMode === 'web_search') {
          target = getGlobeParticleTarget(i, elapsed);
        } else if (currentMode === 'reconnecting') {
          target = getWifiParticleTarget(i, elapsed);
        } else {
          const subA = getThinkingParticleTarget(thinkingSubState, i, elapsed);
          const subB = getThinkingParticleTarget(nextThinkingSubState, i, elapsed);
          const u = thinkingSubProgress;
          target = {
            x: subA.x + (subB.x - subA.x) * u,
            y: subA.y + (subB.y - subA.y) * u,
            size: subA.size + (subB.size - subA.size) * u,
            alpha: subA.alpha + (subB.alpha - subA.alpha) * u,
            angle: subA.angle + (subB.angle - subA.angle) * u,
          };
        }

        let renderX = target.x;
        let renderY = target.y;
        let renderSize = target.size;
        let renderAlpha = target.alpha;

        let targetAngle = target.angle !== undefined ? target.angle : Math.atan2(renderY, renderX) + 0.4;
        let renderAngle = targetAngle;

        if (isTransitioning) {
          const from = fromPositions[i];
          const t = morphProgress;
          const seed = seeds[i];
          const dissolveArc = Math.sin(t * Math.PI);
          const dx = target.x - from.x;
          const dy = target.y - from.y;
          const curlX = -dy * 0.2 * dissolveArc * Math.sin(seed.jitterAngle + elapsed * 2.5);
          const curlY = dx * 0.2 * dissolveArc * Math.cos(seed.jitterAngle + elapsed * 2.5);

          renderX = from.x + (target.x - from.x) * t + curlX;
          renderY = from.y + (target.y - from.y) * t + curlY;
          renderSize = from.size + (target.size - from.size) * t;
          renderAlpha = from.alpha + (target.alpha - from.alpha) * t;
          renderAngle += (1 - t) * (seed.jitterAngle + elapsed * 2.8);
        }

        lastPositions[i] = { x: renderX, y: renderY, size: renderSize, alpha: renderAlpha };

        // Draw particle as a delicate rounded leaf / petal
        const len = Math.max(0.85, renderSize * 2.0);
        const wid = Math.max(0.45, renderSize * 0.92);

        ctx.save();
        ctx.translate(cx + renderX, cy + renderY);
        ctx.rotate(renderAngle);

        ctx.beginPath();
        // Tapered tip at (+len, 0)
        ctx.moveTo(len, 0);
        // Upper organic curve to rounded base
        ctx.bezierCurveTo(len * 0.35, -wid, -len * 0.45, -wid, -len * 0.82, 0);
        // Lower organic curve back to tip
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
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className={`shrink-0 select-none pointer-events-none ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
});

export default ThinkingOrb;

