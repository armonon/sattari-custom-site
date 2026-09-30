import { ArrowRight, FileAudio, Guitar, Layers3, Upload } from 'lucide-react';
import { useState } from 'react';

export default function ImportSetup({ importer, onChooseFile }) {
  const [preparation, setPreparation] = useState('solo');
  const [detail, setDetail] = useState('melody');
  const file = importer.selectedFile;
  return (
    <div className="lf-import-setup">
      <button
        type="button"
        className={`loop-drop-zone${file ? ' has-file' : ''}`}
        onClick={onChooseFile}
      >
        <span>{file ? <FileAudio size={25} /> : <Upload size={26} strokeWidth={1.4} />}</span>
        <strong>{file ? file.name : 'Drop your song here'}</strong>
        <span>{file ? 'Choose a different recording' : 'or choose a file'}</span>
        <small>
          {file
            ? `${(file.size / 1024 ** 2).toFixed(1)} MB · Ready when you are`
            : 'MP3, WAV, M4A, OGG, FLAC · Up to 40 MB / 8 min'}
        </small>
      </button>
      {file && (
        <>
          <fieldset className="lf-import-options">
            <legend>What are we listening to?</legend>
            <label className={preparation === 'solo' ? 'is-selected' : ''}>
              <input
                type="radio"
                name="preparation"
                value="solo"
                checked={preparation === 'solo'}
                onChange={() => setPreparation('solo')}
              />
              <Guitar size={23} />
              <span>
                <strong>Guitar on its own</strong>
                <small>A riff, melody or solo recording. Analyze the original audio.</small>
              </span>
            </label>
            <label className={preparation === 'instruments' ? 'is-selected' : ''}>
              <input
                type="radio"
                name="preparation"
                value="instruments"
                checked={preparation === 'instruments'}
                onChange={() => setPreparation('instruments')}
              />
              <Layers3 size={23} />
              <span>
                <strong>A full-band song</strong>
                <small>Reduce vocals, bass and drums first, then analyze the instruments.</small>
              </span>
            </label>
          </fieldset>
          <label className="lf-harmony-choice">
            <input
              type="checkbox"
              checked={detail === 'harmony'}
              onChange={(event) => setDetail(event.target.checked ? 'harmony' : 'melody')}
            />
            <span>
              <strong>Include chords & overlapping notes</strong>
              <small>
                Experimental. For strumming and fingerstyle. Adds an editable draft alongside your
                melody guide.
              </small>
            </span>
          </label>
          <p className="lf-import-expectation" role="status">
            {preparation === 'instruments'
              ? 'Best on a desktop. First use downloads a 172 MB model and may take several minutes. Other instruments can remain, and low guitar notes may be removed with the bass. Compare with your original before practicing.'
              : 'Auto Pitch follows one note at a time. Chords get a separate draft chart; a clean melody gives the clearest tablature.'}
          </p>
          <button
            type="button"
            className="loop-button loop-button-purple lf-import-start"
            onClick={() =>
              void importer.importSong(file, {
                preparation,
                ...(detail === 'harmony' ? { detail } : {}),
              })
            }
          >
            Build my practice guide <ArrowRight size={17} />
          </button>
        </>
      )}
      <div className="lf-import-engine">
        <span>SATTARI AUTOKEY + AUTO PITCH</span>
        <small>Local analysis. Your recording stays on this device.</small>
      </div>
    </div>
  );
}
