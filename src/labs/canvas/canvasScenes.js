// Canvas scenes. Every scene draws one frame from (loop time, features) only,
// with motion periods that divide the loop length, so the last frame of an
// export flows into the first. The Chladni and Lattice ideas come from the
// Sattari cymatic-generator prototype.

const TAU = Math.PI * 2;

export const SCENES = [
  { id: 'pulse', label: 'Pulse', detail: 'Cover art that breathes on the kick' },
  { id: 'chladni', label: 'Chladni', detail: 'Sand on a resonating plate' },
  { id: 'ripple', label: 'Ripple', detail: 'Rings on every kick' },
  { id: 'lattice', label: 'Lattice', detail: 'Rotating harmonic mandala' },
  { id: 'horizon', label: 'Horizon', detail: 'Stacked waveform ridges' },
];

export const PALETTES = [
  { id: 'obsidian', label: 'Obsidian', colors: ['#07070a', '#f4b35e', '#ff6b6b'] },
  { id: 'golden', label: 'Sattari gold', colors: ['#0b0906', '#d6b36d', '#f7f0e8'] },
  { id: 'aurora', label: 'Aurora', colors: ['#030710', '#67e8f9', '#a78bfa'] },
  { id: 'clinical', label: 'Clinical', colors: ['#050608', '#d9f99d', '#93c5fd'] },
  { id: 'rose', label: 'Rose', colors: ['#12060b', '#ff8fab', '#ffd6a5'] },
  { id: 'paper', label: 'Paper', colors: ['#efe9df', '#1d1d1b', '#c2410c'] },
];

