import { memo, useState } from 'react';
import MidiInputRecorder from '../../components/studio/MidiInputRecorder';
import { recoverSourceCaptures } from '../../utils/sourceCapture';
import { journalStore } from '../../utils/performanceJournal';
import { deleteLocator, recoverEvents, recoverSourceTake, renameLocator } from './projectEdits';

/** "Loop, locators & MIDI recording", including take recovery. */
function LoopPanel({
  busy,
  ready,
  bpm,
  grid,
  loop,
  selected,
  selectedTrack,
  project,
  master,
  getEngine,
  getArrangementEngine,
  getPosition,
  commands,
}) {
  const [recoveries, setRecoveries] = useState([]);
  const [eventRecoveries, setEventRecoveries] = useState([]);
  return (
    <details className="ae-session-tools">
      <summary>Loop, locators & MIDI recording</summary>
      <div className="ae-fields">
        <label>
          <input
            type="checkbox"
            checked={loop.enabled}
            disabled={busy}
            onChange={(event) => commands.changeLoop({ enabled: event.target.checked })}
          />
          Loop region
        </label>
        <label>
          Loop start (s)
          <input
            type="number"
            min="0"
            step={60 / bpm / grid}
            value={loop.start}
            disabled={busy}
            onChange={(event) => commands.changeLoop({ start: Number(event.target.value) })}
          />
        </label>
        <label>
          Loop end (s)
          <input
            type="number"
            min="0.25"
            step={60 / bpm / grid}
            value={loop.end}
            disabled={busy}
            onChange={(event) => commands.changeLoop({ end: Number(event.target.value) })}
          />
        </label>
        <button
          type="button"
          disabled={busy || !selected || selected.duration < 0.25}
          onClick={() =>
            commands.changeLoop({
              start: selected.start,
              end: selected.start + selected.duration,
              enabled: true,
            })
          }
        >
          Loop selected clip
        </button>
        <button type="button" disabled={busy} onClick={commands.addLocator}>
          Add locator at playhead
        </button>
      </div>
      <div className="ae-actions">
        {(project.locators || []).map((marker) => (
          <span key={marker.id} className="ae-locator">
            <input
              aria-label={`Locator name ${marker.name}`}
              value={marker.name}
              disabled={busy}
              onChange={(event) =>
                commands.edit((next) => renameLocator(next, marker.id, event.target.value))
              }
            />
            <button type="button" disabled={busy} onClick={() => void commands.seek(marker.time)}>
              Go to {marker.name} · {marker.time.toFixed(2)}s
            </button>
            <button
              type="button"
              aria-label={`Delete locator ${marker.name}`}
              disabled={busy}
              onClick={() => commands.edit((next) => deleteLocator(next, marker.id))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="ae-actions">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            try {
              setRecoveries(await recoverSourceCaptures());
              setEventRecoveries(await journalStore.recover());
              commands.setMessage(
                'Stored source chunks are recovery copies. Recovered lanes are muted until you choose to use them.'
              );
            } catch (error) {
              commands.setMessage(error.message);
            }
          }}
        >
          Find recoverable source takes
        </button>
        {eventRecoveries.map((take) => (
          <button
            type="button"
            key={take.id}
            disabled={busy}
            onClick={() => commands.edit((next) => recoverEvents(next, take, recoveries))}
          >
            Recover events: {take.name} · {take.events.length} · {take.duration.toFixed(1)}s
          </button>
        ))}
        {recoveries.map((take) => (
          <button
            type="button"
            key={take.id}
            disabled={busy}
            onClick={() => commands.edit((next) => recoverSourceTake(next, take))}
          >
            Recover {take.name}
          </button>
        ))}
      </div>
      <MidiInputRecorder
        getOwner={getEngine}
        getInstrumentEngine={getArrangementEngine}
        getPosition={getPosition}
        master={master}
        instrument={selected?.instrument || 'triangle'}
        voiceContext={{
          clip: selected?.kind === 'midi' ? selected : null,
          track: selectedTrack,
          project,
        }}
        disabled={busy || !ready}
        looping={loop.enabled}
        onRecordingChange={commands.recordingChange}
        onRecorded={commands.recorded}
      />
    </details>
  );
}

export default memo(LoopPanel);
