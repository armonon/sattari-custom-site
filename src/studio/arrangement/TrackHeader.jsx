import { memo } from 'react';
import { bounded } from '../../utils/arrangementModel';
import { MASTER_STEMS } from '../../utils/masterOutput';
import { deleteTrack, duplicateTrack, moveTrack, toggleTrackOffline } from './projectEdits';

function TrackHeader({ track, first, last, busy, commands }) {
  const change = (updates) => commands.changeTrack(track.id, updates);
  const edit = (operation, ...args) => commands.edit((next) => operation(next, track.id, ...args));
  return (
    <div className="ae-track-head">
      <input
        aria-label={`Track name ${track.name}`}
        value={track.name}
        onChange={(event) => change({ name: event.target.value })}
        disabled={busy}
      />
      <small>
        {track.role === 'reference'
          ? 'Printed reference · bypasses master processing'
          : track.kind === 'midi'
            ? 'Instrument'
            : 'Audio'}
      </small>
      <button
        type="button"
        aria-label={`Open devices for ${track.name}`}
        onClick={() => commands.openDevices(track.id)}
      >
        Devices · {track.effects?.length || 0} FX
      </button>
      <details className="ae-track-options">
        <summary aria-label={`Track options for ${track.name}`} title="Track options">
          <span className="ae-track-options-label">Track options</span>
          <span className="ae-track-options-symbol" aria-hidden="true">
            •••
          </span>
        </summary>
        <label>
          Gain
          <input
            aria-label={`Gain ${track.name}`}
            type="number"
            min="0"
            max="300"
            value={track.gain}
            onChange={(event) => change({ gain: bounded(event.target.value, 0, 300) })}
            disabled={busy}
          />
        </label>
        <label>
          Pan
          <input
            aria-label={`Pan ${track.name}`}
            type="range"
            min="-1"
            max="1"
            step=".05"
            value={track.pan}
            onChange={(event) => change({ pan: Number(event.target.value) })}
            disabled={busy}
          />
        </label>
        <label>
          Master stem group
          <select
            aria-label={`Master stem group ${track.name}`}
            value={track.stemRole || 'unseparated'}
            disabled={busy}
            onChange={(event) => change({ stemRole: event.target.value })}
          >
            {MASTER_STEMS.map(({ id, label }) => (
              <option value={id} key={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          aria-pressed={!!track.offline}
          onClick={() => edit(toggleTrackOffline)}
        >
          {track.offline ? 'Bring track online' : 'Set track offline'}
        </button>
        <button type="button" disabled={busy} onClick={() => edit(duplicateTrack)}>
          Duplicate track
        </button>
        <button type="button" disabled={busy || first} onClick={() => edit(moveTrack, -1)}>
          Move track up
        </button>
        <button type="button" disabled={busy || last} onClick={() => edit(moveTrack, 1)}>
          Move track down
        </button>
        <button type="button" disabled={busy} onClick={() => edit(deleteTrack)}>
          Delete track
        </button>
        <label>
          Track color
          <input
            type="color"
            value={track.color || '#6b9cbe'}
            onChange={(event) => change({ color: event.target.value })}
          />
        </label>
      </details>
      <div className="ae-track-mix">
        <button
          type="button"
          aria-label={`Mute ${track.name}`}
          aria-pressed={track.muted}
          onClick={() => change({ muted: !track.muted })}
          disabled={busy}
        >
          M
        </button>
        <button
          type="button"
          aria-label={`Solo ${track.name}`}
          aria-pressed={track.solo}
          onClick={() => change({ solo: !track.solo })}
          disabled={busy}
        >
          S
        </button>
      </div>
      <div className="ae-track-add">
        <button
          type="button"
          aria-label={track.kind === 'midi' ? '+ Pattern' : '+ Audio'}
          title={
            track.kind === 'midi' ? `Add pattern to ${track.name}` : `Add audio to ${track.name}`
          }
          disabled={busy}
          onClick={() => commands.addToTrack(track.id, track.kind)}
        >
          <span aria-hidden="true">+</span>
          <span className="ae-track-add-label">
            {track.kind === 'midi' ? ' Pattern' : ' Audio'}
          </span>
        </button>
      </div>
    </div>
  );
}

export default memo(TrackHeader);
