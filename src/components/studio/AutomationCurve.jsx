import { useRef, useState } from 'react';

export default function AutomationCurve({
  points,
  duration,
  parameter,
  range,
  onChange,
  disabled,
}) {
  const [preview, setPreview] = useState(null);
  const drag = useRef(null);
  const min = range?.min ?? (parameter === 'pan' ? -1 : parameter === 'filter' ? 20 : 0);
  const max = range?.max ?? (parameter === 'pan' ? 1 : parameter === 'filter' ? 20000 : 300);
  const normalized = (value) =>
    parameter === 'filter'
      ? Math.log(value / min) / Math.log(max / min)
      : (value - min) / (max - min);
  const fromY = (y) =>
    parameter === 'filter' ? min * (max / min) ** (1 - y) : min + (max - min) * (1 - y);
  const valueAt = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      time: Math.max(0, Math.min(duration, ((event.clientX - box.left) / box.width) * duration)),
      value: fromY(Math.max(0, Math.min(1, (event.clientY - box.top) / box.height))),
    };
  };
  const shown = preview || points;
  const commit = (values) =>
    onChange(
      [...values]
        .sort((a, b) => a.time - b.time)
        .filter(
          (point, index, array) =>
            index === array.length - 1 || array[index + 1].time - point.time > 0.001
        )
    );
  return (
    <div className="ae-curve">
      <p>Drag points · Double-click to add · Arrow keys adjust · Delete removes</p>
      <svg
        viewBox="0 0 800 140"
        preserveAspectRatio="none"
        role="group"
        aria-label={`${parameter} automation curve`}
        onDoubleClick={(event) => {
          if (!disabled && event.target.tagName !== 'circle') commit([...points, valueAt(event)]);
        }}
        onPointerDown={(event) => {
          if (disabled || event.target.dataset.point == null) return;
          drag.current = Number(event.target.dataset.point);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current == null) return;
          const value = valueAt(event);
          setPreview(points.map((point, i) => (i === drag.current ? value : point)));
        }}
        onPointerUp={() => {
          if (preview) commit(preview);
          drag.current = null;
          setPreview(null);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setPreview(null);
        }}
      >
        {[0, 0.5, 1].map((value) => (
          <line key={value} x1="0" x2="800" y1={value * 140} y2={value * 140} stroke="#40536a" />
        ))}
        <polyline
          fill="none"
          stroke="#91caff"
          strokeWidth="2"
          points={shown
            .map(
              (point) => `${(point.time / duration) * 800},${(1 - normalized(point.value)) * 140}`
            )
            .join(' ')}
        />
        {shown.map((point, index) => (
          <circle
            key={index}
            data-point={index}
            r="6"
            cx={(point.time / duration) * 800}
            cy={(1 - normalized(point.value)) * 140}
            fill="#b7e0ff"
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={`Automation point ${index + 1}: ${point.time.toFixed(2)} seconds, ${point.value.toFixed(2)}`}
            onKeyDown={(event) => {
              if (disabled) return;
              if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault();
                commit(points.filter((_, i) => i !== index));
              } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                event.preventDefault();
                commit(
                  points.map((p, i) =>
                    i !== index
                      ? p
                      : {
                          time: Math.max(
                            0,
                            Math.min(
                              duration,
                              p.time +
                                (event.key === 'ArrowLeft'
                                  ? -0.01
                                  : event.key === 'ArrowRight'
                                    ? 0.01
                                    : 0)
                            )
                          ),
                          value: Math.max(
                            min,
                            Math.min(
                              max,
                              p.value +
                                ((event.key === 'ArrowUp'
                                  ? 1
                                  : event.key === 'ArrowDown'
                                    ? -1
                                    : 0) *
                                  (max - min)) /
                                  100
                            )
                          ),
                        }
                  )
                );
              }
            }}
          />
        ))}
      </svg>
      <small>
        0s — {duration.toFixed(2)}s · {min} to {max}
        {parameter === 'filter' ? ' Hz (logarithmic)' : parameter === 'volume' ? '%' : ''}
      </small>
    </div>
  );
}
