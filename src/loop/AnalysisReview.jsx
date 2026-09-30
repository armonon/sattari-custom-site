import { ArrowRight, FileAudio, ShieldCheck } from 'lucide-react';
import { NOTE_NAMES } from './music';
import DraftAudition from './DraftAudition';

export default function AnalysisReview({
  lesson,
  reviewed,
  onReview,
  onStudio,
  onKeyChange,
  onRebuildOriginal,
  sourceUrl,
  onEditLesson,
  onBeforePlay,
  otherPlaying,
}) {
  const quality = lesson.quality;
  const key = lesson.keyAnalysis;
  const prepared = quality?.preparation === 'instruments';
  const polyphonic = quality?.harmonyMethod === 'basic-pitch';
  const coverage = quality ? Math.round(quality.coverage * 100) : null;
  if (lesson.source === 'score')
    return (
      <section className="lf-analysis-review" aria-label="Score import review">
        <div>
          <span className="lj-eyebrow">YOUR WRITTEN PART</span>
          <h2>Check the part and its timing.</h2>
          <p>
            These notes came from your score. Confirm the selected track, tuning, and start offset
            against the recording. Melody practice follows the highest note at each attack;
            simultaneous pitches stay in the chord-tone guide.
          </p>
          <p>
            {lesson.synthesizedReference
              ? 'Playback is a synthesized reference created from the imported notes.'
              : `Aligned to your recording at ${lesson.scoreAlignment?.offset || 0} seconds and ${lesson.bpm} BPM.`}
          </p>
          {lesson.warnings?.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <button type="button" className="lj-text-link" onClick={onStudio}>
            Review & edit the guide <ArrowRight size={16} />
          </button>
          <label className="lf-review-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => onReview(e.target.checked)}
            />
            <span>I checked this part and its timing and want to practice it.</span>
          </label>
        </div>
      </section>
    );
  return (
    <section className="lf-analysis-review" aria-label="Recording analysis review">
      <div className="lf-analysis-icon">
        <FileAudio size={24} />
      </div>
      <div>
        <span className="lj-eyebrow">YOUR RECORDING · DRAFT GUIDE</span>
        <h2>Let’s check what we heard.</h2>
        <p>
          {prepared
            ? 'We reduced vocals, bass and drums before finding notes. The instrumental part can still contain piano, other guitars and separation artifacts. Listen to both versions and check which part the guide follows.'
            : polyphonic
              ? 'Your melody and chord tones have separate guides. The chord-tone model can hear overlapping pitches, but cannot tell a guitar from another instrument. Compare the draft with your recording.'
              : 'This analyzer follows one prominent note at a time. In a full-band song, it may follow the singer or bass instead of your guitar. Full-band preparation reduces those parts, but cannot isolate guitar alone.'}
        </p>
        {prepared && onRebuildOriginal && (
          <div className="lf-prepare-recovery">
            <p>
              Missing the low notes? Separation can remove low guitar notes along with the bass.
            </p>
            <button type="button" className="lj-text-link" onClick={onRebuildOriginal}>
              Rebuild from the original recording <ArrowRight size={16} />
            </button>
          </div>
        )}
        {key && (
          <div className="lf-analysis-engines">
            <section className="lf-key-result" aria-label="Sattari AutoKey result">
              <span className="lj-eyebrow">SATTARI AUTOKEY</span>
              <strong>{key.evidence === 'insufficient' ? 'No clear key yet' : key.key}</strong>
              <span className="lf-evidence-label">
                {key.evidence === 'supported'
                  ? 'Suggested key'
                  : key.evidence === 'tentative'
                    ? 'Needs a closer listen'
                    : 'Not enough harmonic context'}
              </span>
              {key.alternative && key.evidence !== 'insufficient' && (
                <p>
                  Another possibility: <b>{key.alternative.key}</b>.
                </p>
              )}
              {key.possibleModulation && (
                <p>The key may change during this recording. Check each phrase as you learn.</p>
              )}
              <small>
                {prepared
                  ? 'Key estimated from your original mix.'
                  : 'Key estimated from the whole recording.'}{' '}
                This does not change the detected notes.
              </small>
              {onKeyChange && (
                <label className="lf-key-choice">
                  Key for your guide
                  <select value={lesson.key} onChange={(event) => onKeyChange(event.target.value)}>
                    {[
                      ...new Set([
                        lesson.key,
                        ...NOTE_NAMES.flatMap((root) => [`${root} major`, `${root} minor`]),
                      ]),
                    ].map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
              )}
            </section>
            <section aria-label="Note detection method">
              <span className="lj-eyebrow">
                {quality.method === 'crepe-tiny' ? 'AUTO PITCH' : 'MELODY DETECTOR'}
              </span>
              <strong>One note at a time.</strong>
              <p>
                {quality.method === 'crepe-tiny'
                  ? 'The neural pitch model follows the melody and suggests guitar positions.'
                  : 'The standard pitch detector follows clear, sustained notes.'}
              </p>
              {quality.pitchFallback && (
                <small>
                  The neural model was unavailable. The standard detector was used for this guide.
                </small>
              )}
              <small>
                {polyphonic
                  ? 'Your chord-tone guide keeps overlapping pitches. Melody practice checks one note at a time.'
                  : 'Chord charts are separate estimates. Strummed chords are not converted into complete polyphonic tabs.'}
              </small>
            </section>
          </div>
        )}
        <div className="lf-analysis-facts">
          <span>
            <strong>{lesson.notes.length}</strong> note estimates
          </span>
          <span>
            <strong>{lesson.chords.length}</strong> chord estimates
          </span>
          {coverage != null && (
            <span>
              <strong>{coverage}%</strong>{' '}
              {polyphonic ? 'melody coverage' : 'of audio has note estimates'}
            </span>
          )}
        </div>
        {polyphonic && (
          <p className="lf-poly-analysis-note">
            <strong>{lesson.polyphonicNotes?.length || 0} overlapping-note estimates.</strong> Open
            Chord tones to check pitches, suggested fingerings and missing notes. Chord names use
            the detected tones; missing tones can still produce the wrong name.
          </p>
        )}
        {quality?.harmonyFallback && (
          <p className="loop-error" role="status">
            The chord-tone model could not run. This guide uses the melody detector and a basic
            major/minor chord chart. Try rebuilding to include overlapping notes.
          </p>
        )}
        {coverage != null && coverage < 25 && (
          <p className="loop-error">
            {polyphonic && lesson.chords.length
              ? 'No clear continuous melody was found. You can still review the chord-tone guide and practice the chord shapes.'
              : 'Only a small part of this recording produced clear notes. A clean, single-note guitar clip will give you a more useful guide.'}
          </p>
        )}
        <p>
          Play the recording, compare the notes and correct the draft in the editor. Key, tempo and
          sheet-music rhythm also need checking.{' '}
          {polyphonic
            ? 'An empty chord section means the detected tones did not support a chord name. Seventh, suspended and power chords are supported when their tones are present.'
            : 'An empty chord section means no distinct major or minor triad was found.'}
        </p>
        <button type="button" className="lj-text-link" onClick={onStudio}>
          Review & edit the guide <ArrowRight size={16} />
        </button>
        <DraftAudition
          lesson={lesson}
          sourceUrl={sourceUrl}
          onEdit={onEditLesson}
          otherPlaying={otherPlaying}
          onBeforePlay={onBeforePlay}
        />
        {!!(lesson.notes.length || lesson.chords.length) && (
          <label className="lf-review-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => onReview(event.target.checked)}
            />
            <span>I checked this guide against the recording and want to practice it.</span>
            {reviewed && <ShieldCheck size={19} />}
          </label>
        )}
        <small>
          For a ready-to-play lesson, choose one of the arranged classics in the library. Your audio
          stays on this device.
        </small>
      </div>
    </section>
  );
}
