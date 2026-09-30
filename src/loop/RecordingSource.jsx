import { AudioLines, Layers3 } from 'lucide-react';

export default function RecordingSource({ source, onChange }) {
  return (
    <div className="lf-recording-source">
      <span>Listen & compare</span>
      <div role="group" aria-label="Recording playback source">
        <button
          type="button"
          aria-pressed={source === 'original'}
          onClick={() => onChange('original')}
        >
          <AudioLines size={15} /> Original song
        </button>
        <button
          type="button"
          aria-pressed={source === 'instruments'}
          onClick={() => onChange('instruments')}
        >
          <Layers3 size={15} /> Instruments
        </button>
      </div>
      <small>
        The instrumental part keeps the original timing. It can include guitar, keys and other
        instruments.
      </small>
    </div>
  );
}
