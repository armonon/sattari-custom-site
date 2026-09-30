import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Guitar,
  Headphones,
  Library,
  ListMusic,
  LoaderCircle,
  Mic,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { SEO } from '../utils/seo';
import { PAGE_SEO } from '../data/siteSeo';
import { LearnWordmark, LoopMark } from '../loop/Hardware';
import {
  activeIndex,
  CHORD_NAMES,
  chordShape,
  DEMO,
  formatTime,
  noteName,
  phrasesFor,
  positionForMidi,
} from '../loop/music';
import { ChordDiagram, Fretboard, StaffGuide, SongStaffGuide, TabGuide } from '../loop/Guides';
import { readLibrary, removeSong, saveSong } from '../loop/library';
import useMicrophone from '../loop/useMicrophone';
import useSongImport from '../loop/useSongImport';
import LoopJourney from '../loop/LoopJourney';
import { downloadPracticeGuide, midiGuide, polyphonicText } from '../loop/exportGuide';
import { waitForScores } from '../loop/printGuide';
import ImportSetup from '../loop/ImportSetup';
import RecordingSource from '../loop/RecordingSource';
import ScoreImport from '../loop/ScoreImportPanel';
import './LoopPracticePage.css';
import '../loop/Hardware.css';
import { GuitarProfileProvider, useGuitarProfile } from '../loop/GuitarSetup';
import {
  openStrings,
  profileLabel,
  positionForProfile,
  profileChord,
  profileChordMidis,
} from '../loop/guitarProfile';
import '../loop/Learning.css';

const NAV = [
  ['practice', 'Practice room', Guitar],
  ['library', 'My songs', Library],
  ['chord-library', 'Chord library', ListMusic],
  ['tuner', 'Guitar tuner', SlidersHorizontal],
];
const VIEWS = [
  ['tab', 'Tablature'],
  ['chords', 'Chord charts'],
  ['staff', 'Sheet music'],
  ['fretboard', 'Fretboard'],
];

function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="loop-modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="loop-modal-heading">
        <h2>{title}</h2>
        <button
          type="button"
          className="loop-icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function Waveform({ peaks, current, duration, onSeek }) {
  return (
    <div className="loop-waveform-wrap">
      <div className="loop-waveform" aria-hidden="true">
        {peaks.map((height, i) => (
          <span
            key={i}
            className={i / peaks.length <= current / duration ? 'is-played' : ''}
            style={{ height: `${Math.max(7, height * 100)}%` }}
          />
        ))}
      </div>
      <input
        className="loop-waveform-seek"
        type="range"
        min="0"
        max={duration}
        step="0.01"
        value={Math.min(current, duration)}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label="Seek in song"
        aria-valuetext={formatTime(current)}
      />
    </div>
  );
}

function useAudition() {
  const context = useRef(null);
  useEffect(
    () => () => {
      void context.current?.close().catch(() => {});
    },
    []
  );
  return async (midis) => {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Audio playback is not supported by this browser.');
    context.current ??= new Context();
    const ctx = context.current;
    await ctx.resume();
    midis.forEach((midi, i) => {
      const oscillator = ctx.createOscillator(),
        envelope = ctx.createGain();
      const time = ctx.currentTime + i * 0.025;
      oscillator.type = 'triangle';
      oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(0.13 / Math.sqrt(midis.length), time + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + 1.1);
      oscillator.connect(envelope);
      envelope.connect(ctx.destination);
      oscillator.start(time);
      oscillator.stop(time + 1.2);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
    });
  };
}

export default function LoopPracticePage() {
  return (
    <GuitarProfileProvider>
      <LoopPracticeApp />
    </GuitarProfileProvider>
  );
}

