// Canvas 2D caption rendering. Every style exposes a pure `draw(ctx, line,
// time, width, height, theme)` that the live preview and the exporter both
// call for a given timestamp -- no hidden mutable module state, so the same
// (line, time) always paints the same frame. The actual per-word/per-line
// timing math each style needs is factored into small standalone helpers
// below so it can be unit tested without a canvas.

const POP_DURATION = 0.18;
const BOUNCE_DURATION = 0.3;
const BOUNCE_REST_OFFSET = 24;
const SWEEP_DURATION = 0.25;

function hasSpan(word) {
  return Number.isFinite(word?.start) && Number.isFinite(word?.end) && word.end > word.start;
}

/** 1.0 -> ~1.15 -> 1.0 scale bump that plays once, right as a word becomes active. */
export function wordPopScale(word, time) {
  if (!word || time <= word.start) return 1;
  const t = (time - word.start) / POP_DURATION;
  if (t >= 1) return 1;
  return 1 + 0.15 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
}

/** Fraction (0..1) of a word's glyphs that should be filled at `time`. */
export function karaokeFillFraction(word, time) {
  if (!word) return 0;
  if (!hasSpan(word)) return time >= word.start ? 1 : 0;
  if (time <= word.start) return 0;
  if (time >= word.end) return 1;
  return (time - word.start) / (word.end - word.start);
}

// Robert Penner's well-known "ease out back" curve: a standard, public
// overshoot easing formula (not specific to any codebase) used here to give
// each word a small bounce past its resting position before settling.
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const shifted = t - 1;
  return 1 + c3 * shifted ** 3 + c1 * shifted ** 2;
}

/** Vertical pixel offset (0 = resting position) for a word bouncing in as it becomes active. */
export function bounceOffset(word, time) {
  if (!word || time <= word.start) return BOUNCE_REST_OFFSET;
  const t = Math.min(1, (time - word.start) / BOUNCE_DURATION);
  const eased = easeOutBack(t);
  return BOUNCE_REST_OFFSET * (1 - eased);
}

/** 0..1 fade/slide progress for a whole line: in as it starts, out as it ends. */
export function lineSweepProgress(line, time) {
  if (!line || time <= line.start) return 0;
  if (time < line.end) return Math.min(1, (time - line.start) / SWEEP_DURATION);
  const outT = Math.min(1, (time - line.end) / SWEEP_DURATION);
  return Math.max(0, 1 - outT);
}

/** Number of characters of a line's joined text that should be visible at `time` (typewriter reveal). */
export function typewriterVisibleChars(line, time) {
  if (!line?.words?.length) return 0;
  const text = line.words.map((w) => w.text).join(' ');
  if (!hasSpan(line)) return time >= line.start ? text.length : 0;
  if (time <= line.start) return 0;
  if (time >= line.end) return text.length;
  const fraction = (time - line.start) / (line.end - line.start);
  return Math.round(fraction * text.length);
}

function setFont(ctx, theme, width) {
  const fontSize = theme?.fontSize || Math.round(width * 0.06);
  ctx.font = `700 ${fontSize}px ${theme?.fontFamily || 'system-ui, sans-serif'}`;
  ctx.textBaseline = 'alphabetic';
  return fontSize;
}

function layoutWords(ctx, line, width) {
  const gap = ctx.measureText(' ').width || Math.round(width * 0.012);
  const widths = line.words.map((word) => ctx.measureText(word.text).width);
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, line.words.length - 1);
  let x = (width - total) / 2;
  return line.words.map((word, i) => {
    const wordX = x;
    x += widths[i] + gap;
    return { word, x: wordX, width: widths[i] };
  });
}

