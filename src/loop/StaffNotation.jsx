import { useEffect, useRef, useState } from 'react';
import { scoreMeasures, polyphonicScoreMeasures } from './score';

export default function StaffNotation({ notes, active, bpm, polyphonic = false }) {
  const root = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const element = root.current;
    if (element) element.dataset.scoreReady = 'pending';
    setError('');
    // VexFlow 4 bundles glyph outlines: no CDN font requests or uploaded audio.
    import('vexflow')
      .then(({ default: Vex }) => {
        if (cancelled || !element) return;
        element.replaceChildren();
        const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Dot, StaveTie } =
          Vex.Flow;
        const measures = polyphonic
          ? polyphonicScoreMeasures(notes, bpm)
          : scoreMeasures(notes, bpm);
        const widths = measures.map((bar, i) =>
          Math.max(230, bar.events.length * 55 + (i ? 40 : 110))
        );
        const width = widths.reduce((sum, w) => sum + w, 20);
        const renderer = new Renderer(element, Renderer.Backends.SVG);
        renderer.resize(width, 230);
        const context = renderer.getContext();
        context.setFillStyle('#30302f').setStrokeStyle('#30302f');
        let x = 10;
        let previous;
        let previousPitches = [];
        measures.forEach((bar, i) => {
          const stave = new Stave(x, 70, widths[i]);
          if (i === 0) stave.addClef('treble', 'default', '8vb').addTimeSignature('4/4');
          stave.setContext(context).draw();
          context.setFont('sans-serif', 11).fillText(`Bar ${bar.number}`, x + 8, 43);
          const ties = [];
          const tickables = bar.events.map((event) => {
            const pitches = event.rest ? [] : polyphonic ? event.pitches : [event];
            const note = new StaveNote({
              keys: event.rest ? ['b/4'] : pitches.map((pitch) => pitch.key),
              duration: event.value + (event.rest ? 'r' : ''),
              auto_stem: true,
            });
            if (event.value.includes('d')) Dot.buildAndAttach([note], { all: true });
            pitches.forEach((pitch, index) => {
              if (pitch.accidental) note.addModifier(new Accidental(pitch.accidental), index);
            });
            if (pitches.some((pitch) => pitch.index === active) && !event.rest)
              note.setStyle({ fillStyle: '#705ca8', strokeStyle: '#705ca8' });
            pitches.forEach((pitch, index) => {
              const from = previousPitches.findIndex((p) => p.midi === pitch.midi);
              if (pitch.tieFromPrevious && previous && from >= 0)
                ties.push(
                  new StaveTie({
                    first_note: previous,
                    last_note: note,
                    first_indices: [from],
                    last_indices: [index],
                  })
                );
            });
            previous = event.rest ? null : note;
            previousPitches = pitches;
            return note;
          });
          const voice = new Voice({ num_beats: 4, beat_value: 4 })
            .setStrict(false)
            .addTickables(tickables);
          new Formatter().joinVoices([voice]).formatToStave([voice], stave);
          voice.draw(context, stave);
          ties.forEach((tie) => tie.setContext(context).draw());
          x += widths[i];
        });
        const svg = element.querySelector('svg');
        svg?.setAttribute('role', 'img');
        svg?.setAttribute(
          'aria-label',
          `${polyphonic ? 'Polyphonic guitar' : 'Guitar'} sheet music with note durations, rests and barlines. Sounds one octave below written pitch.`
        );
        element.dataset.scoreReady = 'ready';
      })
      .catch(() => {
        if (!cancelled) {
          setError('Sheet music could not load. Tablature is still available.');
          if (element) element.dataset.scoreReady = 'error';
        }
      });
    return () => {
      cancelled = true;
      element?.replaceChildren();
    };
  }, [notes, active, bpm, polyphonic]);
  return (
    <div className="loop-score-scroll">
      {error && <p role="alert">{error}</p>}
      <div ref={root} className="lf-engraved-score" />
    </div>
  );
}
