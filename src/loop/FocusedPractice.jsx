import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  CheckCircle2,
  Guitar,
  Headphones,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  X,
} from 'lucide-react';
import { Fretboard } from './Guides';
import { noteName, phrasesFor } from './music';
import { emptyPitchGate, gradePitch } from './practiceGate';
import useMicrophone from './useMicrophone';
import MicrophoneSetup from './MicrophoneSetup';
import RhythmPractice from './RhythmPractice';
import { lessonFingerprint, readCheckpoint, saveCheckpoint } from './progress';
import { useGuitarProfile } from './GuitarSetup';
import { profileNotes, profileLabel, openStrings } from './guitarProfile';
import HandDemonstration, { fingeringFor } from './HandDemonstration';
import RecordCompare from './RecordCompare';
import { PracticeCheckIn } from './PracticeJournal';
import AdaptiveDrill from './AdaptiveDrill';
import { adaptiveSuggestion, logPractice } from './practicePlan';

export default function FocusedPractice({
  lesson: sourceLesson,
  sourceUrl,
  onExit,
  onComplete,
  onChooseAnother,
  initialSpeed,
  sessionStep,
  onNextSessionStep,
}) {
  const { profile } = useGuitarProfile();
  const strings = openStrings(profile).map((n) => noteName(n).replace(/\d/g, ''));
  const lesson = useMemo(
    () => ({
      ...sourceLesson,
      rootFingerprint: sourceLesson.rootFingerprint || lessonFingerprint(sourceLesson),
      guitarProfile:
        sourceLesson.guitarProfile ||
        (profile.tuning !== 'standard' || profile.capo || profile.handedness !== 'right'
          ? profile
          : undefined),
      notes: profileNotes(sourceLesson.notes, profile),
    }),
    [sourceLesson, profile]
  );
  const phrases = useMemo(() => phrasesFor(lesson), [lesson]);
  const [checkpoint] = useState(() => {
    const saved = readCheckpoint(lesson);
    return saved &&
      saved.stage !== 'complete' &&
      saved.phraseIndex < phrases.length &&
      saved.position < phrases[saved.phraseIndex].notes.length
      ? saved
      : null;
  });
  const [stage, setStage] = useState('setup');
  const [phraseIndex, setPhraseIndex] = useState(checkpoint?.phraseIndex || 0);
  const [position, setPosition] = useState(checkpoint?.position || 0);
  const [matched, setMatched] = useState(checkpoint?.matched || []);
  const [rhythm, setRhythm] = useState(checkpoint?.rhythm || {});
  const [saveError, setSaveError] = useState(false);
  const [justHit, setJustHit] = useState(false);
  const [manual, setManual] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [demoPosition, setDemoPosition] = useState(0);
  const [speed, setSpeed] = useState(checkpoint?.speed || initialSpeed || 0.75);
  const [drilling, setDrilling] = useState(false);
  const [videoPosition, setVideoPosition] = useState(null);
  const [audioError, setAudioError] = useState('');
  const [heard, setHeard] = useState(false);
  const mic = useMicrophone();
  const stopMic = mic.stop;
  const audio = useRef(null);
  const session = useRef(null);
  const gate = useRef(emptyPitchGate());
  const settleUntil = useRef(0);
  const setupReturn = useRef(
    checkpoint?.stage === 'play'
      ? 'play'
      : ['phraseDone', 'rhythm'].includes(checkpoint?.stage)
        ? 'phraseDone'
        : 'listen'
  );
  const phrase = phrases[phraseIndex];
  const target = phrase.notes[position];
  const displayNote = stage === 'listen' ? phrase.notes[videoPosition ?? demoPosition] : target;
  const phraseMatched = phrase.notes.filter((n) => matched.includes(n.index)).length;
  const lastPhrase = phraseIndex === phrases.length - 1;

  useEffect(() => {
    const title = session.current?.querySelector('h1');
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [stage, phraseIndex]);

  useEffect(() => {
    if (stage === 'setup') return;
    setSaveError(!saveCheckpoint(lesson, { stage, phraseIndex, position, matched, rhythm, speed }));
  }, [lesson, stage, phraseIndex, position, matched, rhythm, speed]);

  const enterLesson = (withoutMic = false) => {
    if (withoutMic) mic.stop();
    setManual(withoutMic);
    settleUntil.current = performance.now() + 500;
    setStage(withoutMic && setupReturn.current === 'rhythm' ? 'phraseDone' : setupReturn.current);
  };

  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    player.playbackRate = speed;
    player.preservesPitch = true;
    if ('webkitPreservesPitch' in player) player.webkitPreservesPitch = true;
  }, [speed, stage]);

  useEffect(() => {
    if (!playing) return;
    let frame;
    const tick = () => {
      const time = audio.current?.currentTime ?? 0;
      if (time >= phrase.end - 0.025) {
        audio.current?.pause();
        setPlaying(false);
        setHeard(true);
        return;
      }
      const index = phrase.notes.findIndex((n) => n.start > time);
      setDemoPosition(index < 0 ? phrase.notes.length - 1 : Math.max(0, index - 1));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, phrase]);

  useEffect(() => {
    const player = audio.current;
    const hide = () => {
      if (document.hidden) {
        player?.pause();
        setPlaying(false);
        gate.current = emptyPitchGate();
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      player?.pause();
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);

  useEffect(() => {
    if (
      stage !== 'play' ||
      manual ||
      justHit ||
      mic.status !== 'listening' ||
      !target ||
      performance.now() < settleUntil.current
    )
      return;
    const result = gradePitch(gate.current, mic.pitch, target.midi, performance.now());
    gate.current = result.gate;
    if (result.hit) {
      setMatched((prev) => (prev.includes(target.index) ? prev : [...prev, target.index]));
      setJustHit(true);
    }
  }, [mic.pitch, mic.status, stage, manual, justHit, target]);

  useEffect(() => {
    if (!justHit) return;
    const timeout = setTimeout(() => {
      setJustHit(false);
      if (position + 1 === phrase.notes.length) {
        stopMic();
        setStage('phraseDone');
      } else setPosition((index) => index + 1);
    }, 420);
    return () => clearTimeout(timeout);
  }, [justHit, position, phrase.notes.length, stopMic]);

  const stopAudio = () => {
    audio.current?.pause();
    setPlaying(false);
  };
  const exit = (action) => {
    stopAudio();
    mic.stop();
    action();
  };
  const preview = async () => {
    setVideoPosition(null);
    if (playing) {
      stopAudio();
      return;
    }
    setAudioError('');
    if (!audio.current || !sourceUrl) {
      setAudioError('This recording is unavailable. You can still follow the guide.');
      return;
    }
    audio.current.currentTime = phrase.start;
    audio.current.playbackRate = speed;
    setDemoPosition(0);
    try {
      await audio.current.play();
      setPlaying(true);
    } catch {
      setAudioError('The recording could not play. Try again or continue with the guide.');
    }
  };
  const beginTurn = () => {
    setVideoPosition(null);
    stopAudio();
    gate.current = emptyPitchGate();
    settleUntil.current = performance.now() + 400;
    setStage('play');
    if (!manual && mic.status === 'off') void mic.start();
  };
  const preparePhrase = (index) => {
    setVideoPosition(null);
    stopAudio();
    mic.stop();
    setPhraseIndex(index);
    setPosition(0);
    setDemoPosition(0);
    setHeard(false);
    setJustHit(false);
    gate.current = emptyPitchGate();
    setStage('listen');
  };
  const advanceManual = () => {
    if (position + 1 === phrase.notes.length) setStage('phraseDone');
    else setPosition((i) => i + 1);
  };
  const finish = () => {
    stopAudio();
    mic.stop();
    logPractice(lesson, {
      kind: 'lesson',
      matched: matched.length,
      total: lesson.notes.length,
      manual,
    });
    onComplete({
      fingerprint: lessonFingerprint(sourceLesson),
      matched: matched.length,
      total: lesson.notes.length,
      phrases: phrases.length,
      completedAt: Date.now(),
      rhythmOnTime: Object.values(rhythm)
        .filter((item) => item.reliable !== false)
        .reduce((total, item) => total + item.onTime, 0),
      rhythmPhrases: Object.values(rhythm).filter((item) => item.reliable !== false).length,
    });
    setStage('complete');
  };

  const pitch = mic.pitch;
  const isMatch = target && pitch?.midi === target.midi && Math.abs(pitch.cents) <= 35;
  const needsRelease = target && gate.current.awarded === target.midi && !justHit;
  let feedback = manual
    ? 'Take your time. Try the highlighted note.'
    : mic.status === 'requesting'
      ? 'Connecting your microphone…'
      : mic.status !== 'listening'
        ? 'Ready when you are. Your microphone is paused.'
        : needsRelease
          ? 'Mute the string, then pluck it again.'
          : !pitch
            ? 'Your turn. Play the highlighted note.'
            : isMatch
              ? 'That’s it. Let the note ring…'
              : `Hearing ${noteName(pitch.midi)}. Aim for ${noteName(target?.midi)}.`;
  if (justHit) feedback = 'That’s the note. You got it!';
  const detail =
    pitch && target && pitch.midi === target.midi && !isMatch
      ? `A little ${pitch.cents > 0 ? 'sharp' : 'flat'} (${Math.abs(Math.round(pitch.cents))} cents). Adjust your tuning and try again.`
      : needsRelease
        ? 'Pluck again clearly, or briefly mute the string between notes.'
        : 'We’ll wait for you. There’s no need to rush.';
  const completedCount =
    stage === 'complete'
      ? lesson.notes.length
      : stage === 'phraseDone' || stage === 'rhythm'
        ? (phrase.notes.at(-1)?.index ?? 0) + 1
        : (target?.index ?? 0);

  if (drilling)
    return (
      <AdaptiveDrill
        phrase={phrase}
        bpm={lesson.bpm}
        result={rhythm[phraseIndex]}
        onExit={() => setDrilling(false)}
      />
    );
  if (lesson.notes.some((n) => n.unplayable))
    return (
      <div className="lc-panel">
        <h1>This passage needs a different setup.</h1>
        <p>
          Some notes are below the capo or outside your guitar’s range. Change your setup in the
          song guide.
        </p>
        <button className="loop-button loop-button-secondary" type="button" onClick={onExit}>
          Back to song guide
        </button>
      </div>
    );

  return (
    <div className="lf-session" ref={session}>
      <audio
        ref={audio}
        src={sourceUrl || undefined}
        preload="auto"
        onEnded={() => {
          setPlaying(false);
          setHeard(true);
        }}
        onError={() => {
          setPlaying(false);
          setAudioError('This recording could not be loaded. You can still follow the guide.');
        }}
      />
      <header className="lf-header">
        <button
          type="button"
          className="loop-icon-button"
          aria-label="Exit practice"
          onClick={() => exit(onExit)}
        >
          <X size={22} />
        </button>
        <div className="lf-header-song">
          <strong>{lesson.title}</strong>
          <span>
            {saveError
              ? 'PROGRESS SAVED FOR THIS SESSION ONLY'
              : checkpoint && stage === 'setup'
                ? 'WELCOME BACK · YOUR PLACE IS SAVED'
                : 'GUIDED GUITAR PRACTICE'}
          </span>
        </div>
        <div className="lf-session-progress">
          <div
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuemin={0}
            aria-valuemax={lesson.notes.length}
            aria-valuenow={completedCount}
          >
            <span
              style={{
                width: `${lesson.notes.length ? (completedCount / lesson.notes.length) * 100 : 0}%`,
              }}
            />
          </div>
          <span>
            {stage === 'setup'
              ? 'Let’s get ready'
              : `Phrase ${phraseIndex + 1} of ${phrases.length}`}
          </span>
        </div>
        <span className={`lf-mic-state ${mic.status === 'listening' ? 'is-on' : ''}`}>
          {mic.status === 'listening' ? <Mic size={16} /> : <MicOff size={16} />}
          <span>{mic.status === 'listening' ? 'Mic connected' : 'Mic off'}</span>
        </span>
      </header>
      {saveError && (
        <p className="lf-save-warning" role="status">
          Device storage is unavailable. Your place is kept for this visit; keep this tab open to
          retain it.
        </p>
      )}
      {(lesson.plan || sessionStep) && (
        <div className="lc-session-strip">
          <span>{sessionStep ? `DAILY SESSION · ${sessionStep}` : 'YOUR LESSON PLAN'}</span>
          <strong>{lesson.plan?.label || lesson.title}</strong>
        </div>
      )}
      {stage === 'setup' ? (
        <section className="lf-setup">
          <div className="lf-guitar-orbit">
            <Guitar size={58} strokeWidth={1.2} />
            <span>
              <MusicNoteIcon />
            </span>
          </div>
          <div className="lj-eyebrow">STEP 03 · MAKE IT YOURS</div>
          <h1>
            A little space.
            <br />
            <em>A little music.</em>
          </h1>
          <p>
            {checkpoint
              ? `Pick up at phrase ${phraseIndex + 1}, note ${position + 1} of `
              : 'Let’s get you ready to play '}
            <strong>{lesson.title}.</strong>
          </p>
          <div className="lf-setup-checklist">
            <div>
              <Guitar size={22} />
              <span>
                <strong>Grab your guitar</strong>
                <small>
                  {profileLabel(profile)} · {profile.handedness}-handed
                </small>
              </span>
            </div>
            <div>
              <Headphones size={22} />
              <span>
                <strong>Pop on headphones</strong>
                <small>So we hear your strings, not the example.</small>
              </span>
            </div>
            <div>
              <Mic size={22} />
              <span>
                <strong>Let us listen</strong>
                <small>Your microphone checks notes as you play. Audio stays here.</small>
              </span>
            </div>
          </div>
          <MicrophoneSetup mic={mic} onReady={() => enterLesson()} />
          <button
            type="button"
            className="lj-text-link"
            onClick={() => {
              enterLesson(true);
            }}
          >
            Explore without a microphone <ArrowRight size={14} />
          </button>
          <span className="lf-setup-footnote">
            Find the notes at your pace, then bring them together in time.
          </span>
        </section>
      ) : stage === 'complete' ? (
        <section className="lf-celebration">
          <div className="lf-trophy">
            <Trophy size={45} strokeWidth={1.3} />
          </div>
          <div className="lj-eyebrow">LOOK AT YOU GO</div>
          <h1>
            {matched.length === lesson.notes.length
              ? 'You found every note.'
              : 'A little better already.'}
            <br />
            <em>That’s your progress.</em>
          </h1>
          <p>
            You worked through every phrase of <strong>{lesson.title}.</strong>
          </p>
          <div className="lf-result-stats">
            <div>
              <strong>
                {matched.length}
                <small> / {lesson.notes.length}</small>
              </strong>
              <span>notes matched by microphone</span>
            </div>
            <div>
              <strong>{phrases.length}</strong>
              <span>phrases explored</span>
            </div>
            <div>
              <strong>
                {Object.values(rhythm)
                  .filter((result) => result.reliable !== false)
                  .reduce((total, result) => total + result.onTime, 0)}
              </strong>
              <span>correct notes on time</span>
            </div>
          </div>
          {matched.length < lesson.notes.length && (
            <p className="lf-status-copy">
              Notes explored without microphone feedback are not counted as matches.
            </p>
          )}
          <p className="lf-status-copy">
            Pitch and timing are separate milestones. Your chord playing, note length and technique
            still need your ears.
          </p>
          <button
            type="button"
            className="lj-text-link"
            onClick={() => {
              const index = phrases.findIndex(
                (part, i) =>
                  part.notes.some((n) => !matched.includes(n.index)) ||
                  !rhythm[i] ||
                  rhythm[i].onTime < rhythm[i].total
              );
              preparePhrase(Math.max(0, index));
            }}
          >
            Review a phrase that needs work <RotateCcw size={15} />
          </button>
          <div className="lf-celebration-actions">
            {onNextSessionStep && (
              <button
                type="button"
                className="loop-button loop-button-purple"
                onClick={() => exit(onNextSessionStep)}
              >
                Next daily exercise <ArrowRight size={17} />
              </button>
            )}
            <button
              type="button"
              className="loop-button loop-button-purple lj-primary"
              onClick={() => exit(onChooseAnother)}
            >
              Find your next song <ArrowRight size={17} />
            </button>
            <button
              type="button"
              className="loop-button loop-button-secondary"
              onClick={() => {
                setMatched([]);
                setRhythm({});
                preparePhrase(0);
              }}
            >
              Play it again <RotateCcw size={16} />
            </button>
          </div>
          <button type="button" className="lj-text-link" onClick={() => exit(onExit)}>
            <ArrowLeft size={14} />
            Back to the song guide
          </button>
        </section>
      ) : stage === 'rhythm' ? (
        <RhythmPractice
          phrase={phrase}
          bpm={lesson.bpm}
          mic={mic}
          initialSpeed={speed}
          onRequestMicrophone={() => {
            setupReturn.current = 'rhythm';
            setStage('setup');
          }}
          onBack={() => {
            mic.stop();
            setStage('phraseDone');
          }}
          onDone={(result) => {
            setRhythm((previous) => ({ ...previous, [phraseIndex]: result }));
            logPractice(lesson, {
              kind: 'rhythm',
              phrase: (lesson.plan?.first || 0) + phraseIndex,
              result,
            });
            mic.stop();
            setStage('phraseDone');
          }}
        />
      ) : stage === 'phraseDone' ? (
        <section className="lf-celebration">
          <div className="lf-trophy">
            <Check size={48} strokeWidth={1.5} />
          </div>
          <div className="lj-eyebrow">PHRASE {phraseIndex + 1} · PITCH PRACTICE</div>
          <h1>
            {phraseMatched === phrase.notes.length
              ? 'You’ve found the notes.'
              : 'One little step forward.'}
            <br />
            <em>{lastPhrase ? 'Let’s see your progress.' : 'Ready for the next little bit?'}</em>
          </h1>
          <p>
            {phraseMatched} of {phrase.notes.length} notes matched by microphone in this phrase.
          </p>
          <div className="lf-next-skill">
            <strong>
              {rhythm[phraseIndex]?.reliable === false
                ? 'Attempt unconfirmed. Check your microphone and try again.'
                : rhythm[phraseIndex]
                  ? `${rhythm[phraseIndex].onTime} of ${rhythm[phraseIndex].total} notes on time at ${rhythm[phraseIndex].speed * 100}% speed`
                  : 'Now connect the notes to a beat.'}
            </strong>
            <p>A four-beat count-in, a slower tempo, and feedback on each note’s timing.</p>
            <button
              type="button"
              className="loop-button loop-button-purple"
              onClick={() => {
                stopAudio();
                setStage('rhythm');
                if (!manual && mic.status === 'off') void mic.start();
              }}
            >
              {rhythm[phraseIndex] ? 'Practice the rhythm again' : 'Try it in time'}{' '}
              <ArrowRight size={17} />
            </button>
          </div>
          {adaptiveSuggestion(phrase, rhythm[phraseIndex], speed) && (
            <div className="lc-coach-suggestion">
              <span className="lj-eyebrow">A SMALL STEP THAT HELPS</span>
              <p>{adaptiveSuggestion(phrase, rhythm[phraseIndex], speed).message}</p>
              <button
                type="button"
                className="loop-button loop-button-secondary"
                onClick={() => {
                  mic.stop();
                  setDrilling(true);
                }}
              >
                Practice my tricky transition
              </button>
            </div>
          )}
          <PracticeCheckIn
            key={`${lesson.id}:${phraseIndex}`}
            lesson={lesson}
            phrase={phraseIndex}
          />
          <RecordCompare
            lesson={lesson}
            phrase={phrase}
            mic={mic}
            speed={speed}
            sourceUrl={sourceUrl}
            onBeforeRecord={stopAudio}
          />
          <div
            className="lf-phrase-dots"
            aria-label={`${phraseIndex + 1} of ${phrases.length} phrases explored`}
          >
            {phrases.map((_, i) => (
              <span key={i} className={i <= phraseIndex ? 'is-done' : ''}>
                {i <= phraseIndex ? <Check size={16} /> : i + 1}
              </span>
            ))}
          </div>
          <div className="lf-celebration-actions">
            <button
              type="button"
              className="loop-button loop-button-purple lj-primary"
              onClick={() => (lastPhrase ? finish() : preparePhrase(phraseIndex + 1))}
            >
              {lastPhrase ? 'See my progress' : 'Next phrase'}
              <ArrowRight size={17} />
            </button>
            <button
              type="button"
              className="loop-button loop-button-secondary"
              onClick={() => preparePhrase(phraseIndex)}
            >
              <RotateCcw size={16} />
              Try this phrase again
            </button>
          </div>
        </section>
      ) : (
        <section className="lf-practice">
          <div className="lf-stage-label">
            <span className={stage === 'listen' ? 'is-active' : 'is-done'}>
              {stage === 'play' ? <Check size={13} /> : <Headphones size={14} />}Listen
            </span>
            <i />
            <span className={stage === 'play' ? 'is-active' : ''}>
              <Guitar size={14} />
              Your turn
            </span>
          </div>
          <div className="lf-practice-title">
            <span className="lj-eyebrow">
              PHRASE {phraseIndex + 1} · {phrase.notes.length} NOTES · YOUR PACE
            </span>
            <h1>
              {stage === 'listen' ? (
                <>
                  First, <em>get a feel for it.</em>
                </>
              ) : (
                <>
                  Now, <em>make a little music.</em>
                </>
              )}
            </h1>
            <p>
              {stage === 'listen'
                ? 'Listen to the short phrase. Watch each note light up, then give it a try.'
                : manual
                  ? 'Follow the highlighted note. Tap Next note when you’re ready to move on.'
                  : 'Follow the highlighted note. We’ll move on when we hear it clearly.'}
            </p>
          </div>
          <section
            className={`lf-playing-card${justHit ? ' is-correct' : ''}`}
            aria-label="Current phrase"
          >
            <div className="lf-note-rail" aria-label="Notes in this phrase">
              {phrase.notes.map((n, i) => (
                <div
                  key={n.index}
                  className={`${(stage === 'listen' ? demoPosition : position) === i ? 'is-current' : ''} ${stage === 'play' && i < position && matched.includes(n.index) ? 'is-past' : ''}`}
                >
                  <span>
                    {stage === 'play' && matched.includes(n.index) && i < position ? (
                      <Check size={14} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <strong>{noteName(n.midi)}</strong>
                  <small>
                    {strings[n.string]} · {n.fret === 0 ? 'open' : `fret ${n.fret}`}
                  </small>
                </div>
              ))}
            </div>
            <div className="lf-target">
              <div className="lf-target-note">
                <span>
                  {stage === 'listen' ? 'FOLLOW ALONG' : justHit ? 'GOT IT' : 'YOUR NEXT NOTE'}
                </span>
                <strong>{displayNote ? noteName(displayNote.midi) : '—'}</strong>
              </div>
              <div>
                <h2>
                  {displayNote?.fret === 0
                    ? 'Play the open string.'
                    : `Hold fret ${displayNote?.fret}.`}
                </h2>
                <p>
                  String {displayNote ? 6 - displayNote.string : ''} ·{' '}
                  {displayNote
                    ? displayNote.string === 5
                      ? `${strings[5]}, the thinnest string`
                      : displayNote.string === 0
                        ? `${strings[0]}, the thickest string`
                        : `${strings[displayNote.string]} string`
                    : ''}
                </p>
              </div>
              <span className="lf-target-icon">
                {justHit ? <CheckCircle2 size={30} /> : <Guitar size={29} strokeWidth={1.3} />}
              </span>
            </div>
            <Fretboard note={displayNote} />
            {displayNote && (
              <p className="lf-finger-hint">
                {displayNote.fret === 0
                  ? 'Leave this string open. Pluck it once and let it ring.'
                  : `Try your ${['index', 'middle', 'ring', 'little'][fingeringFor(displayNote, phrase.notes).finger - 1]} finger, with your hand near fret ${fingeringFor(displayNote, phrase.notes).position}. Press just behind the fret wire, with a curved fingertip.`}
              </p>
            )}
            <HandDemonstration
              lesson={lesson}
              phrase={phrase}
              note={displayNote}
              playing={playing}
              onFollow={stage === 'listen' ? setVideoPosition : undefined}
              onVideoStart={() => {
                stopAudio();
                mic.stop();
                if (stage !== 'listen') setStage('listen');
              }}
            />
            {stage === 'play' && (
              <div
                className={`lf-feedback${justHit ? ' is-correct' : ''}`}
                role="status"
                aria-live="polite"
              >
                <span>
                  {justHit ? (
                    <CheckCircle2 size={24} />
                  ) : mic.status === 'listening' ? (
                    <AudioLines size={24} />
                  ) : (
                    <Guitar size={24} />
                  )}
                </span>
                <div>
                  <strong>{feedback}</strong>
                  <p>
                    {manual
                      ? 'Self-guided mode: move ahead when you’re ready. Microphone scores stay off.'
                      : detail}
                  </p>
                </div>
                {mic.status === 'listening' && pitch && (
                  <span className="lf-heard-note">
                    HEARING<strong>{noteName(pitch.midi)}</strong>
                  </span>
                )}
              </div>
            )}
          </section>
          {stage === 'listen' ? (
            <div className="lf-controls">
              <div className="lf-listen-controls">
                <button
                  type="button"
                  className="loop-button loop-button-secondary"
                  onClick={() => void preview()}
                >
                  {playing ? <Pause size={17} /> : <Volume2 size={17} />}
                  {playing ? 'Pause example' : heard ? 'Hear it again' : 'Hear this phrase'}
                </button>
                <label>
                  Speed
                  <select
                    aria-label="Example speed"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                  >
                    <option value="0.5">50%</option>
                    <option value="0.75">75%</option>
                    <option value="1">100%</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                className="loop-button loop-button-purple lj-primary"
                onClick={beginTurn}
              >
                {manual ? 'Try it at my own pace' : 'My turn — let’s play'}
                <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <div className="lf-controls">
              <button
                type="button"
                className="lj-text-link"
                onClick={() => {
                  stopAudio();
                  mic.stop();
                  setJustHit(false);
                  gate.current = emptyPitchGate();
                  setStage('listen');
                }}
              >
                <Headphones size={16} />
                Listen again
              </button>
              {manual ? (
                <div className="lf-manual-actions">
                  <button
                    type="button"
                    className="loop-button loop-button-secondary"
                    onClick={() => {
                      setupReturn.current = 'play';
                      gate.current = emptyPitchGate();
                      setStage('setup');
                    }}
                  >
                    <Mic size={16} />
                    Use microphone
                  </button>
                  <button
                    type="button"
                    className="loop-button loop-button-purple"
                    onClick={advanceManual}
                  >
                    {position + 1 === phrase.notes.length ? 'Finish phrase' : 'Next note'}
                    <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="loop-button loop-button-secondary"
                  onClick={() => {
                    gate.current = emptyPitchGate();
                    if (mic.status === 'off') void mic.start();
                    else mic.stop();
                  }}
                >
                  {mic.status === 'off' ? <Mic size={16} /> : <Pause size={16} />}
                  {mic.status === 'off'
                    ? 'Resume microphone'
                    : mic.status === 'requesting'
                      ? 'Cancel connection'
                      : 'Pause microphone'}
                </button>
              )}
            </div>
          )}
          {audioError && (
            <p className="loop-error" role="alert">
              {audioError}
            </p>
          )}
          {mic.error && (
            <div className="lf-mic-error">
              <p className="loop-error" role="alert">
                {mic.error}
              </p>
              <button
                type="button"
                className="lj-text-link"
                onClick={() => {
                  mic.stop();
                  setManual(true);
                }}
              >
                Continue without microphone feedback <ArrowRight size={14} />
              </button>
            </div>
          )}
          <p className="lf-gentle-reminder">
            <Sparkles size={14} />
            {manual
              ? 'Explore the melody at your own pace. Every little bit counts.'
              : 'Clean, single notes work best. Mute between repeated notes.'}
          </p>
        </section>
      )}
    </div>
  );
}

function MusicNoteIcon() {
  return <Play size={16} fill="currentColor" />;
}
