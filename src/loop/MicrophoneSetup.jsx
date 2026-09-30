import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Mic } from 'lucide-react';
import { noteName } from './music';
import { useGuitarProfile } from './GuitarSetup';
import { openStrings } from './guitarProfile';

export function InputMeter({ level = { db: -120, peak: 0 } }) {
  const percent = Math.max(0, Math.min(100, ((level.db + 60) * 100) / 60));
  return (
    <div
      className="lf-input-meter"
      role="meter"
      aria-label="Microphone input level"
      aria-valuemin={-60}
      aria-valuemax={0}
      aria-valuenow={Math.max(-60, Math.round(level.db))}
      aria-valuetext={
        level.peak >= 0.98
          ? 'Clipping: move the microphone farther away'
          : `${Math.round(level.db)} decibels`
      }
    >
      <span style={{ width: `${percent}%` }} className={level.peak >= 0.98 ? 'is-clipping' : ''} />
    </div>
  );
}

export default function MicrophoneSetup({ mic, onReady }) {
  const { profile } = useGuitarProfile();
  const tuning = openStrings(profile);
  const [string, setString] = useState(tuning[0]);
  const [verified, setVerified] = useState(false);
  const calibration = mic.calibration || { state: 'idle' };
  useEffect(() => {
    setVerified(false);
  }, [mic.deviceId, calibration.state, string]);
  useEffect(() => {
    if (
      calibration.state === 'ready' &&
      mic.pitch?.midi === string &&
      Math.abs(mic.pitch.cents) <= 35
    )
      setVerified(true);
  }, [mic.pitch, string, calibration.state]);
  return (
    <div className="lf-input-setup">
      <div className="lf-input-heading">
        <Mic size={19} />
        <strong>Make sure we can hear you.</strong>
      </div>
      <label className="lf-device-label">
        Audio input
        <select
          aria-label="Audio input"
          value={mic.deviceId || ''}
          onChange={(e) => void mic.start(e.target.value)}
        >
          <option value="">Default microphone</option>
          {mic.devices
            ?.filter((d) => d.deviceId !== 'default' && d.deviceId)
            .map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${i + 1}`}
              </option>
            ))}
        </select>
      </label>
      <InputMeter level={mic.level} />
      {mic.status !== 'listening' ? (
        <button
          type="button"
          className="loop-button loop-button-purple"
          onClick={() => (mic.status === 'requesting' ? mic.stop() : void mic.start())}
        >
          {mic.status === 'requesting' ? 'Cancel connection' : 'Enable microphone'}{' '}
          <ArrowRight size={16} />
        </button>
      ) : (
        <>
          <div className="lf-calibration-step">
            <strong>1. Find the room’s quiet level</strong>
            <p>Mute your strings and stay quiet for two seconds.</p>
            <button
              type="button"
              className="loop-button loop-button-secondary"
              disabled={calibration.state === 'measuring'}
              onClick={() => mic.calibrate()}
            >
              {calibration.state === 'measuring'
                ? 'Listening to your room…'
                : calibration.state === 'ready'
                  ? 'Recalibrate room'
                  : 'Calibrate room'}
            </button>
            {calibration.state === 'measuring' && (
              <progress aria-label="Room calibration" max="1" value={calibration.progress} />
            )}
          </div>
          {calibration.state === 'ready' && (
            <div className="lf-calibration-step">
              <strong>2. Pluck an open string</strong>
              <div className="lf-tuning-strings" aria-label="Choose an open string to check">
                {tuning.map((midi) => (
                  <button
                    key={midi}
                    type="button"
                    aria-pressed={string === midi}
                    onClick={() => setString(midi)}
                  >
                    {noteName(midi)}
                  </button>
                ))}
              </div>
              <p role="status">
                {mic.level?.peak >= 0.98
                  ? 'The signal is clipping. Lower the input gain or move farther away.'
                  : verified
                    ? 'Clear and in tune. You’re ready to play.'
                    : mic.pitch
                      ? `Hearing ${noteName(mic.pitch.midi)}${mic.pitch.midi === string ? ` · ${Math.abs(mic.pitch.cents)} cents ${mic.pitch.cents >= 0 ? 'sharp' : 'flat'}` : `. Aim for ${noteName(string)}`}.`
                      : `Pluck ${noteName(string)} and let it ring. Move closer if the meter barely moves.`}
              </p>
              {calibration.threshold > 0.04 && (
                <p>
                  The room is quite loud. Reduce background sound and recalibrate if notes aren’t
                  detected.
                </p>
              )}
              <button
                type="button"
                className="loop-button loop-button-purple"
                disabled={!verified || mic.level?.peak >= 0.98}
                onClick={onReady}
              >
                <CheckCircle2 size={17} /> Start with a clear signal <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
      {mic.status === 'requesting' && (
        <p role="status">Allow microphone access in your browser to continue.</p>
      )}
      {mic.error && (
        <p className="loop-error" role="alert">
          {mic.error}
        </p>
      )}
    </div>
  );
}