function drawWordPop(ctx, line, time, width, height, theme = {}) {
  if (!line) return;
  setFont(ctx, theme, width);
  const baseline = height * (theme.baseline ?? 0.82);
  ctx.textAlign = 'center';
  for (const { word, x, width: wordWidth } of layoutWords(ctx, line, width)) {
    const scale = wordPopScale(word, time);
    const active = time >= word.start;
    ctx.save();
    ctx.translate(x + wordWidth / 2, baseline);
    ctx.scale(scale, scale);
    ctx.fillStyle = active ? theme.activeColor || '#ffe066' : theme.color || '#ffffff';
    ctx.fillText(word.text, 0, 0);
    ctx.restore();
  }
}

function drawKaraokeFill(ctx, line, time, width, height, theme = {}) {
  if (!line) return;
  const fontSize = setFont(ctx, theme, width);
  const baseline = height * (theme.baseline ?? 0.82);
  ctx.textAlign = 'left';
  for (const { word, x, width: wordWidth } of layoutWords(ctx, line, width)) {
    ctx.fillStyle = theme.color || '#ffffff';
    ctx.fillText(word.text, x, baseline);
    const fraction = karaokeFillFraction(word, time);
    if (fraction > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, baseline - fontSize * 1.3, Math.max(0, wordWidth * fraction), fontSize * 1.8);
      ctx.clip();
      ctx.fillStyle = theme.activeColor || '#ffe066';
      ctx.fillText(word.text, x, baseline);
      ctx.restore();
    }
  }
}

function drawLineSweep(ctx, line, time, width, height, theme = {}) {
  if (!line) return;
  const progress = lineSweepProgress(line, time);
  if (progress <= 0) return;
  setFont(ctx, theme, width);
  const baseline = height * (theme.baseline ?? 0.82);
  const text = line.words.map((w) => w.text).join(' ');
  const slide = (1 - progress) * height * 0.03;
  const previousAlpha = ctx.globalAlpha;
  ctx.globalAlpha = previousAlpha * progress;
  ctx.fillStyle = theme.color || '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(text, width / 2, baseline + slide);
  ctx.globalAlpha = previousAlpha;
}

function drawBounceIn(ctx, line, time, width, height, theme = {}) {
  if (!line) return;
  setFont(ctx, theme, width);
  const baseline = height * (theme.baseline ?? 0.82);
  ctx.textAlign = 'left';
  for (const { word, x } of layoutWords(ctx, line, width)) {
    const offset = bounceOffset(word, time);
    ctx.fillStyle = time >= word.start ? theme.activeColor || '#ffe066' : theme.color || '#ffffff';
    ctx.fillText(word.text, x, baseline + offset);
  }
}

function drawTypewriter(ctx, line, time, width, height, theme = {}) {
  if (!line) return;
  setFont(ctx, theme, width);
  const baseline = height * (theme.baseline ?? 0.82);
  const text = line.words.map((w) => w.text).join(' ');
  const visible = typewriterVisibleChars(line, time);
  ctx.fillStyle = theme.color || '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(text.slice(0, visible), width / 2, baseline);
}

export const TYPE_STYLES = [
  { id: 'word-pop', name: 'Word Pop', draw: drawWordPop },
  { id: 'karaoke-fill', name: 'Karaoke Fill', draw: drawKaraokeFill },
  { id: 'line-sweep', name: 'Line Sweep', draw: drawLineSweep },
  { id: 'bounce-in', name: 'Bounce In', draw: drawBounceIn },
  { id: 'typewriter', name: 'Typewriter', draw: drawTypewriter },
];

/** The line active at `time`, or the most recently finished line if between lines (so captions don't flicker empty). */
export function findActiveLine(lines, time) {
  if (!lines?.length) return null;
  let candidate = null;
  for (const line of lines) {
    if (line.start <= time) candidate = line;
    if (line.start > time) break;
  }
  return candidate;
}

/** Dispatches to the named style's draw function (falls back to word-pop). */
export function drawCaption(styleId, ctx, line, time, width, height, theme) {
  const style = TYPE_STYLES.find((s) => s.id === styleId) || TYPE_STYLES[0];
  style.draw(ctx, line, time, width, height, theme);
}