// Deterministic pseudo-random numbers (mulberry32).
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexToRgb(hex) {
  const value = String(hex).replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function chladni(x, y, m, n) {
  return (
    Math.sin(m * Math.PI * x) * Math.sin(n * Math.PI * y) -
    Math.sin(n * Math.PI * x) * Math.sin(m * Math.PI * y)
  );
}

const CHLADNI_POINTS = 3200;
const CHLADNI_MODES = [
  [3, 5],
  [4, 7],
  [2, 9],
  [5, 6],
];
let chladniCache = null;

/** Points on the nodal lines of each plate mode, in matching order. */
export function chladniPoints() {
  if (chladniCache) return chladniCache;
  chladniCache = CHLADNI_MODES.map(([m, n], index) => {
    const random = seeded(1000 + index);
    const points = new Float32Array(CHLADNI_POINTS * 2);
    let count = 0;
    let guard = 0;
    while (count < CHLADNI_POINTS && guard++ < 400000) {
      const x = random() * 2 - 1;
      const y = random() * 2 - 1;
      if (Math.abs(chladni(x, y, m, n)) < 0.025) {
        points[count * 2] = x;
        points[count * 2 + 1] = y;
        count++;
      }
    }
    return points;
  });
  return chladniCache;
}

function background(ctx, w, h, colors, f) {
  const [bg, accent] = colors;
  const g = ctx.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h / 2, h * 0.75);
  g.addColorStop(0, rgba(accent, 0.1 + f.energy * 0.12));
  g.addColorStop(0.35, bg);
  g.addColorStop(1, bg);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function coverRect(image, w, h) {
  const scale = Math.max(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  return [(w - dw) / 2, (h - dh) / 2, dw, dh];
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPulse(ctx, w, h, s) {
  const { colors, f, cover, react, phase } = s;
  const [, accent, second] = colors;
  if (cover) {
    // Blurred, darkened cover fills the frame behind the artwork.
    ctx.save();
    const zoom = 1.25 + 0.04 * Math.sin(phase * TAU);
    const [x, y, dw, dh] = coverRect(cover, w * zoom, h * zoom);
    ctx.globalAlpha = 0.55;
    if ('filter' in ctx) ctx.filter = `blur(${Math.round(w * 0.05)}px)`;
    ctx.drawImage(cover, x - (w * (zoom - 1)) / 2, y - (h * (zoom - 1)) / 2, dw, dh);
    ctx.restore();
    ctx.fillStyle = rgba(colors[0], 0.55);
    ctx.fillRect(0, 0, w, h);
  }
  const cx = w / 2;
  const cy = h * 0.46;
  // Rings ride the kick envelope.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const r = w * (0.36 + i * 0.07 + f.kick * react * 0.05 * (i + 1));
    ctx.strokeStyle = rgba(i % 2 ? second : accent, (0.32 - i * 0.06) * (0.4 + f.kick * react));
    ctx.lineWidth = w * 0.004 * (1 + f.kick * 2);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
  const size = w * 0.64 * (1 + f.kick * react * 0.07 + f.energy * 0.02);
  ctx.save();
  ctx.shadowColor = rgba(accent, 0.55 + 0.4 * f.kick);
  ctx.shadowBlur = w * (0.04 + 0.1 * f.kick * react);
  roundedRect(ctx, cx - size / 2, cy - size / 2, size, size, w * 0.03);
  if (cover) {
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    const [x, y, dw, dh] = coverRect(cover, size, size);
    ctx.drawImage(cover, cx - size / 2 + x, cy - size / 2 + y, dw, dh);
  } else {
    const g = ctx.createLinearGradient(cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2);
    g.addColorStop(0, accent);
    g.addColorStop(1, second);
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();
  // A thin highlight sweep once per loop.
  ctx.save();
  roundedRect(ctx, cx - size / 2, cy - size / 2, size, size, w * 0.03);
  ctx.clip();
  const sweep = cx - size + phase * size * 2;
  const g = ctx.createLinearGradient(sweep - size * 0.2, 0, sweep + size * 0.2, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, `rgba(255,255,255,${0.06 + f.high * 0.08})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
}

function drawChladni(ctx, w, h, s) {
  const { colors, f, react, phase } = s;
  const modes = chladniPoints();
  // Two plate modes per loop, cross-faded A -> B -> A so the seam is continuous.
  // Kicks shake the sand off the nodal lines; it settles back as they decay.
  const morph = 0.5 - 0.5 * Math.cos(phase * TAU);
  const pair = s.variant % 2 ? [modes[2], modes[3]] : [modes[0], modes[1]];
  const cx = w / 2;
  const cy = h * 0.48;
  const radius = w * 0.44 * (1 + f.kick * react * 0.03);
  const jitter = 0.003 + f.kick * react * 0.035 + f.high * 0.004;
  const dot = Math.max(1.5, w / 360) * (1 + f.high * 0.5);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  pair.forEach((points, mode) => {
    const weight = mode ? morph : 1 - morph;
    if (weight < 0.02) return;
    const alpha = (0.3 + f.energy * 0.5) * weight;
    for (let i = 0; i < CHLADNI_POINTS; i++) {
      const x = points[i * 2] + Math.sin(i * 12.9898 + phase * TAU * 4) * jitter;
      const y = points[i * 2 + 1] + Math.cos(i * 78.233 + phase * TAU * 4) * jitter;
      ctx.fillStyle = rgba(i % 7 === 0 ? colors[2] : colors[1], alpha);
      ctx.fillRect(cx + x * radius, cy + y * radius * 1.15, dot, dot);
    }
  });
  ctx.restore();
  ctx.strokeStyle = rgba(colors[1], 0.1 + f.kick * 0.25);
  ctx.lineWidth = w * 0.003;
  ctx.strokeRect(cx - radius, cy - radius * 1.15, radius * 2, radius * 2.3);
}

function drawRipple(ctx, w, h, s) {
  const { colors, f, react, phase, view } = s;
  const cx = w / 2;
  const cy = h * 0.48;
  const life = 2.2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Slow glows orbiting once per loop.
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * TAU + phase * TAU;
    const x = cx + Math.cos(angle) * w * 0.26;
    const y = cy + Math.sin(angle) * w * 0.4;
    const g = ctx.createRadialGradient(x, y, 0, x, y, w * (0.22 + f.high * 0.1));
    g.addColorStop(0, rgba(colors[2], 0.08 + f.energy * 0.12));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  const onsets = view.onsets.length ? view.onsets : [{ time: 0, strength: 0.5 }];
  for (const onset of onsets) {
    const age = (s.t - onset.time + view.length) % view.length;
    if (age > life) continue;
    const k = 1 - age / life;
    const r = w * (0.05 + age * 0.38 * (0.7 + react * 0.3));
    ctx.strokeStyle = rgba(colors[1], k * k * (0.35 + 0.5 * onset.strength));
    ctx.lineWidth = w * (0.004 + 0.012 * k * onset.strength);
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 1.15, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = rgba(colors[1], 0.6 + f.kick * 0.4);
  ctx.beginPath();
  ctx.arc(cx, cy, w * (0.025 + f.kick * react * 0.03), 0, TAU);
  ctx.fill();
}

function drawLattice(ctx, w, h, s) {
  const { colors, f, react, phase } = s;
  const cx = w / 2;
  const cy = h * 0.48;
  const maxR = w * (0.42 + f.energy * 0.06 + f.kick * react * 0.05);
  const symmetry = 6 + (s.variant % 3) * 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';
  for (let layer = 0; layer < 9; layer++) {
    const points = symmetry + layer * 2;
    const r = maxR * (0.16 + layer * 0.1);
    const rotation = phase * TAU * (layer % 2 ? 1 : -1) * (1 / (1 + (layer % 3)));
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * TAU + rotation;
      const mod = 1 + Math.sin(a * (2 + layer) + phase * TAU * 2) * (0.03 + f.high * 0.14);
      const x = Math.cos(a) * r * mod;
      const y = Math.sin(a) * r * mod * 1.35;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = rgba(layer % 2 ? colors[2] : colors[1], 0.3 + f.energy * 0.35 - layer * 0.02);
    ctx.lineWidth = w * 0.002 * (1 + f.kick * react * 3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHorizon(ctx, w, h, s) {
  const { colors, react, view } = s;
  const lines = 30;
  const top = h * 0.22;
  const spacing = (h * 0.62) / lines;
  const steps = 72;
  for (let line = 0; line < lines; line++) {
    // Each ridge shows the music a little earlier: the newest is at the bottom.
    const lag = (lines - 1 - line) * 0.06;
    const t = (s.t - lag + view.length * 4) % view.length;
    const i = Math.floor(t * view.fps) % view.frames;
    const amp = (view.energy[i] * 0.6 + view.kick[i] * react * 0.8) * spacing * 3.2;
    const y0 = top + line * spacing;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, y0);
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      const x = w * (0.08 + u * 0.84);
      const envelope = Math.exp(-(((u - 0.5) * 3.2) ** 2));
      const noise =
        Math.sin(u * 37 + line * 1.7 + s.phase * TAU) * 0.5 +
        Math.sin(u * 91 + line * 0.9 - s.phase * TAU * 2) * 0.3 +
        Math.sin(u * 13 + line * 2.3) * 0.2;
      ctx.lineTo(x, y0 - envelope * amp * (0.6 + 0.4 * Math.abs(noise)));
    }
    ctx.lineTo(w * 0.92, y0);
    ctx.closePath();
    ctx.fillStyle = colors[0];
    ctx.fill();
    ctx.strokeStyle = rgba(line === lines - 1 ? colors[2] : colors[1], 0.5 + view.high[i] * 0.4);
    ctx.lineWidth = Math.max(1, w / 520);
    ctx.stroke();
  }
}

function drawTitle(ctx, w, h, s) {
  const { title, artist, colors } = s;
  if (!title && !artist) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = colors[0] === '#efe9df' ? '#1d1d1b' : '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = w * 0.02;
  if (title) {
    ctx.font = `600 ${Math.round(w * 0.06)}px Inter, system-ui, sans-serif`;
    ctx.fillText(title, w / 2, h * 0.86, w * 0.86);
  }
  if (artist) {
    ctx.globalAlpha = 0.75;
    ctx.font = `500 ${Math.round(w * 0.038)}px Inter, system-ui, sans-serif`;
    ctx.fillText(artist.toUpperCase(), w / 2, h * 0.86 + w * 0.065, w * 0.86);
  }
  ctx.restore();
}

const DRAW = {
  pulse: drawPulse,
  chladni: drawChladni,
  ripple: drawRipple,
  lattice: drawLattice,
  horizon: drawHorizon,
};

/**
 * Draws one frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} s scene state: { scene, t, view, f, colors, cover, react, title, artist, variant }
 */
export function drawFrame(ctx, s) {
  const { width: w, height: h } = ctx.canvas;
  const state = { ...s, phase: (s.t % s.view.length) / s.view.length, variant: s.variant || 0 };
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  background(ctx, w, h, s.colors, s.f);
  (DRAW[s.scene] || drawPulse)(ctx, w, h, state);
  drawTitle(ctx, w, h, state);
  ctx.restore();
}
