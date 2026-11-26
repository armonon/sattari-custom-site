import { CIRCLE } from './keyTheory';

// A quiet analog instrument: tempo dial with a sweeping needle, the circle of
// fifths as an outer ring. Decorative only (the real readout is below).
const TICKS = Array.from({ length: 41 }, (_, i) => i);
const polar = (r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [200 + r * Math.cos(rad), 200 + r * Math.sin(rad)];
};

export default function KeyBpmHero() {
  return (
    <div className="kb-hero" aria-hidden="true">
      <svg viewBox="0 0 400 400" focusable="false">
        <circle cx="200" cy="200" r="190" className="kb-hero-plate" />
        {CIRCLE.map(({ index, major }) => {
          const [x, y] = polar(170, index * 30);
          return (
            <text key={index} x={x} y={y} className="kb-hero-key" textAnchor="middle" dy="4">
              {major}
            </text>
          );
        })}
        {TICKS.map((i) => {
          const deg = -120 + i * 6;
          const long = i % 5 === 0;
          const [x1, y1] = polar(long ? 118 : 126, deg);
          const [x2, y2] = polar(134, deg);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={long ? 'kb-hero-tick kb-hero-tick-long' : 'kb-hero-tick'}
            />
          );
        })}
        <g className="kb-hero-needle">
          <line x1="200" y1="200" x2="200" y2="84" />
          <circle cx="200" cy="200" r="9" />
        </g>
      </svg>
    </div>
  );
}
