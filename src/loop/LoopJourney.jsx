import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Guitar,
  Headphones,
  ListMusic,
  Mic,
  Music2,
  Pause,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from 'lucide-react';
import { SONGS, songAppearance } from './catalog';
import { ChordDiagram, Fretboard, SongStaffGuide, TabGuide } from './Guides';
import PolyphonicGuide from './PolyphonicGuide';
import ChordCoach from './ChordCoach';
import { formatTime, phrasesFor } from './music';
import FocusedPractice from './FocusedPractice';
import './LoopJourney.css';
import './Coach.css';
import AnalysisReview from './AnalysisReview';
import RecordingSource from './RecordingSource';
import { readCheckpoint, clearCheckpoint, lessonFingerprint } from './progress';
import { LearnWordmark, LoopMark, PracticeDeck } from './Hardware';
import GuitarProfileSettings, { useGuitarProfile } from './GuitarSetup';
import { profileLabel } from './guitarProfile';
import LessonPlanner from './LessonPlanner';
import DailySession from './DailySession';
import CoursePath, { LessonBrief } from './CoursePath';
import BackupPanel from './BackupPanel';
import PracticeJournal from './PracticeJournal';
import './Launch.css';
import { buildPracticePlan } from './practicePlan';
import { wavBlob } from './lessonMedia';

export function SongArt({ lesson, small = false }) {
  const { color } = songAppearance(lesson);
  return (
    <div className={`lj-art lj-art-${color}${small ? ' lj-art-small' : ''}`} aria-hidden="true">
      <span className="lj-art-edition">
        SATTARI SONGBOOK <span>{lesson.bpm} BPM</span>
      </span>
      <div className="lh-tape-window" aria-hidden="true">
        <i />
        <span />
        <i />
      </div>
      <span className="lj-art-caption">
        {lesson.category === 'classic'
          ? 'A CLASSIC, MADE YOURS.'
          : lesson.source === 'demo'
            ? 'A LITTLE AFTER HOURS.'
            : 'YOUR MUSIC. YOUR PACE.'}
      </span>
    </div>
  );
}

function JourneyHeader({ stage, onBack, onTool }) {
  return (
    <header className="lj-header">
      <button
        type="button"
        className="loop-brand lj-brand"
        onClick={onBack}
        aria-label="Sattari Learn song library"
      >
        <LoopMark />
        <LearnWordmark />
      </button>
      <nav className="lj-steps" aria-label="Your learning journey">
        {['Pick a song', 'Get to know it', 'Make it yours'].map((label, i) => (
          <div
            key={label}
            aria-current={i === (stage === 'choose' ? 0 : 1) ? 'step' : undefined}
            className={i < (stage === 'choose' ? 0 : 1) ? 'is-done' : ''}
          >
            <span>{i < (stage === 'choose' ? 0 : 1) ? <Check size={12} /> : i + 1}</span>
            <b>{label}</b>
            {i < 2 && <ChevronRight size={13} />}
          </div>
        ))}
      </nav>
      <div className="sl-header-tools">
        <Link className="lj-tool-link sl-hub-link" to="/hub" aria-label="Back to Sattari Hub">
          <ArrowLeft size={16} />
          <span>Hub</span>
        </Link>
        <button
          type="button"
          className="lj-tool-link"
          aria-label="Tune your guitar"
          onClick={() => onTool('tuner')}
        >
          <SlidersHorizontal size={16} />
          <span>Tune your guitar</span>
        </button>
      </div>
    </header>
  );
}

