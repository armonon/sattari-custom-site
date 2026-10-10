import { useEffect, useRef, useState } from 'react';
import { Plus, Upload } from 'lucide-react';

export function LabWaveform({ peaks, color = 'currentColor', progress = null, height = 44 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !peaks?.length) return undefined;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, rect.width * scale);
      canvas.height = height * scale;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(scale, scale);
      const max = Math.max(0.01, ...peaks);
      const step = rect.width / peaks.length;
      peaks.forEach((peak, index) => {
        const bar = Math.max(1, (peak / max) * (height - 6));
        context.globalAlpha = progress !== null && index / peaks.length > progress ? 0.45 : 1;
        context.fillStyle = color;
        context.fillRect(index * step, (height - bar) / 2, Math.max(1, step - 1), bar);
      });
    };
    draw();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [peaks, color, progress, height]);
  return <canvas ref={ref} className="alab-waveform" style={{ height }} aria-hidden="true" />;
}

/** Drop zone plus file picker. */
export function LabDrop({ title, hint, multiple = false, disabled = false, onFiles, children }) {
  const [dragging, setDragging] = useState(false);
  const picker = useRef(null);
  return (
    <div
      className={`alab-drop${dragging ? ' is-dragging' : ''}${disabled ? ' is-locked' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) onFiles([...event.dataTransfer.files]);
      }}
    >
      <div className="alab-drop-mark">
        <Upload size={24} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <div className="alab-drop-copy">
        <h2>{dragging ? 'Drop to add' : title}</h2>
        <p>{hint}</p>
      </div>
      <div className="alab-drop-actions">
        <button
          type="button"
          className="alab-button"
          disabled={disabled}
          onClick={() => picker.current?.click()}
        >
          <Plus size={16} aria-hidden="true" /> Choose audio
        </button>
        {children}
      </div>
      <input
        ref={picker}
        type="file"
        className="alab-file-input"
        aria-label={title}
        accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg,.opus,.aif,.aiff,.webm"
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          onFiles([...event.target.files]);
          event.target.value = '';
        }}
      />
    </div>
  );
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
