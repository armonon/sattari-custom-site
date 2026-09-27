import { memo } from 'react';
import ArrangementSequencer from '../../components/studio/ArrangementSequencer';

/** Beat pattern picker and transport around the drum step sequencer. */
function SequencerPanel({ tracks, selected, busy, ready, playing, bpm, position, commands }) {
  const drums = selected?.kind === 'midi' && selected.instrument === 'drums';
  return (
    <div>
      <div className="ae-beat-toolbar" role="group" aria-label="Beat pattern tools">
        <label>
          Pattern{' '}
          <select
            aria-label="Edit beat pattern"
            value={selected?.instrument === 'drums' ? selected.id : ''}
            disabled={busy || !ready}
            onChange={(event) => commands.select(event.target.value)}
          >
            <option value="" disabled>
              Select a drum pattern
            </option>
            {tracks.flatMap((track) =>
              track.clips
                .filter((clip) => clip.kind === 'midi' && clip.instrument === 'drums')
                .map((clip) => (
                  <option key={clip.id} value={clip.id}>
                    {track.name} · {clip.name}
                  </option>
                ))
            )}
          </select>
        </label>
        <button type="button" disabled={busy || !ready} onClick={() => commands.addMidi('drums')}>
          New beat
        </button>
        <button
          type="button"
          aria-label={
            playing ? 'Pause arrangement from sequencer' : 'Play arrangement from sequencer'
          }
          disabled={busy || !ready}
          onClick={commands.toggle}
        >
          {playing ? 'Pause arrangement' : 'Play arrangement'}
        </button>
        <button
          type="button"
          disabled={busy || !ready || selected?.instrument !== 'drums'}
          onClick={commands.loopPattern}
        >
          Set pattern loop
        </button>
        <button type="button" onClick={commands.openPiano}>
          Open piano roll
        </button>
      </div>
      {drums ? (
        <ArrangementSequencer
          key={selected.id}
          clip={selected}
          bpm={bpm}
          disabled={busy || !ready}
          positionRef={position}
          playing={playing}
          onChange={commands.changeClip}
          onAudition={commands.audition}
        />
      ) : (
        <p>Select a drum pattern or choose New beat to start.</p>
      )}
    </div>
  );
}

export default memo(SequencerPanel);
