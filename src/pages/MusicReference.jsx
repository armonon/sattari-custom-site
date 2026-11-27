import { Link, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import NotFoundPage from '../components/NotFoundPage';
import { TempoDial } from '../labs/keybpm/KeyBpmHero';
import { CircleOfFifths } from '../labs/keybpm/KeyReadout';
import { conventionalKeyLabel as keyLabel, scaleFrequencies } from '../labs/keybpm/keyTheory';
import { useMetronome } from '../labs/keybpm/metronome';
import '../labs/keybpm/keyBpm.css';
import {
  BPM_PAGE_MAX,
  BPM_PAGE_MIN,
  bpmDescription,
  bpmPage,
  bpmPages,
  bpmTitle,
  keyDescription,
  keyPageBySlug,
  keyPageFor,
  keyPages,
  keyTitle,
} from '../data/musicReference';
import { Page } from './MusicResources';
import './MusicReference.css';

const TOOL = '/studio/keybpm';

function ToolLink({ children }) {
  return (
    <Link className="resource-action" to={TOOL}>
      {children}
      <ArrowRight size={18} aria-hidden="true" />
    </Link>
  );
}

function KeyLink({ keyName }) {
  const page = keyPageFor(keyName);
  return (
    <Link to={page.path}>
      {page.label} ({page.camelot})
    </Link>
  );
}

// One octave up the scale, on a short-lived audio context.
function playScale(key) {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  const audio = new Context();
  const start = audio.currentTime + 0.05;
  const notes = scaleFrequencies(key, 3);
  notes.forEach((frequency, index) => {
    const when = start + index * 0.32;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.16, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(when);
    osc.stop(when + 0.32);
  });
  setTimeout(() => void audio.close().catch(() => {}), notes.length * 320 + 400);
}

export function KeyIndex() {
  return (
    <Page
      title="Musical Keys: Notes, Chords & Camelot Codes for All 24 Keys"
      description="Every major and minor key with its notes, chords, relative key, key signature and Camelot code, plus the keys each one mixes with."
      category="Reference / Keys"
    >
      <p className="resource-lead">
        Pick a key to see its notes, the chords built on each step, and the keys it mixes with.
      </p>
      <ToolLink>Find the key of a song</ToolLink>
      {['major', 'minor'].map((mode) => (
        <section className="resource-section" key={mode}>
          <h2>{mode === 'major' ? 'Major keys' : 'Minor keys'}</h2>
          <ul className="reference-grid">
            {keyPages
              .filter((page) => page.mode === mode)
              .sort((a, b) => parseInt(a.camelot, 10) - parseInt(b.camelot, 10))
              .map((page) => (
                <li key={page.slug}>
                  <Link to={page.path}>
                    <b>{page.label}</b>
                    <span>
                      {page.camelot} · {page.signature}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <section className="resource-section">
        <h2>Tempo reference</h2>
        <p>
          Looking for a tempo instead? <Link to="/bpm">Browse every BPM</Link> for a metronome click
          and delay times.
        </p>
      </section>
    </Page>
  );
}

export function KeyPage() {
  const { slug } = useParams();
  const page = keyPageBySlug(slug);
  if (!page) return <NotFoundPage />;
  const minor = page.mode === 'minor';
  return (
    <Page title={keyTitle(page)} description={keyDescription(page)} category="Reference / Keys">
      <p className="resource-lead">
        {page.label} uses the notes {page.notes.join(', ')}. Its key signature has {page.signature},
        its relative {minor ? 'major' : 'minor'} is {keyLabel(page.relative)}, and DJs know it as
        Camelot {page.camelot}.
        {page.alias &&
          ` In plain text it is written ${page.tonic.replace('♯', '#').replace('♭', 'b')} ${page.mode}, and the same pitches can be spelled ${page.alias}.`}
      </p>
      <div className="reference-hero">
        <CircleOfFifths keyName={page.key} alternative={page.relative} />
        <div>
          <button type="button" className="resource-link" onClick={() => playScale(page.key)}>
            Play the {page.label} scale
          </button>
          <ToolLink>Check if your song is in {page.label}</ToolLink>
        </div>
      </div>
      <dl className="resource-facts">
        {[
          ['Notes', page.notes.join(' – ')],
          ['Key signature', page.signature],
          ['Camelot code', page.camelot],
          [`Relative ${minor ? 'major' : 'minor'}`, <KeyLink key="r" keyName={page.relative} />],
          [`Parallel ${minor ? 'major' : 'minor'}`, <KeyLink key="p" keyName={page.parallel} />],
          ['Tonic pitch', `${page.tonic}3 = ${page.tonicHz} Hz (A4 = 440 Hz)`],
          ...(page.alias ? [['Also written', page.alias]] : []),
        ].map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <section className="resource-section">
        <h2>Chords in {page.label}</h2>
        <p>
          Stack every other scale note on each step and you get these seven chords
          {minor ? ' (natural minor)' : ''}.
        </p>
        <ul className="reference-chords" aria-label={`Chords in ${page.label}`}>
          {page.chords.map(({ numeral, name }) => (
            <li key={numeral} className="kb-chord">
              {name}
              <small>{numeral}</small>
            </li>
          ))}
        </ul>
      </section>
      <section className="resource-section">
        <h2>Common chord progressions in {page.label}</h2>
        <table className="reference-table">
          <thead>
            <tr>
              <th scope="col">Progression</th>
              <th scope="col">Chords</th>
            </tr>
          </thead>
          <tbody>
            {page.progressions.map(({ numerals, chords }) => (
              <tr key={numerals}>
                <th scope="row">{numerals}</th>
                <td>{chords.join(' – ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="resource-section">
        <h2>Keys that mix with {page.label}</h2>
        <p>
          On the Camelot wheel, {page.camelot} blends with the same number in the other letter and
          with one step either side. These keys share six or all seven notes with {page.label}.
        </p>
        <ul>
          {page.mixes.map(({ key, relation }) => (
            <li key={relation}>
              <KeyLink keyName={key} /> · {relation}
            </li>
          ))}
        </ul>
      </section>
      <section className="resource-section">
        <h2>How to tell a song is in {page.label}</h2>
        <p>
          The melody and chords keep coming home to {page.tonic}, and {page.chords[0].name} sounds
          like the resting point. {page.label} and {keyLabel(page.relative)} share all seven notes,
          so software and ears often confuse them: listen for which chord feels like home. Sattari
          Key &amp; BPM estimates the key from the audio on your device and lets you check it
          against a drone.
        </p>
        <Link to="/guides/find-song-key-and-bpm">How to read key and BPM estimates</Link>
      </section>
      <nav className="resource-related" aria-label="Related pages">
        <h2>Keep exploring</h2>
        <Link to="/studio/keybpm#scales">
          Play and practice this scale <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link to="/tuner/guitar">
          Tune your guitar first <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link to="/keys">
          All 24 keys <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link to="/bpm">
          Tempo reference <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link to="/tools/key-bpm">
          Sattari Key &amp; BPM details <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </nav>
    </Page>
  );
}

const MARKING_GROUPS = bpmPages.reduce((groups, page) => {
  const last = groups.at(-1);
  if (last?.name === page.marking.name) last.pages.push(page);
  else groups.push({ ...page.marking, pages: [page] });
  return groups;
}, []);

export function BpmIndex() {
  return (
    <Page
      title={`BPM Reference: Every Tempo from ${BPM_PAGE_MIN} to ${BPM_PAGE_MAX} BPM`}
      description={`A metronome click, milliseconds per beat and delay times for every tempo from ${BPM_PAGE_MIN} to ${BPM_PAGE_MAX} BPM, grouped by tempo marking.`}
      category="Reference / Tempo"
    >
      <p className="resource-lead">
        Pick a tempo to hear it, see how long each note lasts, and find its half and double time.
      </p>
      <ToolLink>Find the BPM of a song</ToolLink>
      {MARKING_GROUPS.map((group) => (
        <section className="resource-section" key={group.name}>
          <h2>
            {group.name} · {group.from}–{group.to} BPM
          </h2>
          <p>Roughly {group.meaning}. Boundaries between markings vary from source to source.</p>
          <ul className="reference-grid is-compact">
            {group.pages.map((page) => (
              <li key={page.bpm}>
                <Link to={page.path}>{page.bpm} BPM</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="resource-section">
        <h2>Key reference</h2>
        <p>
          Looking for a key instead? <Link to="/keys">Browse all 24 keys</Link>.
        </p>
      </section>
    </Page>
  );
}

function BpmLink({ bpm, children }) {
  return <Link to={`/bpm/${bpm}`}>{children || `${bpm} BPM`}</Link>;
}

export function BpmPage() {
  const { bpm } = useParams();
  const page = /^\d{2,3}$/.test(bpm || '') ? bpmPage(Number(bpm)) : null;
  const click = useMetronome(page?.bpm ?? null);
  if (!page) return <NotFoundPage />;
  return (
    <Page title={bpmTitle(page)} description={bpmDescription(page)} category="Reference / Tempo">
      <p className="resource-lead">
        At {page.bpm} beats per minute, one beat lasts {page.beatMs} milliseconds and a bar of 4/4
        lasts {page.barSeconds} seconds. The usual marking is {page.marking.name} (
        {page.marking.meaning}).
      </p>
      <div className="reference-hero">
        <TempoDial bpm={page.bpm} beating={click.on} />
        <div>
          <button
            type="button"
            className="resource-link"
            aria-pressed={click.on}
            onClick={click.toggle}
          >
            {click.on ? 'Stop the click' : `Play a ${page.bpm} BPM click`}
          </button>
          <ToolLink>Check if your song is {page.bpm} BPM</ToolLink>
        </div>
      </div>
      <dl className="resource-facts">
        {[
          ['One beat', `${page.beatMs} ms`],
          ['One 4/4 bar', `${page.barSeconds} s`],
          ['Beats per second', `${page.beatsPerSecond} Hz`],
          ['4/4 bars per minute', String(page.barsPerMinute)],
          [
            'Tempo marking',
            `${page.marking.name}, about ${page.marking.from}–${page.marking.to} BPM`,
          ],
          ['Half time', page.half ? <BpmLink key="h" bpm={page.half} /> : `${page.halfValue} BPM`],
          [
            'Double time',
            page.double ? <BpmLink key="d" bpm={page.double} /> : `${page.doubleValue} BPM`,
          ],
        ].map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <section className="resource-section">
        <h2>Delay and reverb times at {page.bpm} BPM</h2>
        <p>
          Set a delay, pre-delay or LFO to one of these values and it stays in time with a{' '}
          {page.bpm} BPM track. Dotted is one and a half times the note; triplet is two thirds.
        </p>
        <div className="reference-scroll">
          <table className="reference-table">
            <thead>
              <tr>
                <th scope="col">Note value</th>
                <th scope="col">Straight</th>
                <th scope="col">Dotted</th>
                <th scope="col">Triplet</th>
                <th scope="col">Rate</th>
              </tr>
            </thead>
            <tbody>
              {page.noteValues.map((note) => (
                <tr key={note.name}>
                  <th scope="row">{note.name}</th>
                  <td>{note.ms} ms</td>
                  <td>{note.dottedMs} ms</td>
                  <td>{note.tripletMs} ms</td>
                  <td>{note.hz} Hz</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="resource-section">
        <h2>How long are 8, 16 and 32 bars at {page.bpm} BPM?</h2>
        <ul>
          {page.phrases.map(({ bars, seconds }) => (
            <li key={bars}>
              {bars} bars of 4/4 = {seconds} seconds
            </li>
          ))}
        </ul>
      </section>
      <section className="resource-section">
        <h2>
          Is it {page.bpm}, {page.halfValue} or {page.doubleValue} BPM?
        </h2>
        <p>
          Tempo detectors, and people, can count the same song at half or double speed. A song
          measured at {page.bpm} BPM may feel like {page.halfValue} if you nod on every other beat,
          or {page.doubleValue} if you count the off-beats too. Play the click above with the song:
          the tempo you tap your foot to is the one to use.
        </p>
        {page.styles.length > 0 && (
          <p>
            Styles that often sit around {page.bpm} BPM: {page.styles.join(', ')}. This is a rough
            guide; any style can be played at any tempo.
          </p>
        )}
      </section>
      <nav className="resource-related" aria-label="Related pages">
        <h2>Keep exploring</h2>
        {page.previous && (
          <BpmLink bpm={page.previous}>
            {page.previous} BPM <ArrowRight size={18} aria-hidden="true" />
          </BpmLink>
        )}
        {page.next && (
          <BpmLink bpm={page.next}>
            {page.next} BPM <ArrowRight size={18} aria-hidden="true" />
          </BpmLink>
        )}
        <Link to="/bpm">
          Every tempo <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link to="/keys">
          All 24 keys <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </nav>
    </Page>
  );
}
