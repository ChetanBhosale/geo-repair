export interface AeoTreeEngineConfig {
  canvas: HTMLCanvasElement;
  totalChecks?: number;
  seed?: number;
}

export interface AeoTreeEngine {
  applyScore: (n: number) => void;
  destroy: () => void;
}

export function createAeoTreeEngine({
  canvas,
  totalChecks = 26,
  seed = 1118,
}: AeoTreeEngineConfig): AeoTreeEngine {
  const W = 1000,
    H = 840,
    GROUND_Y = 762;
  const UP = -Math.PI / 2,
    TAU = Math.PI * 2;

  // Mulberry32 — deterministic seeded PRNG so the same seed always produces
  // the same tree shape.
  function mulberry32(s: number) {
    return function () {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(seed);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const clamp = (v: number, lo: number, hi: number) =>
    v < lo ? lo : v > hi ? hi : v;

  type RGB = { r: number; g: number; b: number };

  function hexRgb(h: string): RGB {
    return {
      r: parseInt(h.slice(1, 3), 16),
      g: parseInt(h.slice(3, 5), 16),
      b: parseInt(h.slice(5, 7), 16),
    };
  }
  function mixRgb(a: RGB, b: RGB, t: number): string {
    return (
      'rgb(' +
      ((a.r + (b.r - a.r) * t) | 0) +
      ',' +
      ((a.g + (b.g - a.g) * t) | 0) +
      ',' +
      ((a.b + (b.b - a.b) * t) | 0) +
      ')'
    );
  }

  // Leaf palette: 9-step ramp from deep shadowed interior to bright sunlit rim.
  // Each leaf's index is chosen by its position relative to the light source
  // (upper-left), giving the canopy a sense of volume without raytracing.
  const LEAF_LIVE: RGB[] = [
    '#1b4030',
    '#224e39',
    '#295d42',
    '#316d4b',
    '#3a7e55',
    '#458f60',
    '#53a06b',
    '#65b079',
    '#7ec189',
  ].map(hexRgb);
  const LEAF_DEAD: RGB = hexRgb('#454b54');
  const WOOD_LIVE: RGB[] = [
    '#33291d',
    '#3b3023',
    '#443728',
    '#4d3f2d',
    '#564732',
  ].map(hexRgb);
  const WOOD_DEAD: RGB = hexRgb('#3f444c');

  // ── Types ─────────────────────────────────────────────────────────────────

  type Seg = {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    w0: number;
    w1: number;
    d: number;
  };
  type Leaf = {
    x: number;
    y: number;
    s: number;
    rot: number;
    ph: number;
    back: boolean;
    al: number;
    ci: number;
    rank: number;
  };
  type Branch = {
    segs: Seg[];
    leaves: Leaf[];
    root: { x: number; y: number };
    act: number;
    target: number;
    amp: number;
    ph: number;
    f1: number;
    f2: number;
  };
  type Joint = { x: number; y: number; w: number; a: number };
  type Slot = Joint & { kind: string };

  // ── Tree generation ────────────────────────────────────────────────────────

  const staticSegs: Seg[] = [];
  const trunkJoints: Joint[] = [];

  // Trunk: 4 segments curving slightly, widths tapering 36 → 13.
  {
    let x = 500,
      y = GROUND_Y,
      a = UP + 0.03;
    trunkJoints.push({ x, y, w: 36, a });
    (
      [
        [96, 36, 28],
        [86, 28, 22],
        [72, 22, 17],
        [58, 17, 13],
      ] as [number, number, number][]
    ).forEach(([segLen, w0, w1]) => {
      a += (rng() - 0.5) * 0.12 + (UP - a) * 0.25;
      const nx = x + Math.cos(a) * segLen,
        ny = y + Math.sin(a) * segLen;
      staticSegs.push({ x0: x, y0: y, x1: nx, y1: ny, w0, w1, d: 0 });
      x = nx;
      y = ny;
      trunkJoints.push({ x, y, w: w1, a });
    });
  }
  const trunkTop = trunkJoints[trunkJoints.length - 1];

  function trunkPoint(t: number) {
    const f = t * (trunkJoints.length - 1);
    const i = clamp(Math.floor(f), 0, trunkJoints.length - 2);
    const k = f - i,
      aa = trunkJoints[i],
      bb = trunkJoints[i + 1];
    return {
      x: lerp(aa.x, bb.x, k),
      y: lerp(aa.y, bb.y, k),
      w: lerp(aa.w, bb.w, k),
      a: bb.a,
    };
  }

  // 8 primary limbs; each produces end / outer / mid attachment slots.
  // Two extra crown slots sit at the top of the trunk.
  const limbSlots: Slot[] = [];
  {
    const P = 8;
    const sides: number[] = [];
    let bal = 0;
    for (let k = 0; k < P; k++) {
      let s = k % 2 ? 1 : -1;
      if (rng() < 0.3) s = -s;
      if (bal >= 2) s = -1;
      else if (bal <= -2) s = 1;
      sides.push(s);
      bal += s;
    }
    for (let k = 0; k < P; k++) {
      const tk = (k + 0.5) / P;
      const at = trunkPoint(0.36 + 0.62 * tk);
      const side = sides[k];
      let a = UP + side * lerp(1.22, 0.3, tk) + (rng() - 0.5) * 0.25;
      let x = at.x + side * at.w * 0.3,
        y = at.y,
        w = at.w * 0.55;
      const joints: Slot[] = [];
      for (let si = 0; si < 3; si++) {
        a += (UP - a) * 0.16 + (rng() - 0.5) * 0.14;
        const L = (80 - si * 15) * (0.82 + rng() * 0.34);
        const nx = x + Math.cos(a) * L,
          ny = y + Math.sin(a) * L;
        const w1 = w * 0.72;
        staticSegs.push({ x0: x, y0: y, x1: nx, y1: ny, w0: w, w1, d: 1 });
        x = nx;
        y = ny;
        w = w1;
        joints.push({ x, y, a, w, kind: '' });
      }
      limbSlots.push({ ...joints[2], kind: 'end' });
      limbSlots.push({ ...joints[1], kind: 'outer' });
      limbSlots.push({ ...joints[0], kind: 'mid' });
    }
    limbSlots.push({
      x: trunkTop.x,
      y: trunkTop.y,
      a: UP - 0.22,
      w: 12,
      kind: 'top',
    });
    limbSlots.push({
      x: trunkTop.x,
      y: trunkTop.y,
      a: UP + 0.22,
      w: 12,
      kind: 'top',
    });
  }
  // Interleave slot kinds so consecutive check-branches land in different
  // parts of the crown rather than clustering on the same limb.
  limbSlots.sort((s1, s2) =>
    s1.kind === s2.kind ? 0 : s1.kind < s2.kind ? -1 : 1,
  );

  function addLeafCluster(
    B: Branch,
    x: number,
    y: number,
    ang: number,
    sizeMul: number,
  ) {
    const n = 6 + ((rng() * 5) | 0);
    for (let k = 0; k < n; k++) {
      const a = rng() * TAU,
        r = rng() * 13;
      B.leaves.push({
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r * 0.8,
        s: (4.2 + rng() * 3.6) * sizeMul,
        rot: ang + (rng() - 0.5) * 1.6,
        ph: rng() * TAU,
        back: rng() < 0.3,
        al: 0.72 + rng() * 0.28,
        ci: 0,
        rank: 0,
      });
    }
  }

  function grow(
    B: Branch,
    x: number,
    y: number,
    ang: number,
    len: number,
    wid: number,
    depth: number,
  ) {
    const a2 = ang + (rng() - 0.5) * 0.18 + (UP - ang) * 0.06;
    const x1 = x + Math.cos(a2) * len,
      y1 = y + Math.sin(a2) * len;
    B.segs.push({
      x0: x,
      y0: y,
      x1,
      y1,
      w0: wid,
      w1: wid * 0.64,
      d: Math.min(4, depth + 1),
    });

    if (depth >= 4 || wid < 1.1 || (depth >= 3 && rng() < 0.25)) {
      addLeafCluster(B, x1, y1, a2, 1);
      if (rng() < 0.5)
        addLeafCluster(B, (x + x1) / 2, (y + y1) / 2, a2, 0.65);
      return;
    }
    const nKids = depth === 0 && rng() < 0.35 ? 3 : 2;
    const sgn = rng() < 0.5 ? 1 : -1;
    for (let c = 0; c < nKids; c++) {
      const spread =
        c === 0
          ? (rng() - 0.5) * 0.22
          : c === 1
            ? sgn * (0.34 + rng() * 0.42)
            : -sgn * (0.34 + rng() * 0.42);
      grow(
        B,
        x1,
        y1,
        a2 + spread,
        Math.max(14, len * (0.68 + rng() * 0.16)),
        wid * (c === 0 ? 0.72 : 0.56),
        depth + 1,
      );
    }
  }

  // One branch subtree per optimization check.
  const branches: Branch[] = [];
  for (let i = 0; i < totalChecks; i++) {
    const slot = limbSlots[i % limbSlots.length];
    const ang =
      slot.kind === 'end' || slot.kind === 'top'
        ? slot.a + (rng() - 0.5) * 0.55
        : slot.a + (rng() < 0.5 ? -1 : 1) * (0.45 + rng() * 0.5);
    const B: Branch = {
      segs: [],
      leaves: [],
      root: { x: slot.x, y: slot.y },
      act: 0,
      target: 0,
      amp: 0.011 + rng() * 0.015,
      ph: rng() * TAU,
      f1: 0.55 + rng() * 0.35,
      f2: 1.3 + rng() * 0.7,
    };
    grow(
      B,
      slot.x,
      slot.y,
      ang,
      (slot.kind === 'mid' ? 48 : 58) + rng() * 18,
      clamp(slot.w * 0.85, 4.5, 11),
      0,
    );

    let maxD = 1;
    for (const lf of B.leaves)
      maxD = Math.max(maxD, Math.hypot(lf.x - B.root.x, lf.y - B.root.y));
    for (const lf of B.leaves)
      lf.rank = Math.hypot(lf.x - B.root.x, lf.y - B.root.y) / maxD;
    branches.push(B);
  }

  // Assign per-leaf colour indices from canopy position relative to the
  // upper-left light source.
  let canopyCx = 0,
    canopyCy = 0;
  {
    let n = 0;
    for (const B of branches)
      for (const lf of B.leaves) {
        canopyCx += lf.x;
        canopyCy += lf.y;
        n++;
      }
    canopyCx /= n;
    canopyCy /= n;
    for (const B of branches)
      for (const lf of B.leaves) {
        const f =
          0.52 +
          (canopyCx - lf.x) * 0.0009 +
          (canopyCy - lf.y) * 0.0016 +
          (rng() - 0.5) * 0.3;
        let ci = Math.round(clamp(f, 0.12, 0.96) * (LEAF_LIVE.length - 1));
        if (lf.back) ci = Math.max(0, ci - 2);
        lf.ci = ci;
      }
  }

  // Celebration motes — pre-seeded drifting particles.
  const motes = Array.from({ length: 38 }, () => ({
    x: canopyCx + (rng() - 0.5) * 560,
    y: canopyCy + (rng() - 0.3) * 380,
    sp: 0.05 + rng() * 0.1,
    ph: rng(),
    r: 0.8 + rng() * 1.6,
    dx: (rng() - 0.5) * 50,
  }));

  // Cascade order: branches activate bottom-up with slight randomisation.
  const order = branches
    .map((b, i) => ({ i, key: b.root.y + (rng() - 0.5) * 160 }))
    .sort((a, b) => b.key - a.key)
    .map((o) => o.i);
  const cascadeRank: number[] = [];
  order.forEach((bi, k) => {
    cascadeRank[bi] = k;
  });

  // ── Canvas + viewport ──────────────────────────────────────────────────────

  const ctx = canvas.getContext('2d')!;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STATIC_WOOD = WOOD_LIVE.map((c) => mixRgb(c, c, 0));

  let view = { scale: 1, ox: 0, oy: 0, dpr: 1 };

  function fitCanvas() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const r = parent.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const scale = Math.min(r.width / W, r.height / H);
    view = { scale, ox: (r.width - W * scale) / 2, oy: r.height - H * scale, dpr };
  }
  fitCanvas();

  const ro = new ResizeObserver(() => fitCanvas());
  if (canvas.parentElement) ro.observe(canvas.parentElement);

  // ── Renderer ───────────────────────────────────────────────────────────────

  // Leaves near the branch root open first (rank ≈ 0), tips last (rank ≈ 1).
  function bloom(act: number, rk: number) {
    const b = clamp((act - 0.3 * rk) / 0.7, 0, 1);
    return b * b * (3 - 2 * b);
  }

  // Wood as tapered quads so limbs thin continuously without cap bulges;
  // a disc joint at the base keeps the chain seamless.
  function drawSeg(s: Seg, color: string) {
    const dx = s.x1 - s.x0,
      dy = s.y1 - s.y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len,
      ny = dx / len;
    const h0 = s.w0 / 2,
      h1 = s.w1 / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s.x0 + nx * h0, s.y0 + ny * h0);
    ctx.lineTo(s.x1 + nx * h1, s.y1 + ny * h1);
    ctx.lineTo(s.x1 - nx * h1, s.y1 - ny * h1);
    ctx.lineTo(s.x0 - nx * h0, s.y0 - ny * h0);
    ctx.closePath();
    ctx.fill();
    if (s.w0 > 2.5) {
      ctx.beginPath();
      ctx.arc(s.x0, s.y0, h0 * 0.98, 0, TAU);
      ctx.fill();
    }
  }

  function render(t: number) {
    const cw = canvas.width,
      ch = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.setTransform(
      view.dpr * view.scale,
      0,
      0,
      view.dpr * view.scale,
      view.dpr * view.ox,
      view.dpr * view.oy,
    );
    ctx.lineCap = 'round';

    const wind = RM ? 0 : 1;

    // Celebration: soft directional shafts + canopy glow.
    if (celebrate > 0.01) {
      const sway = Math.sin(t * 0.12) * 0.02;
      ctx.save();
      for (let k = 0; k < 4; k++) {
        const a = 1.12 + k * 0.16 + sway;
        const rayLen = 1150,
          half = 0.038;
        const ox = 290,
          oy = -90;
        const g = ctx.createLinearGradient(
          ox,
          oy,
          ox + Math.cos(a) * rayLen,
          oy + Math.sin(a) * rayLen,
        );
        g.addColorStop(0, 'rgba(255,238,200,0)');
        g.addColorStop(
          0.25,
          `rgba(255,238,200,${(0.07 * celebrate).toFixed(3)})`,
        );
        g.addColorStop(0.9, 'rgba(255,238,200,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(
          ox + Math.cos(a - half) * rayLen,
          oy + Math.sin(a - half) * rayLen,
        );
        ctx.lineTo(
          ox + Math.cos(a + half) * rayLen,
          oy + Math.sin(a + half) * rayLen,
        );
        ctx.closePath();
        ctx.fill();
      }
      const g2 = ctx.createRadialGradient(
        canopyCx,
        canopyCy,
        30,
        canopyCx,
        canopyCy,
        320,
      );
      g2.addColorStop(
        0,
        `rgba(110,225,160,${(0.1 * celebrate).toFixed(3)})`,
      );
      g2.addColorStop(1, 'rgba(110,225,160,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(canopyCx - 340, canopyCy - 340, 680, 680);
      ctx.restore();
    }

    // Ground shadow ellipses.
    const gg = ctx.createRadialGradient(
      500,
      GROUND_Y + 14,
      20,
      500,
      GROUND_Y + 14,
      330,
    );
    gg.addColorStop(0, 'rgba(22,44,52,.85)');
    gg.addColorStop(1, 'rgba(16,32,44,0)');
    ctx.fillStyle = gg;
    ctx.save();
    ctx.translate(500, GROUND_Y + 16);
    ctx.scale(1, 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, 330, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.save();
    ctx.translate(500, GROUND_Y + 6);
    ctx.scale(1, 0.13);
    ctx.beginPath();
    ctx.arc(0, 0, 130, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Per-branch: compute sway transform + blended palette.
    const frame = branches.map((B) => {
      const sw =
        wind *
        B.act *
        B.amp *
        (0.7 * Math.sin(t * B.f1 + B.ph) +
          0.3 * Math.sin(t * B.f2 + B.ph * 1.7));
      return {
        sw,
        leafC: LEAF_LIVE.map((c) => mixRgb(LEAF_DEAD, c, B.act)),
        woodC: WOOD_LIVE.map((c) => mixRgb(WOOD_DEAD, c, B.act)),
        alpha: 0.45 + 0.55 * B.act,
      };
    });

    const each = (
      fn: (
        B: Branch,
        F: { sw: number; leafC: string[]; woodC: string[]; alpha: number },
      ) => void,
    ) => {
      branches.forEach((B, i) => {
        const F = frame[i];
        ctx.save();
        ctx.translate(B.root.x, B.root.y);
        ctx.rotate(F.sw);
        ctx.translate(-B.root.x, -B.root.y);
        fn(B, F);
        ctx.restore();
      });
    };

    const drawLeaves = (
      B: Branch,
      F: { sw: number; leafC: string[]; woodC: string[]; alpha: number },
      backPass: boolean,
    ) => {
      for (const lf of B.leaves) {
        if (lf.back !== backPass) continue;
        const e = bloom(B.act, lf.rank);
        const sc = lerp(0.42, 1, e) * (1 + 0.16 * Math.sin(e * Math.PI));
        const flut = wind * B.act;
        const rot = lf.rot + flut * 0.2 * Math.sin(t * 2.1 + lf.ph);
        const lx = lf.x + flut * 0.9 * Math.sin(t * 1.3 + lf.ph);
        ctx.globalAlpha =
          lf.al * lerp(0.3, 1, e) * (backPass ? 0.8 : 1) * F.alpha;
        ctx.fillStyle = F.leafC[lf.ci];
        ctx.beginPath();
        ctx.ellipse(lx, lf.y, lf.s * sc, lf.s * 0.55 * sc, rot, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    // Render order: back leaves → static wood → front leaves
    // This gives the canopy its depth.
    each((B, F) => drawLeaves(B, F, true));

    for (const s of staticSegs) drawSeg(s, STATIC_WOOD[s.d]);

    // Root flare grounds the trunk into the soil.
    const tb = trunkJoints[0];
    ctx.fillStyle = STATIC_WOOD[0];
    ctx.beginPath();
    ctx.moveTo(tb.x - 36, GROUND_Y + 4);
    ctx.quadraticCurveTo(tb.x - 17, GROUND_Y - 24, tb.x - 16, GROUND_Y - 48);
    ctx.lineTo(tb.x + 16, GROUND_Y - 48);
    ctx.quadraticCurveTo(tb.x + 17, GROUND_Y - 24, tb.x + 36, GROUND_Y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.16;
    for (const s of staticSegs) {
      if (s.d > 0) continue;
      ctx.strokeStyle = '#a08862';
      ctx.lineWidth = s.w0 * 0.22;
      ctx.beginPath();
      ctx.moveTo(s.x0 - s.w0 * 0.26, s.y0 - 1);
      ctx.lineTo(s.x1 - s.w1 * 0.26, s.y1 - 1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    each((B, F) => {
      ctx.globalAlpha = F.alpha;
      for (const s of B.segs) drawSeg(s, F.woodC[s.d]);
      ctx.globalAlpha = 1;
      drawLeaves(B, F, false);
    });

    // Celebration motes.
    if (celebrate > 0.01 && !RM) {
      ctx.fillStyle = '#c8f2d2';
      for (const m of motes) {
        const p = (t * m.sp + m.ph) % 1;
        const a = Math.sin(p * Math.PI) * 0.55 * celebrate;
        if (a < 0.01) continue;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(
          m.x + Math.sin(p * 5 + m.ph * 9) * 6 + m.dx * p,
          m.y - p * 130,
          m.r,
          0,
          TAU,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── State & animation loop ─────────────────────────────────────────────────

  let currentScore = -1;
  let celebrate = 0,
    celebrateTarget = 0;
  let last = performance.now();
  let raf = 0;
  let destroyed = false;

  function tickFrame(now: number) {
    if (destroyed) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const B of branches)
      B.act += (B.target - B.act) * Math.min(1, dt * 3.2);
    celebrate += (celebrateTarget - celebrate) * Math.min(1, dt * 1.6);
    render(now / 1000);
    raf = requestAnimationFrame(tickFrame);
  }
  raf = requestAnimationFrame(tickFrame);

  // ── Public API ─────────────────────────────────────────────────────────────

  function applyScore(n: number) {
    n = clamp(n | 0, 0, totalChecks);
    if (n === currentScore) return;
    branches.forEach((b, i) => {
      b.target = cascadeRank[i] < n ? 1 : 0;
    });
    celebrateTarget = n === totalChecks ? 1 : 0;
    currentScore = n;
  }

  function destroy() {
    destroyed = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
  }

  return { applyScore, destroy };
}
