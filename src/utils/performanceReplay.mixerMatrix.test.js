import { expect, it } from 'vitest';
import { reconstructPerformance } from './performanceReplay';
import { mixAutomation } from './replayMix';
import { audioClip, audioTrack, emptyArrangement, validateArrangement } from './arrangementModel';

// Independent numeric contract oracle, not rendered PCM qualification.
const taper = (percent) => (percent > 100 ? percent / 100 : (percent / 100) ** 1.35);
const sideGain = (curve, position, side) => {
  if (curve === 'Linear') return side === 'left' ? 1 - position : position;
  const angle = (position * Math.PI) / 2;
  return (side === 'left' ? Math.cos(angle) : Math.sin(angle)) ** (curve === 'Sharp' ? 0.32 : 1);
};

it.each(['Smooth', 'Linear', 'Sharp'])(
  '%s mixer family retains audible timing, gain and original print across serialization',
  (curve) => {
    const initial = {
      crossfader: 25,
      crossfaderCurve: curve,
      decks: [
        {
          id: 'A',
          playing: true,
          position: 0,
          gain: 150,
          fader: 80,
          side: 'left',
          lanes: { vocals: { assetId: 'dry', duration: 8, level: 100 } },
        },
      ],
    };
    const controls = [
      { time: 0.8, scheduledTime: 1, type: 'setDeckGain', args: ['A', 50] },
      { time: 1.8, scheduledTime: 2, type: 'setDeckFader', args: ['A', 200] },
      { time: 2.8, scheduledTime: 3, type: 'setCrossfader', args: [75] },
      { time: 3.8, scheduledTime: 4, type: 'setDeckSide', args: ['A', 'right'] },
      { time: 4.8, scheduledTime: 5, type: 'setCrossfaderCurve', args: ['Linear'] },
    ];
    const take = {
      id: 'take',
      assetId: 'safety',
      duration: 6,
      timelineStart: 10,
      events: [{ time: 0, type: 'initialState', args: [initial] }, ...controls],
    };
    const project = emptyArrangement();
    const print = audioTrack('Original safety print');
    print.clips = [audioClip('safety', 'Safety', 6, 10)];
    project.tracks = [print];
    project.captures = [take];
    const saved = JSON.stringify({ project, take });
    const reopened = JSON.parse(saved);
    const result = reconstructPerformance(reopened.project, reopened.take);
    const compile = mixAutomation(initial);
    const expected = [
      taper(50) * taper(80) * sideGain(curve, 0.25, 'left'),
      taper(50) * 2 * sideGain(curve, 0.25, 'left'),
      taper(50) * 2 * sideGain(curve, 0.75, 'left'),
      taper(50) * 2 * sideGain(curve, 0.75, 'right'),
      taper(50) * 2 * 0.75,
    ];
    const lane = result.tracks[0];
    controls.forEach((event, index) => {
      const ramp = compile(event);
      expect(ramp).toHaveLength(1);
      expect(ramp[0]).toMatchObject({ target: 'deck', deckId: 'A' });
      expect(ramp[0].value).toBeCloseTo(expected[index], 12);
      const point = lane.automation.volume.find((p) => p.time === 10 + event.scheduledTime + 0.025);
      if (index > 0 && expected[index] === expected[index - 1]) {
        // An unchanged Linear-to-Linear curve does not add a redundant ramp.
        expect(point).toBeUndefined();
      } else {
        expect(point).toBeDefined();
        // Reconstruction expresses combined gain against its 81x headroom basis.
        expect((point.value * 81) / 100).toBeCloseTo(expected[index], 12);
      }
    });
    expect(lane.clips).toHaveLength(1);
    expect(lane.clips[0]).toMatchObject({ assetId: 'dry', start: 10, duration: 6, offset: 0 });
    expect(lane.muted).toBe(true); // Never replace the audible authoritative print.
    expect(result.project.tracks[0]).toEqual(print);
    expect(result.project.captures).toEqual([take]);
    expect(JSON.stringify(reopened)).toBe(saved);
    expect(JSON.stringify({ project, take })).toBe(saved);
    const portable = JSON.parse(JSON.stringify(result.project));
    expect(() => validateArrangement(portable)).not.toThrow();
    expect(portable.tracks[1].automation.volume).toEqual(lane.automation.volume);
    expect(portable.captures[0].events).toEqual(take.events);
    expect(result.support.qualified).toBe(false);
    expect(result.support.rows.map((row) => row.id)).toEqual(['mixer']);
  }
);
