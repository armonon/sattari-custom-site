import { CIRCLE } from './keyTheory';

// One analog instrument, used twice: as the idle hero before any track is
// measured, and live in the readout with the needle on the shown tempo.
export const DIAL_MIN_BPM = 40;
export const DIAL_MAX_BPM = 220;
const SWEEP = 120; // degrees either side of 12 o'clock
const TICKS = Array.from({ length: 37 }, (_, i) => i); // one per 5 BPM
const polar = (r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [200 + r * Math.cos(rad), 200 + r * Math.sin(rad)];
};

/** Needle angle in degrees for a tempo, clamped to the dial's scale. */
export function dialAngle(bpm) {
  const clamped = Math.min(DIAL_MAX_BPM, Math.max(DIAL_MIN_BPM, bpm));
  return -SWEEP + ((clamped - DIAL_MIN_BPM) / (DIAL_MAX_BPM - DIAL_MIN_BPM)) * 2 * SWEEP;
}

/**
 * bpm: number → needle rests on that tempo; null → idle sweep.
 * beating: flash the lamp once per beat (the metronome is running).
 * keyIndex: circle-of-fifths slot to light on the outer ring.
 */
export function TempoDial({ bpm = null, beating = false, keyIndex = null, className = '' }) {
  const live = Number.isFinite(bpm);
  return (
    <svg
      className={`kb-dial ${live ? 'is-live' : 'is-idle'} ${className}`}
      viewBox="0 0 400 400"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="200" cy="200" r="190" className="kb-dial-plate" />
      {CIRCLE.map(({ index, major }) => {
        const [x, y] = polar(168, index * 30);
        return (
          <text
            key={index}
            x={x}
            y={y}
            dy="5"
            textAnchor="middle"
            className={`kb-dial-key ${keyIndex === index ? 'is-key' : ''}`}
          >
            {major}
          </text>
        );
      })}
      {TICKS.map((i) => {
        const deg = -SWEEP + i * ((2 * SWEEP) / 36);
        const long = i % 4 === 0;
        const [x1, y1] = polar(long ? 116 : 126, deg);
        const [x2, y2] = polar(134, deg);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={long ? 'kb-dial-tick is-long' : 'kb-dial-tick'}
          />
        );
      })}
      {[60, 120, 180].map((mark) => {
        const [x, y] = polar(98, dialAngle(mark));
        return (
          <text key={mark} x={x} y={y} dy="5" textAnchor="middle" className="kb-dial-mark">
            {mark}
          </text>
        );
      })}
      <g
        className="kb-dial-needle"
        style={live ? { transform: `rotate(${dialAngle(bpm).toFixed(2)}deg)` } : undefined}
      >
        <line x1="200" y1="222" x2="200" y2="84" />
      </g>
      <circle
        cx="200"
        cy="200"
        r="10"
        className={`kb-dial-hub ${beating && live ? 'is-beating' : ''}`}
        style={beating && live ? { animationDuration: `${(60 / bpm).toFixed(4)}s` } : undefined}
      />
    </svg>
  );
}

// ---- The meter: the same instrument as the hub tile artwork ----------------
// (public/images/tools/key-bpm-hero-ink.jpg is this drawing at 120 BPM, 8B,
// C major.) Fixed "ink" colours in both themes so the tile and the app match.
const METER_MIN = 20;
const METER_MAX = 220;
const METER_SWEEP = 135;
const METER_TICKS = Array.from({ length: 61 }, (_, i) => i);
const meterPoint = (r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [720 + r * Math.cos(rad), 500 + r * Math.sin(rad)];
};
export function meterAngle(bpm) {
  const clamped = Math.min(METER_MAX, Math.max(METER_MIN, bpm));
  return -METER_SWEEP + ((clamped - METER_MIN) / (METER_MAX - METER_MIN)) * 2 * METER_SWEEP;
}

/**
 * bpm / keyName / camelot: what the selected track shows; all empty = waiting
 * for a song. beating: pulse the hub once per beat while the click runs.
 */
export function KeyBpmMeter({
  bpm = null,
  bpmText = '',
  keyName = '',
  camelot = '',
  keyIndex = null,
  beating = false,
}) {
  const live = Number.isFinite(bpm);
  const caption =
    live || keyName
      ? ['BPM', camelot, keyName.toUpperCase()].filter(Boolean).join(' · ')
      : 'ADD A SONG TO READ ITS TEMPO AND KEY';
  return (
    <figure className={`kb-meter ${live ? 'is-live' : 'is-idle'}`}>
      <svg
        viewBox="250 30 940 940"
        role="img"
        aria-label={
          live || keyName
            ? `Tempo and key meter: ${[live && `${bpmText || bpm} BPM`, camelot, keyName].filter(Boolean).join(', ')}`
            : 'Tempo and key meter, waiting for a song'
        }
      >
        <circle cx="720" cy="500" r="440" className="kb-meter-ring" />
        <circle cx="720" cy="500" r="320" className="kb-meter-ring is-inner" />
        {CIRCLE.map(({ index, major }) => {
          const [x, y] = meterPoint(400, index * 30);
          return (
            <text
              key={index}
              x={x}
              y={y}
              dy="8"
              textAnchor="middle"
              className={`kb-meter-key ${keyIndex === index ? 'is-key' : ''}`}
            >
              {major}
            </text>
          );
        })}
        {METER_TICKS.map((i) => {
          const deg = -METER_SWEEP + i * 4.5;
          const long = i % 5 === 0;
          const [x1, y1] = meterPoint(long ? 250 : 262, deg);
          const [x2, y2] = meterPoint(278, deg);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={long ? 'kb-meter-tick is-long' : 'kb-meter-tick'}
            />
          );
        })}
        <g
          className="kb-meter-needle"
          style={live ? { transform: `rotate(${meterAngle(bpm).toFixed(2)}deg)` } : undefined}
        >
          <line x1="720" y1="500" x2="720" y2="270" />
        </g>
        <circle
          cx="720"
          cy="500"
          r="16"
          className={`kb-meter-hub ${beating && live ? 'is-beating' : ''}`}
          style={beating && live ? { animationDuration: `${(60 / bpm).toFixed(4)}s` } : undefined}
        />
        <circle cx="720" cy="500" r="6" className="kb-meter-pin" />
        <text x="720" y="650" textAnchor="middle" className="kb-meter-value">
          {live ? bpmText || bpm : '—'}
        </text>
        <text x="720" y="760" textAnchor="middle" className="kb-meter-caption">
          {caption}
        </text>
      </svg>
    </figure>
  );
}