function SongLibrary({ records, onChoose, onUpload, progress, onDaily }) {
  const [filter, setFilter] = useState('All songs');
  const [search, setSearch] = useState('');
  const songs = [...SONGS.map((lesson) => ({ lesson })), ...records];
  const filtered = songs.filter(({ lesson }) => {
    const category =
      filter === 'Your uploads'
        ? lesson.source !== 'demo'
        : filter === 'Beginner path'
          ? lesson.category === 'foundations'
          : filter === 'Classics'
            ? lesson.category === 'classic'
            : true;
    return (
      category && `${lesson.title} ${lesson.artist}`.toLowerCase().includes(search.toLowerCase())
    );
  });
  return (
    <section className="lj-main">
      <DailySession
        records={[...SONGS.map((song) => ({ lesson: song })), ...records]}
        onStart={onDaily}
      />
      <section className="lj-welcome">
        <div className="lj-welcome-copy">
          <div className="lj-eyebrow">
            <span /> A LITTLE PRACTICE. ON REPEAT.
          </div>
          <h1>
            Your favorite song.
            <br />
            <em>In your hands.</em>
          </h1>
          <p>
            Learn the notes. Find the feeling. Play it for real.
            <br />
            Your own little practice room, one phrase at a time.
          </p>
          <div className="lh-welcome-actions">
            <a className="loop-button loop-button-purple" href="#lj-songbook-title">
              Find your first song <ArrowRight size={17} />
            </a>
            <button type="button" className="lh-upload-link" onClick={onUpload}>
              <Upload size={16} /> Bring your own
            </button>
          </div>
          <div className="lj-welcome-badges">
            <span>
              <Guitar size={15} /> Made for your guitar
            </span>
            <span>
              <Mic size={15} /> Feedback as you play
            </span>
          </div>
        </div>
        <PracticeDeck lesson={SONGS[0]} onChoose={onChoose} />
      </section>
      <CoursePath onChoose={onChoose} progress={progress} />
      <section className="lj-songbook" aria-labelledby="lj-songbook-title">
        <div className="lj-section-heading">
          <div>
            <span className="lj-eyebrow">STEP 01 · FIND YOUR FIRST SONG</span>
            <h2 id="lj-songbook-title" tabIndex={-1}>
              Good songs to get lost in.
            </h2>
          </div>
          <span className="lj-collection-count">{SONGS.length} hand-built starter lessons</span>
        </div>
        <div className="lj-library-controls">
          <div className="lj-filters" aria-label="Filter songs">
            {['All songs', 'Classics', 'Beginner path', 'Your uploads'].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setFilter(label)}
                aria-pressed={filter === label}
              >
                {label}
                {label === 'Your uploads' && <span>{records.length}</span>}
              </button>
            ))}
          </div>
          <label className="lj-search">
            <Search size={16} />
            <input
              type="search"
              aria-label="Find a song"
              placeholder="Find your next song…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="lj-song-grid">
          {filtered.map(({ lesson, file, practiceFile }) => (
            <button
              className="lj-song-card"
              key={lesson.id}
              type="button"
              onClick={() => onChoose(lesson, file || null, practiceFile || null)}
              aria-label={`Learn ${lesson.title}`}
            >
              <div className="lj-song-art-wrap">
                <SongArt lesson={lesson} />
                <span className="lj-song-level">
                  {lesson.difficulty ||
                    (lesson.source === 'score' ? 'Written score' : 'Your recording')}
                </span>
                <span className="lj-song-arrow">
                  <ArrowUpRightIcon />
                </span>
              </div>
              <div className="lj-song-card-info">
                <span className="lj-song-category">
                  {lesson.category === 'classic'
                    ? 'THE CLASSICS'
                    : lesson.category === 'foundations'
                      ? 'BEGINNER PATH'
                      : lesson.source === 'demo'
                        ? 'SATTARI ORIGINAL'
                        : 'SAVED ON THIS DEVICE'}
                </span>
                <h3>{lesson.title}</h3>
                <p>{lesson.artist}</p>
                <div className="lj-song-meta">
                  <span>
                    <ListMusic size={13} />
                    {phrasesFor(lesson).length} phrases
                  </span>
                  <span>
                    <Clock3 size={13} />
                    {formatTime(lesson.duration)}{' '}
                    {lesson.completeSong
                      ? 'complete song'
                      : lesson.category === 'foundations'
                        ? 'exercise'
                        : 'excerpt'}
                  </span>
                </div>
                {(progress[lesson.id] || readCheckpoint(lesson)) && (
                  <span className="lj-song-completed">
                    <CheckCircle2 size={13} />
                    {progress[lesson.id]?.fingerprint === lessonFingerprint(lesson) &&
                    progress[lesson.id]?.matched === lesson.notes.length
                      ? 'Pitch milestone reached'
                      : readCheckpoint(lesson)?.stage !== 'complete' && readCheckpoint(lesson)
                        ? 'Continue your lesson'
                        : 'Practiced before'}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
        {!filtered.length && (
          <div className="lj-empty">
            <Music2 size={26} />
            <h3>
              {filter === 'Your uploads' && !search
                ? 'Your own songbook starts here.'
                : 'No songs found yet.'}
            </h3>
            <p>
              {filter === 'Your uploads'
                ? 'Bring an audio file and we’ll help turn it into a lesson.'
                : 'Try a different title or explore all songs.'}
            </p>
            <button
              type="button"
              className="loop-button loop-button-secondary"
              onClick={
                filter === 'Your uploads'
                  ? onUpload
                  : () => {
                      setSearch('');
                      setFilter('All songs');
                    }
              }
            >
              {filter === 'Your uploads' ? 'Upload a song' : 'Show all songs'}
            </button>
          </div>
        )}
      </section>
      <GuitarProfileSettings />
      <button type="button" className="lj-upload-banner" onClick={onUpload}>
        <span className="lj-upload-icon">
          <Upload size={24} strokeWidth={1.5} />
        </span>
        <span>
          <strong>Have a song in mind?</strong>
          <small>Drop your audio here. We’ll find the notes, chords, and a place to start.</small>
        </span>
        <span className="lj-upload-cta">
          Bring your own song <ArrowRight size={16} />
        </span>
      </button>
      <PracticeJournal songs={songs.map((record) => record.lesson)} />
      <BackupPanel />
      <footer className="lj-library-footer">
        <span>MADE FOR THE JOY OF PLAYING</span>
        <span>
          <span className="lj-privacy-dot" /> Your audio stays on your device
        </span>
      </footer>
    </section>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M6 18 18 6M6 6h12v12" />
    </svg>
  );
}

function SongOverview({
  lesson,
  sourceUrl,
  onPractice,
  onChordPractice,
  onBack,
  onStudio,
  onExport,
  playing,
  onPreview,
  hasPreparedAudio,
  recordingSource,
  onRecordingSource,
  onEditLesson,
  onRebuildOriginal,
  onPlan,
}) {
  const { profile } = useGuitarProfile();
  const [view, setView] = useState(
    lesson.notes.length ? 'tab' : lesson.polyphonicNotes ? 'harmony' : 'chords'
  );
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [selected, setSelected] = useState(0);
  const phrases = phrasesFor(lesson);
  const saved = readCheckpoint(lesson);
  const canResume = saved && saved.stage !== 'complete';
  const reviewKey = `loop-reviewed:${lesson.id}`;
  const fingerprint = lessonFingerprint(lesson);
  const [reviewedFingerprint, setReviewedFingerprint] = useState(() => {
    try {
      return localStorage.getItem(reviewKey);
    } catch {
      return null;
    }
  });
  const reviewed = reviewedFingerprint === fingerprint;
  const phrase = phrases[Math.min(phraseIndex, phrases.length - 1)];
  const uniqueChords = [...new Set(lesson.chords.map((c) => c.name))];
  const estimated = lesson.source !== 'demo';
  const audioEstimate = estimated && lesson.source !== 'score';
  return (
    <section className="lj-main lj-overview">
      <button type="button" className="lj-back" onClick={onBack}>
        <ArrowLeft size={15} /> Back to songs
      </button>
      <section className="lj-overview-hero">
        <SongArt lesson={lesson} />
        <div>
          <span className="lj-eyebrow">STEP 02 · GET TO KNOW YOUR SONG</span>
          <h1>{lesson.title}</h1>
          <p className="lj-artist">{lesson.artist}</p>
          <p className="lj-song-description">
            {lesson.description ||
              'Your recording, broken into small steps. Check the guide, choose a phrase, and make a little progress.'}
          </p>
          <div className="lj-facts">
            <span>
              <Guitar size={14} />
              {profileLabel(profile)}
            </span>
            <span>
              {lesson.key}
              {lesson.keyEdited ? ' · set by you' : audioEstimate ? ' · est.' : ''}
            </span>
            <span>
              {lesson.bpm} BPM{audioEstimate ? ' · est.' : ''}
            </span>
            <span>
              {phrases.length} {phrases.length === 1 ? 'phrase' : 'phrases'}
            </span>
          </div>
          <div className="lj-overview-actions">
            <button
              type="button"
              className="loop-button loop-button-purple lj-primary"
              disabled={(!lesson.notes.length && !uniqueChords.length) || (estimated && !reviewed)}
              onClick={() => {
                if (lesson.notes.length) onPractice();
                else {
                  if (playing) onPreview();
                  onChordPractice();
                }
              }}
            >
              <Play size={17} fill="currentColor" />
              {!lesson.notes.length && uniqueChords.length
                ? 'Practice these chords'
                : canResume
                  ? 'Continue practicing'
                  : 'Practice this song'}
              <ArrowRight size={17} />
            </button>
            <button type="button" className="loop-button loop-button-secondary" onClick={onPreview}>
              {playing ? <Pause size={16} /> : <Headphones size={16} />}
              {playing
                ? 'Pause preview'
                : lesson.synthesizedReference
                  ? 'Listen to the score example'
                  : estimated
                    ? 'Listen to the recording'
                    : 'Listen to the melody'}
            </button>
          </div>
          {hasPreparedAudio && (
            <RecordingSource source={recordingSource} onChange={onRecordingSource} />
          )}
          {canResume && (
            <div className="lf-resume-note">
              <span>
                Saved at phrase {saved.phraseIndex + 1}, note {saved.position + 1}.
              </span>
              <button
                type="button"
                className="lj-text-link"
                disabled={estimated && !reviewed}
                onClick={() => {
                  clearCheckpoint(lesson);
                  onPractice();
                }}
              >
                Start from the beginning
              </button>
            </div>
          )}
          {estimated && !reviewed && !!(lesson.notes.length || uniqueChords.length) && (
            <p className="lj-analysis-note">
              Check the {lesson.source === 'score' ? 'score' : 'draft'} below to unlock practice.
            </p>
          )}
          {!lesson.notes.length && (
            <p className="lj-analysis-note" role="status">
              {uniqueChords.length
                ? 'This recording works best as a chord lesson. Review the chord tones, then learn each shape with microphone guidance.'
                : 'No clear melody was found. You can explore the chord guide, or upload a cleaner solo-guitar recording to start guided practice.'}
            </p>
          )}
        </div>
      </section>
      <GuitarProfileSettings />
      {estimated && (
        <AnalysisReview
          lesson={lesson}
          sourceUrl={sourceUrl}
          onEditLesson={onEditLesson}
          otherPlaying={playing}
          onBeforePlay={() => {
            if (playing) onPreview();
          }}
          reviewed={reviewed}
          onKeyChange={
            onEditLesson ? (key) => onEditLesson({ ...lesson, key, keyEdited: true }) : undefined
          }
          onStudio={onStudio}
          onRebuildOriginal={onRebuildOriginal}
          onReview={(value) => {
            setReviewedFingerprint(value ? fingerprint : null);
            try {
              if (value) localStorage.setItem(reviewKey, fingerprint);
              else localStorage.removeItem(reviewKey);
            } catch {
              /* The review remains available for this visit. */
            }
          }}
        />
      )}
      <LessonBrief lesson={lesson} />
      <LessonPlanner lesson={lesson} ready={!estimated || reviewed} onStart={onPlan} />
      <div className="lj-overview-grid">
        <section className="lj-guide-preview">
          <div className="lj-panel-heading">
            <div>
              <span className="lj-eyebrow">A LITTLE LOOK AHEAD</span>
              <h2>Here’s how you’ll play it.</h2>
            </div>
            <button
              type="button"
              className="loop-icon-button"
              aria-label="Download practice sheet"
              onClick={onExport}
            >
              <ArrowDownToLine size={18} />
            </button>
          </div>
          <div className="lj-guide-tabs" role="tablist" aria-label="Song guides">
            {[
              ['tab', 'Tablature'],
              ['chords', 'Chord charts'],
              ['staff', 'Sheet music'],
              ['fretboard', 'Fretboard'],
              ...(lesson.polyphonicNotes ? [['harmony', 'Chord tones']] : []),
            ].map(([id, label]) => (
              <button
                key={id}
                id={`lj-tab-${id}`}
                role="tab"
                type="button"
                aria-selected={view === id}
                aria-controls="lj-guide-panel"
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="lj-preview-controls">
            <label>
              Phrase{' '}
              <select
                aria-label="Preview phrase"
                value={Math.min(phraseIndex, phrases.length - 1)}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  setPhraseIndex(i);
                  setSelected(phrases[i].notes[0]?.index || 0);
                }}
              >
                {phrases.map((_, i) => (
                  <option key={i} value={i}>
                    {i + 1} of {phrases.length}
                  </option>
                ))}
              </select>
            </label>
            <span>
              {view === 'chords'
                ? 'Suggested accompaniment'
                : view === 'harmony'
                  ? 'Overlapping notes · review draft'
                  : view === 'staff'
                    ? 'Read the notes & rhythm'
                    : 'Play one note at a time'}
            </span>
          </div>
          <div
            id="lj-guide-panel"
            role="tabpanel"
            aria-labelledby={`lj-tab-${view}`}
            className="lj-guide-panel"
          >
            {view === 'tab' && (
              <TabGuide notes={phrase.notes} active={selected} onSelect={setSelected} />
            )}
            {view === 'staff' && (
              <SongStaffGuide lesson={lesson} phrase={phrase} active={selected} />
            )}
            {view === 'fretboard' && <Fretboard note={lesson.notes[selected]} />}
            {view === 'harmony' && (
              <PolyphonicGuide lesson={lesson} phrase={phrase} onEditLesson={onEditLesson} />
            )}
            {view === 'chords' && (
              <div>
                <div className="lf-chord-sequence" aria-label="Chord sequence for this phrase">
                  {lesson.chords
                    .filter((chord) => chord.end > phrase.start && chord.start < phrase.end)
                    .map((chord, index) => (
                      <span key={`${chord.start}-${index}`}>
                        <strong>{chord.name}</strong>
                        <small>
                          {Math.round(
                            (((Math.min(chord.end, phrase.end) -
                              Math.max(chord.start, phrase.start)) *
                              lesson.bpm) /
                              60) *
                              10
                          ) / 10}{' '}
                          beats
                        </small>
                      </span>
                    ))}
                </div>
                <div className="lj-overview-chords">
                  {uniqueChords.length ? (
                    uniqueChords.map((name) => (
                      <div key={name}>
                        <strong>{name}</strong>
                        <ChordDiagram name={name} small />
                      </div>
                    ))
                  ) : (
                    <p>
                      {estimated
                        ? 'No confident chords found. Try a clearer recording.'
                        : 'This exercise focuses on single notes. Chord shapes begin at step 9 of the beginner path.'}
                    </p>
                  )}
                </div>
                {!!uniqueChords.length && (
                  <div className="lf-chord-workshop-invite">
                    <div>
                      <span className="lj-eyebrow">YOUR NEXT LITTLE SKILL</span>
                      <h3>Make every string ring.</h3>
                      <p>
                        A guided chord workshop. Hold each shape and check its strings with your
                        microphone.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="loop-button loop-button-purple"
                      disabled={estimated && !reviewed}
                      onClick={() => {
                        if (playing) onPreview();
                        onChordPractice();
                      }}
                    >
                      Practice the chord shapes <ArrowRight size={16} />
                    </button>
                    {estimated && !reviewed && (
                      <small>Review your draft guide to unlock the workshop.</small>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="lj-guide-tip">
            {view === 'harmony'
              ? lesson.source === 'score'
                ? 'Simultaneous notes from your written part. You can correct or remove chord tones here.'
                : 'You can correct or remove chord tones here. Their timing is estimated from the recording.'
              : view === 'chords'
                ? 'Follow the chord sequence for this phrase. Numbers are fingers: 1 index, 2 middle, 3 ring, 4 little. ○ open · × skip.'
                : view === 'staff'
                  ? audioEstimate
                    ? 'Guitar sounds an octave below written pitch. Imported rhythm assumes 4/4 on an estimated sixteenth-note grid; check it against the recording.'
                    : 'Guitar sounds an octave below written pitch. A dot adds half the note’s length; a tie means keep the note ringing.'
                  : 'The top line is your thinnest string. The numbers tell you which fret to hold.'}
          </p>
          <button type="button" className="lj-text-link" onClick={onStudio}>
            Explore & edit the full practice sheet <ArrowRight size={14} />
          </button>
        </section>
        <aside className="lj-lesson-path">
          <span className="lj-eyebrow">YOU DON’T HAVE TO FIGURE IT OUT ALONE</span>
          <h2>One phrase at a time.</h2>
          <ol>
            <li>
              <span>
                <Guitar size={19} />
              </span>
              <div>
                <strong>Get comfortable</strong>
                <p>Guitar in hand. Headphones on. We’ll help connect your microphone.</p>
              </div>
            </li>
            <li>
              <span>
                <Headphones size={19} />
              </span>
              <div>
                <strong>Listen, then try</strong>
                <p>Hear a short phrase. Follow the strings and frets at your own pace.</p>
              </div>
            </li>
            <li>
              <span>
                <Sparkles size={19} />
              </span>
              <div>
                <strong>Bring it together</strong>
                <p>
                  Find the notes first. Then play to a count-in and get feedback on your timing.
                </p>
              </div>
            </li>
          </ol>
          <div className="lj-kind-note">
            <span>THE GOAL IS PROGRESS.</span>
            <p>
              No rush. No lives to lose.
              <br />
              Just you, getting a little better.
            </p>
          </div>
          <small>
            Your place saves as you go. Live feedback checks individual pitches and note starts;
            chord charts teach the accompaniment.
          </small>
        </aside>
      </div>
    </section>
  );
}

export default function LoopJourney({
  stage,
  lesson,
  records,
  onChoose,
  onUpload,
  onBack,
  onTool,
  onPractice,
  onExitPractice,
  onStudio,
  onExport,
  playing,
  onPreview,
  sourceUrl,
  hasPreparedAudio,
  recordingSource,
  onRecordingSource,
  onEditLesson,
  onRebuildOriginal,
  progress,
  onComplete,
}) {
  const [chordWorkshop, setChordWorkshop] = useState(false);
  const { profile } = useGuitarProfile();
  const [request, setRequest] = useState(null);
  const [daily, setDaily] = useState(null);
  const [exerciseUrl, setExerciseUrl] = useState('');
  const activeRequest = request?.lessonId === lesson.id ? request : null;
  const practiceLesson = useMemo(
    () => (activeRequest ? buildPracticePlan(lesson, activeRequest, profile) : lesson),
    [lesson, activeRequest, profile]
  );
  useEffect(() => {
    if (practiceLesson.plan?.level !== 'essentials') {
      setExerciseUrl('');
      return;
    }
    const url = URL.createObjectURL(wavBlob(practiceLesson.notes, practiceLesson.duration));
    setExerciseUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [practiceLesson]);
  const startPlan = (selection) => {
    if (playing) onPreview();
    setDaily(null);
    setRequest({ ...selection, lessonId: lesson.id });
    if (selection.part === 'chords') setChordWorkshop(true);
    else onPractice();
  };
  const nextDaily = () => {
    const index = daily.index + 1;
    setDaily({ ...daily, index });
    setRequest({ ...daily.steps[index], lessonId: lesson.id });
  };
  if (stage === 'overview' && chordWorkshop)
    return <ChordCoach lesson={practiceLesson} onExit={() => setChordWorkshop(false)} />;
  if (stage === 'focus')
    return (
      <FocusedPractice
        key={`${practiceLesson.id}:${daily?.index ?? 'single'}`}
        lesson={practiceLesson}
        sourceUrl={practiceLesson.plan?.level === 'essentials' ? exerciseUrl : sourceUrl}
        initialSpeed={activeRequest?.speed}
        sessionStep={daily ? `${daily.index + 1} / ${daily.steps.length}` : null}
        onNextSessionStep={daily && daily.index + 1 < daily.steps.length ? nextDaily : undefined}
        onExit={onExitPractice}
        onComplete={activeRequest ? () => {} : onComplete}
        onChooseAnother={onBack}
      />
    );
  return (
    <div className="lj-journey">
      <JourneyHeader stage={stage} onBack={onBack} onTool={onTool} />
      {stage === 'choose' ? (
        <SongLibrary
          records={records}
          onChoose={onChoose}
          onUpload={onUpload}
          progress={progress}
          onDaily={(plan) => {
            setDaily({ ...plan, index: 0 });
            setRequest({ ...plan.steps[0], lessonId: plan.record.lesson.id });
            onChoose(
              plan.record.lesson,
              plan.record.file || null,
              plan.record.practiceFile || null
            );
            onPractice();
          }}
        />
      ) : (
        <SongOverview
          key={lesson.id}
          lesson={lesson}
          sourceUrl={sourceUrl}
          onPractice={() => {
            setRequest(null);
            setDaily(null);
            onPractice();
          }}
          onChordPractice={() => {
            setRequest(null);
            setDaily(null);
            setChordWorkshop(true);
          }}
          onPlan={startPlan}
          onBack={onBack}
          onStudio={onStudio}
          onExport={onExport}
          playing={playing}
          onPreview={onPreview}
          hasPreparedAudio={hasPreparedAudio}
          recordingSource={recordingSource}
          onRecordingSource={onRecordingSource}
          onEditLesson={onEditLesson}
          onRebuildOriginal={onRebuildOriginal}
        />
      )}
    </div>
  );
}
