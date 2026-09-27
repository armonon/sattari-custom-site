const AUDIO_TYPES = 'audio/*,.wav,.mp3,.flac,.aif,.aiff,.m4a';
const chosenFiles = (event) => {
  const files = Array.from(event.target.files || []).map((file) => ({ file }));
  event.target.value = '';
  return files;
};

/** Hidden pickers for MIDI import, audio import and relinking a missing source. */
export function SourceInputs({ midiRef, audioRef, relinkRef, onMidi, onAudio, onRelink }) {
  return (
    <>
      <input
        ref={midiRef}
        type="file"
        accept=".mid,.midi,audio/midi"
        multiple
        hidden
        aria-label="Import MIDI files"
        onChange={(event) => onMidi(chosenFiles(event))}
      />
      <input
        ref={audioRef}
        type="file"
        accept={AUDIO_TYPES}
        multiple
        hidden
        aria-label="Import arrangement audio"
        onChange={(event) => onAudio(chosenFiles(event))}
      />
      <input
        ref={relinkRef}
        type="file"
        accept={AUDIO_TYPES}
        hidden
        aria-label="Relink arrangement source"
        onChange={(event) => onRelink(chosenFiles(event)[0]?.file)}
      />
    </>
  );
}

/** Finished recordings that can be added as reference lanes. */
export function RecordedTakes({ recordings, disabled, onAdd }) {
  return (
    <details className="ae-captures">
      <summary>Recorded takes · add to arrangement</summary>
      <div className="ae-actions">
        {recordings.map((recording) => (
          <button
            type="button"
            disabled={disabled}
            key={recording.id}
            onClick={() => void onAdd(recording)}
          >
            Add take: {recording.name}
          </button>
        ))}
      </div>
    </details>
  );
}