function LoopPracticeApp() {
  const { profile } = useGuitarProfile();
  const tuning = openStrings(profile);
  const [journey, setJourney] = useState('choose');
  const [practiceProgress, setPracticeProgress] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('loop-practice-progress-v1') || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch {
      return {};
    }
  });
  const [lesson, setLesson] = useState(DEMO);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [practiceFile, setPracticeFile] = useState(null);
  const [practiceUrl, setPracticeUrl] = useState('');
  const [recordingSource, setRecordingSource] = useState('original');
  const [records, setRecords] = useState([]);
  const [nav, setNav] = useState('practice');
  const [view, setView] = useState('tab');
  const [modal, setModal] = useState(null);
  const [importKind, setImportKind] = useState('audio');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [selected, setSelected] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [speed, setSpeed] = useState(0.75);
  const [volume, setVolume] = useState(0.7);
  const [loop, setLoop] = useState(true);
  const [waitForMe, setWaitForMe] = useState(true);
  const [hits, setHits] = useState([]);
  const [toast, setToast] = useState('');
  const [dropActive, setDropActive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [libraryChord, setLibraryChord] = useState('Em');
  const [chordFilter, setChordFilter] = useState('');
  const [tunerString, setTunerString] = useState(0);
  const [printReady, setPrintReady] = useState(false);
  const printRoot = useRef(null);
  useEffect(() => {
    if (!printReady || !printRoot.current) return;
    const controller = new AbortController();
    const afterPrint = () => setPrintReady(false);
    window.addEventListener('afterprint', afterPrint);
    waitForScores(
      printRoot.current,
      phrasesFor(lesson).reduce(
        (count, part) =>
          count +
          (part.notes.length ? 1 : 0) +
          (lesson.polyphonicNotes?.some((n) => n.end > part.start && n.start < part.end) ? 1 : 0),
        0
      ),
      controller.signal
    )
      .then(() => document.fonts?.ready)
      .then(() => {
        if (controller.signal.aborted) return;
        setToast('');
        window.print();
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setToast(error.message);
          setPrintReady(false);
        }
      });
    return () => {
      controller.abort();
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [printReady, lesson]);
  const audio = useRef(null),
    fileInput = useRef(null),
    saveQueue = useRef(Promise.resolve()),
    lastHit = useRef({ midi: null, since: 0, awarded: null });
  const microphone = useMicrophone();
  const stopMicrophone = microphone.stop;
  const audition = useAudition();
  const phrases = useMemo(() => phrasesFor(lesson), [lesson]);
  const phrase = phrases[Math.min(phraseIndex, phrases.length - 1)];
  const currentNote = useMemo(
    () => (lesson.notes[selected] ? positionForProfile(lesson.notes[selected], profile) : null),
    [lesson.notes, selected, profile]
  );
  const chordIndex = activeIndex(lesson.chords, time);
  const currentChord = lesson.chords[chordIndex];
  const sourceUrl =
    practiceFile && recordingSource === 'instruments'
      ? practiceUrl
      : file
        ? fileUrl
        : lesson.audioUrl;
  const changeRecordingSource = (next) => {
    if (next === recordingSource) return;
    audio.current?.pause();
    setPlaying(false);
    setTime(0);
    setRecordingSource(next);
  };
  const isNotesView = view !== 'chords';

  const openLesson = useCallback(
    (next, nextFile = null, nextPracticeFile = null) => {
      audio.current?.pause();
      stopMicrophone();
      setLesson(next);
      setFile(nextFile);
      setPracticeFile(nextPracticeFile);
      setRecordingSource(nextPracticeFile ? 'instruments' : 'original');
      setTime(0);
      setSelected(0);
      setPhraseIndex(0);
      setHits([]);
      setPlaying(false);
      setNav('practice');
      setJourney('overview');
      setLoop(false);
      setEditing(false);
      setView(next.notes.length ? 'tab' : 'chords');
      lastHit.current = { midi: null, since: 0, awarded: null };
      if (audio.current) audio.current.currentTime = 0;
    },
    [stopMicrophone]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [journey]);

  useEffect(() => {
    if (modal === 'import') {
      audio.current?.pause();
      stopMicrophone();
      setJourney((current) => (current === 'focus' ? 'overview' : current));
    }
  }, [modal, stopMicrophone]);

  const importer = useSongImport(
    ({ file: importedFile, practiceFile: preparedFile, lesson: importedLesson }) => {
      openLesson(importedLesson, importedFile, preparedFile);
      setModal(null);
      const record = {
        id: importedLesson.id,
        lesson: importedLesson,
        file: importedFile,
        practiceFile: preparedFile,
        savedAt: Date.now(),
      };
      setRecords((prev) => [record, ...prev]);
      void saveSong(record)
        .then(() => setToast('Song saved on this device.'))
        .catch(() =>
          setToast(
            'Your song is ready. Device storage is unavailable, so it will last for this session.'
          )
        );
    }
  );

  useEffect(() => {
    let active = true;
    readLibrary()
      .then((saved) => {
        if (active)
          setRecords((prev) => [...prev, ...saved.filter((s) => !prev.some((p) => p.id === s.id))]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!practiceFile) {
      setPracticeUrl('');
      return;
    }
    const url = URL.createObjectURL(practiceFile);
    setPracticeUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [practiceFile]);

  useEffect(() => {
    if (!file) {
      setFileUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (audio.current) {
      audio.current.playbackRate = speed;
      audio.current.preservesPitch = true;
      if ('webkitPreservesPitch' in audio.current) audio.current.webkitPreservesPitch = true;
      audio.current.volume = volume;
    }
  }, [speed, volume, sourceUrl]);

  useEffect(() => {
    if (!playing) return;
    let frame;
    const tick = () => {
      const player = audio.current;
      if (!player) return;
      let current = player.currentTime;
      if (loop && current >= phrase.end - 0.02) {
        player.currentTime = phrase.start;
        current = phrase.start;
      }
      setTime(current);
      const index = activeIndex(lesson.notes, current);
      if (index >= 0) setSelected(index);
      if (!loop) {
        const next = phrases.findIndex((p) => current >= p.start && current < p.end);
        if (next >= 0 && next !== phraseIndex) setPhraseIndex(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, loop, phrase, lesson.notes, phrases, phraseIndex]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const seek = useCallback(
    (value) => {
      const next = Math.max(0, Math.min(lesson.duration, value));
      if (audio.current) audio.current.currentTime = next;
      setTime(next);
      const i = activeIndex(lesson.notes, next);
      if (i >= 0) setSelected(i);
      const p = phrases.findIndex((item) => next >= item.start && next < item.end);
      if (p >= 0) setPhraseIndex(p);
    },
    [lesson.duration, lesson.notes, phrases]
  );

  const selectNote = useCallback(
    (index) => {
      if (!lesson.notes[index]) return;
      audio.current?.pause();
      setSelected(index);
      seek(lesson.notes[index].start);
    },
    [lesson.notes, seek]
  );

  useEffect(() => {
    const pitch = microphone.pitch;
    if (
      journey !== 'studio' ||
      microphone.status !== 'listening' ||
      nav !== 'practice' ||
      !isNotesView ||
      !currentNote
    )
      return;
    if (!pitch) {
      lastHit.current = { midi: null, since: 0, awarded: null };
      return;
    }
    if (lastHit.current.midi !== pitch.midi)
      lastHit.current = { midi: pitch.midi, since: performance.now(), awarded: null };
    const match = pitch.midi === currentNote.midi && Math.abs(pitch.cents) <= 35;
    if (
      !match ||
      performance.now() - lastHit.current.since < 180 ||
      lastHit.current.awarded === pitch.midi
    )
      return;
    lastHit.current.awarded = pitch.midi;
    setHits((prev) => (prev.includes(selected) ? prev : [...prev, selected]));
    if (!playing && waitForMe) {
      const next = selected + 1;
      if (next < lesson.notes.length) selectNote(next);
    }
  }, [
    microphone.pitch,
    microphone.status,
    nav,
    isNotesView,
    currentNote,
    selected,
    playing,
    waitForMe,
    lesson.notes.length,
    selectNote,
    journey,
  ]);

  const togglePlayback = async () => {
    if (!audio.current) return;
    if (playing) {
      audio.current.pause();
      return;
    }
    try {
      if (time >= lesson.duration - 0.05 || (loop && (time >= phrase.end || time < phrase.start)))
        seek(phrase.start);
      await audio.current.play();
    } catch {
      setToast('Could not play this recording. Try importing a supported audio file.');
    }
  };

  const hear = async (midis) => {
    if (!midis.length) return;
    try {
      await audition(midis);
    } catch (error) {
      setToast(error.message);
    }
  };

  const changeLesson = (next) => {
    setLesson(next);
    if (file) {
      const record = { id: next.id, lesson: next, file, practiceFile, savedAt: Date.now() };
      setRecords((prev) => prev.map((r) => (r.id === next.id ? record : r)));
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => saveSong(record))
        .catch(() =>
          setToast(
            'This edit is available for this session; device storage is full or unavailable.'
          )
        );
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDropActive(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) {
      audio.current?.pause();
      setImportKind('audio');
      setModal('import');
      importer.selectFile(dropped);
    }
  };

  const changeNav = (id) => {
    setNav(id);
    audio.current?.pause();
    microphone.stop();
    setEditing(false);
  };

  const goTo = (stage) => {
    audio.current?.pause();
    setPlaying(false);
    microphone.stop();
    setJourney(stage);
  };

  const pitch = microphone.pitch;
  const match = currentNote && pitch?.midi === currentNote.midi && Math.abs(pitch.cents) <= 35;
  let feedback = 'A little practice. A little closer.';
  let feedbackDetail = 'Turn on your microphone and play one note at a time.';
  if (microphone.status === 'requesting') {
    feedback = 'Allow your microphone to begin.';
    feedbackDetail = 'Your browser will ask for permission.';
  } else if (microphone.status === 'listening') {
    if (!isNotesView) {
      feedback = pitch ? `Hearing ${noteName(pitch.midi)}` : 'Play one string at a time.';
      feedbackDetail = 'Single-note listening is live. Whole-chord scoring is not available yet.';
    } else if (!currentNote) {
      feedback = 'Choose a lesson with a melody.';
      feedbackDetail = 'Or use the tuner to check individual strings.';
    } else if (!pitch) {
      feedback = `Your turn. Play ${noteName(currentNote.midi)}.`;
      feedbackDetail = 'Use headphones so the microphone hears your guitar.';
    } else {
      feedback = match
        ? 'That’s the note. Nicely done.'
        : `Hearing ${noteName(pitch.midi)}. Aim for ${noteName(currentNote.midi)}.`;
      feedbackDetail = match
        ? 'Hold it cleanly, then move to the next note.'
        : pitch.midi === currentNote.midi
          ? `You’re ${Math.abs(pitch.cents)} cents ${pitch.cents > 0 ? 'sharp' : 'flat'}. Adjust your tuning.`
          : 'Check the string and fret highlighted in your guide.';
    }
  }

  return (
    <div
      className={`loop-app${dropActive ? ' is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('Files')) setDropActive(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDropActive(false);
      }}
      onDrop={handleDrop}
    >
      <SEO {...PAGE_SEO.learn} />
      <input
        ref={fileInput}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
        className="loop-file-input"
        aria-label="Choose an audio file"
        onChange={(e) => {
          const next = e.target.files?.[0];
          e.target.value = '';
          if (next) {
            setImportKind('audio');
            setModal('import');
            importer.selectFile(next);
          }
        }}
      />
      <audio
        ref={audio}
        src={sourceUrl || undefined}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          if (loop) {
            seek(phrase.start);
            void audio.current?.play().catch(() => setToast('Press play to continue.'));
          }
        }}
        onError={() => setToast('This recording could not be loaded. Try another file.')}
      />

      {journey !== 'studio' && (
        <LoopJourney
          stage={journey}
          lesson={lesson}
          records={records}
          sourceUrl={sourceUrl}
          hasPreparedAudio={Boolean(practiceFile)}
          recordingSource={recordingSource}
          onRecordingSource={changeRecordingSource}
          onEditLesson={changeLesson}
          onRebuildOriginal={
            file
              ? () => {
                  importer.selectFile(file);
                  setModal('import');
                }
              : undefined
          }
          onChoose={openLesson}
          onUpload={() => {
            importer.clearError();
            setModal('import');
          }}
          onBack={() => goTo('choose')}
          onExitPractice={() => goTo('overview')}
          onPractice={() => goTo('focus')}
          onTool={(id) => {
            changeNav(id);
            goTo('studio');
          }}
          onStudio={() => {
            changeNav('practice');
            goTo('studio');
            setLoop(true);
          }}
          onExport={() => setModal('export')}
          playing={playing}
          onPreview={() => {
            setLoop(false);
            void togglePlayback();
          }}
          progress={practiceProgress}
          onComplete={(result) => {
            const previous = practiceProgress[lesson.id];
            const bestMatch =
              previous?.fingerprint === result.fingerprint &&
              previous?.total === result.total &&
              Number.isFinite(previous.matched)
                ? Math.max(previous.matched, result.matched)
                : result.matched;
            const next = { ...practiceProgress, [lesson.id]: { ...result, matched: bestMatch } };
            setPracticeProgress(next);
            try {
              localStorage.setItem('loop-practice-progress-v1', JSON.stringify(next));
            } catch {
              setToast(
                'Your progress is available for this session; device storage is unavailable.'
              );
            }
          }}
        />
      )}

      {journey === 'studio' && (
        <>
          <aside className="loop-sidebar">
            <button
              className="loop-brand"
              type="button"
              onClick={() => goTo('choose')}
              aria-label="Sattari Learn song library"
            >
              <LoopMark />
              <LearnWordmark />
            </button>
            <span className="loop-sidebar-eyebrow">A LITTLE EVERY DAY</span>
            <button
              type="button"
              className="loop-journey-studio-back"
              onClick={() => goTo('overview')}
            >
              <ArrowLeft size={14} />
              Back to song overview
            </button>
            <button
              type="button"
              className="loop-journey-studio-back"
              onClick={() => goTo('choose')}
            >
              <Library size={14} />
              Choose a song
            </button>
            <nav aria-label="Sattari Learn navigation">
              {NAV.map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  className={nav === id ? 'is-active' : ''}
                  onClick={() => changeNav(id)}
                  aria-current={nav === id ? 'page' : undefined}
                >
                  <Icon size={18} strokeWidth={1.6} />
                  <span>{label}</span>
                  {nav === id && <i />}
                </button>
              ))}
            </nav>
            <div className="loop-sidebar-songs">
              <div className="loop-sidebar-section">
                <span>YOUR SONGS</span>
                <button type="button" onClick={() => setModal('import')} aria-label="Add a song">
                  <Plus size={16} />
                </button>
              </div>
              <button
                className={`loop-saved-song${lesson.id === DEMO.id ? ' is-current' : ''}`}
                type="button"
                onClick={() => openLesson(DEMO)}
              >
                <span className="loop-mini-art">
                  <AudioLines size={17} />
                </span>
                <span>
                  <strong>Night shift</strong>
                  <small>Original lesson</small>
                </span>
              </button>
              {records.slice(0, 3).map((record) => (
                <button
                  className={`loop-saved-song${lesson.id === record.id ? ' is-current' : ''}`}
                  key={record.id}
                  type="button"
                  onClick={() => openLesson(record.lesson, record.file, record.practiceFile)}
                >
                  <span className="loop-mini-art imported">
                    <Music2 size={16} />
                  </span>
                  <span>
                    <strong>{record.lesson.title}</strong>
                    <small>Saved on this device</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="loop-sidebar-bottom">
              <div className="loop-small-guitar">
                <Guitar size={22} strokeWidth={1.4} />
                <span>
                  Your guitar, your pace.<small>Make a little room for music.</small>
                </span>
              </div>
              <Link to="/hub">
                <ArrowLeft size={14} /> Sattari Hub
              </Link>
            </div>
          </aside>

          <div className="loop-workspace">
            <header className="loop-topbar">
              <div>
                <span className="loop-breadcrumb">YOUR SPACE TO PLAY</span>
                <span className="loop-topbar-location">{NAV.find((n) => n[0] === nav)?.[1]}</span>
              </div>
              <div className="loop-topbar-actions">
                <span className="loop-local-label">
                  <span />
                  Audio stays on your device
                </span>
                <button
                  type="button"
                  className="loop-button loop-button-dark"
                  onClick={() => {
                    importer.clearError();
                    setModal('import');
                  }}
                >
                  <Plus size={16} /> Add a song
                </button>
              </div>
            </header>

            {nav === 'practice' && (
              <div className="loop-practice-content">
                <div className="loop-intro">
                  <div>
                    <div className="loop-eyebrow">
                      <span /> LET’S MAKE SOME MUSIC
                    </div>
                    <h1>
                      A little closer to <em>playing it.</em>
                    </h1>
                    <p>Take it one phrase at a time. The rest will follow.</p>
                  </div>
                  <button
                    type="button"
                    className="loop-button loop-button-quiet"
                    onClick={() => setModal('export')}
                  >
                    <ArrowDownToLine size={16} /> Practice sheet
                  </button>
                </div>

                <section className="loop-song-panel" aria-label="Current song">
                  <div className="loop-cover" aria-hidden="true">
                    <div className="loop-cover-rings" />
                    <span>
                      SATTARI
                      <br />
                      SESSIONS
                    </span>
                    <AudioLines size={42} strokeWidth={1} />
                    <small>VOL. 01</small>
                  </div>
                  <div className="loop-song-info">
                    <div className="loop-song-kicker">
                      {lesson.source === 'demo'
                        ? 'MADE FOR YOUR FIRST SESSION'
                        : 'YOUR RECORDING · ESTIMATED ANALYSIS'}
                    </div>
                    <h2>{lesson.title}</h2>
                    <p>{lesson.artist}</p>
                    <div className="loop-song-tags">
                      <span>
                        <Guitar size={13} /> Guitar
                      </span>
                      <span>
                        {lesson.bpm} BPM{lesson.source !== 'demo' ? ' est.' : ''}
                      </span>
                      <span>
                        {lesson.key}
                        {lesson.source !== 'demo' ? ' est.' : ''}
                      </span>
                      <span>{profileLabel(profile)}</span>
                    </div>
                  </div>
                  <div className="loop-song-length">
                    <Disc3 size={20} strokeWidth={1.2} />
                    <span>{formatTime(lesson.duration)}</span>
                    <small>
                      {lesson.source === 'demo'
                        ? 'Original lesson'
                        : `${lesson.notes.length} estimated notes`}
                    </small>
                  </div>
                </section>

                {practiceFile && (
                  <RecordingSource source={recordingSource} onChange={changeRecordingSource} />
                )}
                <div className="loop-session-grid">
                  <section className="loop-lesson-panel">
                    <div className="loop-lesson-toolbar">
                      <div className="loop-guide-tabs" role="tablist" aria-label="Learning guide">
                        {VIEWS.map(([id, label]) => (
                          <button
                            id={`loop-tab-${id}`}
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={view === id}
                            aria-controls="loop-guide-panel"
                            onClick={() => {
                              setView(id);
                              setEditing(false);
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <button
                        className={`loop-icon-button${editing ? ' is-active' : ''}`}
                        type="button"
                        aria-label="Edit lesson notes and chords"
                        aria-pressed={editing}
                        onClick={() => setEditing(!editing)}
                      >
                        <SlidersHorizontal size={17} />
                      </button>
                    </div>
                    <div className="loop-phrase-heading">
                      <div>
                        <span className="loop-eyebrow">
                          {view === 'chords'
                            ? lesson.source === 'demo'
                              ? 'SUGGESTED ACCOMPANIMENT'
                              : 'ESTIMATED CHORD CHANGES'
                            : 'FIND YOUR FLOW'}
                        </span>
                        <h3>
                          {view === 'chords'
                            ? 'A few shapes. A whole song.'
                            : `Phrase ${phraseIndex + 1}`}
                          <span>
                            {formatTime(phrase.start)} — {formatTime(phrase.end)}
                          </span>
                        </h3>
                      </div>
                      <div className="loop-phrase-pager">
                        <button
                          type="button"
                          className="loop-icon-button"
                          aria-label="Previous phrase"
                          disabled={phraseIndex === 0}
                          onClick={() => seek(phrases[phraseIndex - 1].start)}
                        >
                          <ChevronLeft size={17} />
                        </button>
                        <span>
                          {phraseIndex + 1} / {phrases.length}
                        </span>
                        <button
                          type="button"
                          className="loop-icon-button"
                          aria-label="Next phrase"
                          disabled={phraseIndex === phrases.length - 1}
                          onClick={() => seek(phrases[phraseIndex + 1].start)}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </div>
                    <div id="loop-guide-panel" role="tabpanel" aria-labelledby={`loop-tab-${view}`}>
                      {view === 'tab' && (
                        <TabGuide notes={phrase.notes} active={selected} onSelect={selectNote} />
                      )}
                      {view === 'staff' && (
                        <>
                          <SongStaffGuide lesson={lesson} phrase={phrase} active={selected} />
                          <p className="loop-guide-footnote">
                            Guitar notation sounds one octave lower. Rhythm is rounded for practice.
                          </p>
                        </>
                      )}
                      {view === 'fretboard' && <Fretboard note={currentNote} />}
                      {view === 'chords' && (
                        <div className="loop-chord-grid">
                          {lesson.chords
                            .filter((c) => c.start < phrase.end && c.end > phrase.start)
                            .map((c) => (
                              <button
                                type="button"
                                key={c.start}
                                className={`loop-chord-card${currentChord === c ? ' is-selected' : ''}`}
                                aria-pressed={currentChord === c}
                                onClick={() => {
                                  audio.current?.pause();
                                  seek(c.start);
                                }}
                              >
                                <div>
                                  <strong>{c.name}</strong>
                                  <span>{formatTime(c.start)}</span>
                                </div>
                                <ChordDiagram name={c.name} />
                                <small>
                                  {profileChord(c.name, profile)?.barre
                                    ? 'Barre shape'
                                    : 'Suggested fingering'}
                                </small>
                              </button>
                            ))}
                          {!lesson.chords.length && (
                            <div className="loop-empty-notes">
                              No chords could be estimated. Try a clearer recording.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {editing && (
                      <div className="loop-edit-panel">
                        <label>
                          Tempo (BPM)
                          <input
                            type="number"
                            min="40"
                            max="240"
                            value={lesson.bpm}
                            onChange={(e) => {
                              const bpm = Number(e.target.value);
                              if (bpm >= 40 && bpm <= 240) changeLesson({ ...lesson, bpm });
                            }}
                          />
                        </label>
                        {view === 'chords' && currentChord ? (
                          <label>
                            Chord at {formatTime(currentChord.start)}
                            <select
                              value={currentChord.name}
                              onChange={(e) =>
                                changeLesson({
                                  ...lesson,
                                  chords: lesson.chords.map((c, i) =>
                                    i === chordIndex
                                      ? { ...c, name: e.target.value, edited: true }
                                      : c
                                  ),
                                })
                              }
                            >
                              {CHORD_NAMES.map((n) => (
                                <option key={n}>{n}</option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          currentNote && (
                            <label>
                              Selected note
                              <select
                                value={currentNote.midi}
                                onChange={(e) => {
                                  const midi = Number(e.target.value);
                                  changeLesson({
                                    ...lesson,
                                    notes: lesson.notes.map((n, i) =>
                                      i === selected
                                        ? { ...n, midi, ...positionForMidi(midi), edited: true }
                                        : n
                                    ),
                                  });
                                }}
                              >
                                {Array.from({ length: 45 }, (_, i) => i + 40).map((midi) => (
                                  <option key={midi} value={midi}>
                                    {noteName(midi)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )
                        )}
                        <span>
                          Edits update your practice guide. The recording keeps its original sound.
                        </span>
                      </div>
                    )}
                    <div className="loop-guide-footer">
                      <span>
                        {view === 'chords'
                          ? '○ Open string   × Don’t play   1–4 Fingers'
                          : profileLabel(profile)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void hear(
                            view === 'chords'
                              ? profileChordMidis(currentChord?.name, profile)
                              : currentNote
                                ? [currentNote.midi]
                                : []
                          )
                        }
                      >
                        <Volume2 size={14} /> Hear {view === 'chords' ? 'chord' : 'note'}
                      </button>
                    </div>
                    <div className="loop-next-note">
                      <span className="loop-note-badge">
                        {view === 'chords'
                          ? currentChord?.name || '—'
                          : currentNote
                            ? noteName(currentNote.midi).replace(/\d/, '')
                            : '—'}
                      </span>
                      <div>
                        <span className="loop-eyebrow">
                          {view === 'chords' ? 'YOUR CHORD' : 'YOUR NEXT NOTE'}
                        </span>
                        <strong>
                          {view === 'chords'
                            ? chordShape(currentChord?.name)?.fullName || 'No chord detected'
                            : currentNote
                              ? `${currentNote.fret ? `Fret ${currentNote.fret}` : 'Open string'} · ${noteName(tuning[currentNote.string]).replace(/\d/g, '')} string`
                              : 'No clear notes detected'}
                        </strong>
                        <p>
                          {view === 'chords'
                            ? 'Place your fingers, then strum slowly. Let each note ring.'
                            : currentNote?.fret
                              ? 'Place your fingertip just behind the fret. Keep your hand relaxed.'
                              : 'Let the open string ring. No finger needed.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="loop-icon-button"
                        aria-label={view === 'chords' ? 'Next chord' : 'Next note'}
                        disabled={
                          view === 'chords'
                            ? !currentChord || chordIndex === lesson.chords.length - 1
                            : !currentNote || selected === lesson.notes.length - 1
                        }
                        onClick={() => {
                          if (view === 'chords') {
                            audio.current?.pause();
                            seek(lesson.chords[chordIndex + 1].start);
                          } else selectNote(selected + 1);
                        }}
                      >
                        <ArrowRight size={19} />
                      </button>
                    </div>
                  </section>

                  <aside className="loop-coach">
                    <div className="loop-coach-heading">
                      <span className="loop-coach-icon">
                        <Sparkles size={17} />
                      </span>
                      <span>IN YOUR CORNER</span>
                      <span
                        className={`loop-mic-dot${microphone.status === 'listening' ? ' is-on' : ''}`}
                      />
                    </div>
                    <h3>
                      {microphone.status === 'listening' ? 'I’m listening.' : 'Let’s hear you.'}
                    </h3>
                    <p>A little guidance, right when you need it.</p>
                    <div
                      className={`loop-listening-orb${microphone.status === 'listening' ? ' is-listening' : ''}`}
                    >
                      <div>
                        {pitch && microphone.status === 'listening' ? (
                          <strong>{noteName(pitch.midi)}</strong>
                        ) : (
                          <AudioLines size={34} strokeWidth={1.3} />
                        )}
                      </div>
                    </div>
                    <div className="loop-coach-status" aria-live="polite">
                      <strong>{feedback}</strong>
                      <p>{feedbackDetail}</p>
                    </div>
                    <button
                      type="button"
                      className={`loop-button ${microphone.status === 'listening' ? 'loop-button-secondary' : 'loop-button-purple'}`}
                      onClick={() =>
                        microphone.status === 'off' ? void microphone.start() : microphone.stop()
                      }
                    >
                      <Mic size={16} />
                      {microphone.status === 'requesting'
                        ? 'Cancel microphone'
                        : microphone.status === 'listening'
                          ? 'Stop listening'
                          : 'Start listening'}
                    </button>
                    {microphone.error && (
                      <p className="loop-error" role="alert">
                        {microphone.error}
                      </p>
                    )}
                    <label className="loop-wait-option">
                      <input
                        type="checkbox"
                        checked={waitForMe}
                        onChange={(e) => setWaitForMe(e.target.checked)}
                      />
                      Wait for me<span>Advance on a correct note while playback is paused</span>
                    </label>
                    <div className="loop-coach-progress">
                      <span>
                        {hits.length
                          ? `${hits.length} notes played correctly`
                          : 'Every note is a little progress.'}
                      </span>
                      <div>
                        <span
                          style={{
                            width: `${lesson.notes.length ? (hits.length / lesson.notes.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </aside>
                </div>

                <section className="loop-timeline">
                  <div className="loop-timeline-heading">
                    <h3>The whole picture</h3>
                    <span>{loop ? 'Looping selected phrase' : 'Playing through'}</span>
                  </div>
                  <Waveform
                    peaks={lesson.waveform}
                    current={time}
                    duration={lesson.duration}
                    onSeek={seek}
                  />
                  <div className="loop-phrase-chips">
                    {phrases.map((p, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => seek(p.start)}
                        className={i === phraseIndex ? 'is-active' : ''}
                        aria-pressed={i === phraseIndex}
                      >
                        <span>{String(i + 1).padStart(2, '0')}</span>Phrase {i + 1}
                        <small>{formatTime(p.start)}</small>
                      </button>
                    ))}
                  </div>
                </section>
                <div className="loop-bottom-hint">
                  <Headphones size={15} />
                  <span>
                    {lesson.source === 'demo'
                      ? 'Headphones on. Shoulders down. You’ve got this.'
                      : 'Estimated melody and harmony. Clean solo guitar gives the best results; use Edit to correct the guide.'}
                  </span>
                  <span>LOCAL FIRST · MADE FOR MUSIC</span>
                </div>
              </div>
            )}

            {nav === 'library' && (
              <div className="loop-secondary-page">
                <div className="loop-eyebrow">YOUR PERSONAL SONGBOOK</div>
                <h1>
                  Music you want to <em>make yours.</em>
                </h1>
                <p>Your recordings and practice guides, saved in this browser.</p>
                <div className="loop-library-grid">
                  <button
                    type="button"
                    className="loop-library-add"
                    onClick={() => setModal('import')}
                  >
                    <Plus size={28} />
                    <strong>Bring a song you love</strong>
                    <span>Drop an audio file to get started</span>
                  </button>
                  {[{ id: DEMO.id, lesson: DEMO }, ...records].map((r) => (
                    <div className="loop-library-card" key={r.id}>
                      <div className="loop-library-art">
                        <AudioLines size={58} strokeWidth={1} />
                        <span>
                          {r.lesson.source === 'demo' ? 'SATTARI ORIGINAL' : 'YOUR RECORDING'}
                        </span>
                      </div>
                      <h2>{r.lesson.title}</h2>
                      <p>
                        {r.lesson.bpm} BPM · {r.lesson.key} · {formatTime(r.lesson.duration)}
                      </p>
                      <div>
                        <button
                          type="button"
                          className="loop-button loop-button-secondary"
                          onClick={() => openLesson(r.lesson, r.file || null, r.practiceFile)}
                        >
                          <Play size={14} /> Open lesson
                        </button>
                        {r.file && (
                          <button
                            type="button"
                            className="loop-icon-button"
                            aria-label={`Remove ${r.lesson.title} from this browser`}
                            onClick={async () => {
                              try {
                                await removeSong(r.id);
                                setRecords((prev) => prev.filter((s) => s.id !== r.id));
                                setToast(
                                  'Removed from this browser. Your original file is unchanged.'
                                );
                              } catch {
                                setToast('Could not remove this song. Try again.');
                              }
                            }}
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {nav === 'chord-library' && (
              <div className="loop-secondary-page">
                <div className="loop-eyebrow">A LANGUAGE AT YOUR FINGERTIPS</div>
                <h1>
                  Find your next <em>chord.</em>
                </h1>
                <p>Finger numbers: 1 index, 2 middle, 3 ring, 4 little finger.</p>
                <div className="loop-chord-library-layout">
                  <div>
                    <label className="loop-search-label">
                      Find a chord
                      <input
                        type="search"
                        placeholder="Try Em, G, or C#…"
                        value={chordFilter}
                        onChange={(e) => setChordFilter(e.target.value)}
                      />
                    </label>
                    <div className="loop-chord-pills">
                      {CHORD_NAMES.filter((n) =>
                        n.toLowerCase().includes(chordFilter.toLowerCase())
                      ).map((n) => (
                        <button
                          type="button"
                          key={n}
                          aria-pressed={libraryChord === n}
                          onClick={() => setLibraryChord(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <section className="loop-library-chord-detail">
                    <h2>{chordShape(libraryChord).fullName}</h2>
                    <ChordDiagram name={libraryChord} />
                    <p>
                      {profileChord(libraryChord, profile)?.barre
                        ? 'The connecting line is a barre: hold these strings with your index finger.'
                        : '○ means open. × means leave that string out.'}
                    </p>
                    <button
                      type="button"
                      className="loop-button loop-button-purple"
                      onClick={() => void hear(profileChordMidis(libraryChord, profile))}
                    >
                      <Volume2 size={16} /> Hear {libraryChord}
                    </button>
                  </section>
                </div>
              </div>
            )}

            {nav === 'tuner' && (
              <div className="loop-secondary-page loop-tuner-page">
                <div className="loop-eyebrow">START WITH A GOOD SOUND</div>
                <h1>
                  A moment to <em>tune in.</em>
                </h1>
                <p>{profileLabel(profile)}. Pick a string, then play it on its own.</p>
                <div className="loop-tuning-strings">
                  {tuning.map((midi, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setTunerString(i)}
                      aria-pressed={tunerString === i}
                    >
                      <small>{6 - i}</small>
                      {noteName(midi)}
                    </button>
                  ))}
                </div>
                <section className="loop-tuner-display">
                  <span className="loop-eyebrow">
                    {microphone.status === 'listening'
                      ? 'LISTENING TO YOUR GUITAR'
                      : 'MICROPHONE IS OFF'}
                  </span>
                  <strong>{pitch ? noteName(pitch.midi) : noteName(tuning[tunerString])}</strong>
                  <div className="loop-tuner-meter">
                    <span>♭</span>
                    <div>
                      <i
                        style={{
                          left: `${pitch ? Math.max(2, Math.min(98, 50 + ((pitch.midi - tuning[tunerString]) * 100 + pitch.cents) / 2)) : 50}%`,
                        }}
                      />
                      <b />
                    </div>
                    <span>♯</span>
                  </div>
                  <p aria-live="polite">
                    {pitch
                      ? `${Math.round((pitch.midi - tuning[tunerString]) * 100 + pitch.cents)} cents from ${noteName(tuning[tunerString])} · ${pitch.frequency.toFixed(1)} Hz`
                      : 'Play a steady, open string.'}
                  </p>
                  <div className="loop-tuner-actions">
                    <button
                      type="button"
                      className="loop-button loop-button-purple"
                      onClick={() =>
                        microphone.status === 'off' ? void microphone.start() : microphone.stop()
                      }
                    >
                      <Mic size={16} />
                      {microphone.status === 'off'
                        ? 'Start tuner'
                        : microphone.status === 'requesting'
                          ? 'Cancel'
                          : 'Stop tuner'}
                    </button>
                    <button
                      type="button"
                      className="loop-button loop-button-secondary"
                      onClick={() => void hear([tuning[tunerString]])}
                    >
                      <Volume2 size={16} /> Reference tone
                    </button>
                  </div>
                  {microphone.error && (
                    <p className="loop-error" role="alert">
                      {microphone.error}
                    </p>
                  )}
                </section>
              </div>
            )}

            {nav === 'practice' && (
              <footer className="loop-player">
                <div className="loop-player-left">
                  <button
                    type="button"
                    className="loop-play-button"
                    onClick={() => void togglePlayback()}
                    aria-label={playing ? 'Pause song' : 'Play song'}
                    disabled={!sourceUrl}
                  >
                    {playing ? (
                      <Pause size={20} fill="currentColor" />
                    ) : (
                      <Play size={20} fill="currentColor" />
                    )}
                  </button>
                  <div>
                    <strong>{playing ? 'You’re in the groove' : 'Ready when you are'}</strong>
                    <span>
                      {formatTime(time)} <span>/ {formatTime(lesson.duration)}</span>
                    </span>
                  </div>
                </div>
                <div className="loop-player-middle">
                  <button
                    type="button"
                    className={`loop-loop-toggle${loop ? ' is-active' : ''}`}
                    aria-label="Loop phrase"
                    aria-pressed={loop}
                    onClick={() => setLoop(!loop)}
                  >
                    <Repeat2 size={17} />
                    <span>Loop phrase</span>
                  </button>
                  <div className="loop-speed">
                    <label htmlFor="loop-speed">
                      Your pace <strong>{Math.round(speed * 100)}%</strong>
                    </label>
                    <input
                      id="loop-speed"
                      type="range"
                      min="0.5"
                      max="1.25"
                      step="0.05"
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="loop-player-volume">
                  <Volume2 size={17} />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    aria-label="Playback volume"
                  />
                </div>
              </footer>
            )}
          </div>
        </>
      )}

      {modal === 'import' && (
        <Modal
          title="Bring a song you love."
          onClose={() => {
            importer.cancel();
            setModal(null);
          }}
        >
          <p className="loop-modal-copy">
            Choose your recording, prepare the sound, then check your guide.
          </p>
          <div className="lc-import-tabs" aria-label="Import format">
            <button
              type="button"
              aria-pressed={importKind === 'audio'}
              disabled={!!importer.progress}
              onClick={() => setImportKind('audio')}
            >
              Audio recording
            </button>
            <button
              type="button"
              aria-pressed={importKind === 'score'}
              disabled={!!importer.progress}
              onClick={() => setImportKind('score')}
            >
              Guitar Pro / MusicXML
            </button>
          </div>
          {importKind === 'score' ? (
            <ScoreImport
              onImport={(record) => {
                openLesson(record.lesson, record.file, record.practiceFile);
                setModal(null);
                const saved = { ...record, id: record.lesson.id, savedAt: Date.now() };
                setRecords((previous) => [saved, ...previous]);
                void saveSong(saved)
                  .then(() => setToast('Score lesson saved on this device.'))
                  .catch(() =>
                    setToast('The score is ready for this visit; device storage is unavailable.')
                  );
              }}
            />
          ) : importer.progress ? (
            <div className="loop-import-progress">
              <LoaderCircle size={34} className="loop-spinner" />
              <h3 role="status" aria-live="polite">
                {importer.progress.label}
              </h3>
              <progress
                aria-label="Preparing your practice guide"
                max="100"
                value={importer.progress.value ?? undefined}
              />
              <p>Working on this device. Keep this tab open; you can cancel at any time.</p>
              <button
                type="button"
                className="loop-button loop-button-secondary"
                onClick={importer.cancel}
              >
                Cancel analysis
              </button>
            </div>
          ) : (
            <>
              <ImportSetup importer={importer} onChooseFile={() => fileInput.current?.click()} />
              <button
                type="button"
                className="loop-demo-link"
                onClick={() => {
                  openLesson(DEMO);
                  setModal(null);
                }}
              >
                Just exploring? Try the original demo <ArrowRight size={15} />
              </button>
            </>
          )}
          {importer.error && (
            <p className="loop-error" role="alert">
              {importer.error}
            </p>
          )}
        </Modal>
      )}

      {modal === 'export' && (
        <Modal title="Take the music with you." onClose={() => setModal(null)}>
          <p className="loop-modal-copy">Your current notes, chord shapes, and edits.</p>
          <button
            type="button"
            className="loop-export-option"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([downloadPracticeGuide(lesson, profile)], {
                  type: 'text/plain;charset=utf-8',
                })
              );
              const a = document.createElement('a');
              a.href = url;
              a.download = `${lesson.title.replace(/[^a-z0-9-_ ]/gi, '') || 'loop'}-practice.txt`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            <ArrowDownToLine size={21} />
            <span>
              <strong>Download tabs & chord chart</strong>
              <small>A simple, portable text practice sheet</small>
            </span>
            <ArrowRight size={17} />
          </button>
          <button
            type="button"
            className="loop-export-option"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([midiGuide(lesson)], { type: 'audio/midi' })
              );
              const link = document.createElement('a');
              link.href = url;
              link.download = `${lesson.title.replace(/[^a-z0-9-_ ]/gi, '') || 'loop'}-draft.mid`;
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            <Music2 size={21} />
            <span>
              <strong>Download MIDI notes</strong>
              <small>
                {lesson.polyphonicNotes
                  ? 'Overlapping chord tones with original timing'
                  : 'Melody notes with original timing'}{' '}
                · editable in a music app
              </small>
            </span>
            <ArrowRight size={17} />
          </button>
          <button
            type="button"
            className="loop-export-option"
            onClick={() => {
              setPrintReady(true);
              setModal(null);
              setToast('Preparing your complete practice sheet…');
            }}
          >
            <Music2 size={21} />
            <span>
              <strong>Print / save as PDF</strong>
              <small>All phrases, sheet music, tabs and chord diagrams</small>
            </span>
            <ArrowRight size={17} />
          </button>
        </Modal>
      )}

      {dropActive && (
        <div className="loop-drag-overlay">
          <Upload size={46} />
          <strong>Let’s learn this one.</strong>
          <span>Drop your audio file anywhere</span>
        </div>
      )}
      {toast && (
        <div className="loop-toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
          <button type="button" aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {printReady && (
        <div className="loop-print-only" ref={printRoot}>
          <h1>{lesson.title}</h1>
          <p>
            Sattari Learn practice sheet · {lesson.bpm} BPM · {lesson.key} · {profileLabel(profile)}
          </p>
          {lesson.source !== 'demo' && (
            <p>
              {lesson.source === 'score'
                ? 'Imported written score. Verify alignment against your recording.'
                : 'Estimated transcription. Review against the recording.'}
            </p>
          )}
          <div className="loop-print-chords">
            {[...new Set(lesson.chords.map((c) => c.name))].map((name) => (
              <div key={name}>
                <h3>{name}</h3>
                <ChordDiagram name={name} />
              </div>
            ))}
          </div>
          <p>{lesson.chords.map((c) => `${formatTime(c.start)} ${c.name}`).join('  /  ')}</p>
          {phrases.map((p, i) => (
            <section key={i}>
              <h2>
                Phrase {i + 1} · {formatTime(p.start)}–{formatTime(p.end)}
              </h2>
              <StaffGuide notes={p.notes} active={-1} bpm={lesson.bpm} />
              <TabGuide notes={p.notes} active={-1} onSelect={() => {}} />
              {lesson.polyphonicNotes?.some((n) => n.end > p.start && n.start < p.end) && (
                <>
                  <h3>Overlapping notes · approximate rhythm in 4/4</h3>
                  <StaffGuide
                    notes={lesson.polyphonicNotes
                      .filter((n) => n.end > p.start && n.start < p.end)
                      .map((n) => ({
                        ...n,
                        start: Math.max(n.start, p.start),
                        end: Math.min(n.end, p.end),
                      }))}
                    bpm={lesson.bpm}
                    polyphonic
                  />
                </>
              )}
            </section>
          ))}
          {lesson.polyphonicNotes && (
            <section>
              <h2>Chord-tone draft</h2>
              <pre className="lf-print-tones">{polyphonicText(lesson, profile)}</pre>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
