import { useEffect, useRef, useState } from 'react';
import { alignScore, importScore } from './scoreImport';
import { wavBlob } from './lessonMedia';
import { TabGuide } from './Guides';

export default function ScoreImport({ onImport }) {
  const [tracks, setTracks] = useState([]),
    [trackIndex, setTrackIndex] = useState(0);
  const [offset, setOffset] = useState(0),
    [tempo, setTempo] = useState(120);
  const [recording, setRecording] = useState(null),
    [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [duration, setDuration] = useState(null);
  const [selected, setSelected] = useState(0);
  const job = useRef(null),
    audio = useRef(null);
  useEffect(() => () => job.current?.abort(), []);
  useEffect(() => {
    if (!recording) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(recording);
    setUrl(next);
    setDuration(null);
    return () => URL.revokeObjectURL(next);
  }, [recording]);
  const track = tracks[trackIndex];
  const load = async (file) => {
    if (!file) return;
    job.current?.abort();
    const controller = new AbortController();
    job.current = controller;
    setBusy(true);
    setError('');
    setTracks([]);
    try {
      const next = await importScore(file, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setTracks(next);
      setTrackIndex(0);
      setSelected(0);
      setTempo(next[0].bpm);
      setOffset(0);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const save = () => {
    try {
      const lesson = alignScore(track, Number(offset), Number(tempo));
      if (recording && (!duration || lesson.duration > duration + 0.25))
        throw new Error(
          'The aligned score extends beyond the recording. Check the start offset and tempo.'
        );
      if (lesson.duration > 480) throw new Error('Keep the aligned excerpt under eight minutes.');
      const file = recording || wavBlob(lesson.polyphonicNotes || lesson.notes, lesson.duration);
      audio.current?.pause();
      onImport({
        lesson: { ...lesson, synthesizedReference: !recording },
        file,
        practiceFile: null,
      });
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="lc-score-import">
      <p>
        Bring a written part into guided practice. Choose a track, then optionally line it up with
        your recording.
      </p>
      <label className="lc-file">
        Choose Guitar Pro or MusicXML
        <input
          type="file"
          accept=".gp,.gp3,.gp4,.gp5,.gpx,.musicxml,.xml,.mxl"
          onChange={(e) => {
            void load(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      <small>
        Guitar Pro 3–8 and MusicXML · up to 8 MB · steady-tempo 4/4 excerpts. Repeats are read once.
      </small>
      {busy && (
        <p role="status">
          Reading your score on this device…{' '}
          <button
            type="button"
            onClick={() => {
              job.current?.abort();
              setBusy(false);
            }}
          >
            Cancel
          </button>
        </p>
      )}
      {track && (
        <>
          <div className="lc-fields">
            <label>
              Guitar part
              <select
                value={trackIndex}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  setTrackIndex(i);
                  setSelected(0);
                  setTempo(tracks[i].bpm);
                }}
              >
                {tracks.map((t, i) => (
                  <option value={i} key={i}>
                    {t.trackName} · {t.notes.length} melody notes
                  </option>
                ))}
              </select>
            </label>
            <label>
              Start in recording (seconds)
              <input
                type="number"
                min="0"
                max="120"
                step="0.01"
                value={offset}
                onChange={(e) => setOffset(e.target.value)}
              />
            </label>
            <label>
              Recording tempo (BPM)
              <input
                type="number"
                min="30"
                max="240"
                step="0.1"
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
              />
            </label>
          </div>
          <p>
            {track.polyphonicNotes
              ? 'Melody practice uses the highest note at each attack. The chord-tone guide retains simultaneous notes.'
              : 'This part contains a single-note line.'}{' '}
            Compare the imported fingering with your guitar setup.
          </p>
          <TabGuide
            notes={track.notes.slice(0, 8).map((n, i) => ({ ...n, index: i }))}
            active={selected}
            onSelect={setSelected}
          />
          <label className="lc-file">
            Attach a recording (optional)
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file?.size > 40 * 1024 ** 2) setError('Choose audio smaller than 40 MB.');
                else {
                  setRecording(file || null);
                  setError('');
                }
                e.target.value = '';
              }}
            />
          </label>
          {url ? (
            <>
              <audio
                ref={audio}
                src={url}
                controls
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onError={() =>
                  setError('This audio format could not play. Choose another recording.')
                }
              />
              <button
                className="lj-text-link"
                type="button"
                onClick={() => {
                  if (audio.current) {
                    audio.current.currentTime = Math.max(0, Number(offset));
                    void audio.current
                      .play()
                      .catch(() => setError('Press play on the recording to listen.'));
                  }
                }}
              >
                Hear the aligned start
              </button>
            </>
          ) : (
            <p>
              Without a recording, Sattari Learn creates a synthesized pitch reference from the
              score.
            </p>
          )}
          <button className="loop-button loop-button-purple" type="button" onClick={save}>
            Create lesson from this part
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="lc-warning">
          {error}
        </p>
      )}
    </div>
  );
}
