import { arrangement } from './authoredLesson.js';

// Original exercises. Musical targets and synthesized references share the same
// events. These are authored material, not a claim of human teacher review.
const steps = [
  [
    'One clear note',
    'Pluck the open high E string',
    [
      [64, 2],
      [64, 2],
      [64, 2],
      [64, 2],
    ],
    'Let the thinnest string ring. Relax your picking hand between notes.',
    'If it sounds muted, move your fretting hand clear of the string.',
    'No previous playing needed.',
  ],
  [
    'Find the first fret',
    'Move between open E and F',
    [
      [64, 2],
      [65, 2],
      [64, 2],
      [65, 2],
      [65, 2],
      [64, 2],
    ],
    'Place your index fingertip just behind fret 1 on the thinnest string. Use only enough pressure for a clear sound.',
    'Buzzing can mean your finger is too far from the fret. Reposition before pressing harder.',
    'One clear note',
  ],
  [
    'Three notes, one string',
    'Connect E, F and G',
    [[64], [65], [67, 2], [67], [65], [64, 2], [64], [65], [67, 2], [65], [64, 3]],
    'Use your index finger for fret 1 and ring finger for fret 3. Keep the unused fingers close to the strings.',
    'Slow down if your hand jumps away from the neck between notes.',
    'Find the first fret',
  ],
  [
    'A steady pulse',
    'Give repeated notes separate plucks',
    Array.from({ length: 16 }, () => [64]),
    'Count 1, 2, 3, 4. Give every beat a separate gentle pluck.',
    'A ringing note is not a new pluck. Make one distinct attack for each target.',
    'Three notes, one string',
  ],
  [
    'Cross one string',
    'Move between B and high E',
    [[59, 2], [64, 2], [59, 2], [64, 2], [59], [64], [59], [64], [64, 4]],
    'Find the two thinnest open strings. Look at your picking hand once, then listen to the difference.',
    'Keep the pick movement small so you do not catch the neighboring string.',
    'A steady pulse',
  ],
  [
    'A four-note walk',
    'Add C and D on the B string',
    [[59], [60], [62], [64], [64], [62], [60], [59], [59], [60], [62], [64], [62], [60], [59, 2]],
    'On the B string, use index for C at fret 1 and ring finger for D at fret 3. High E stays open.',
    'Check the string as well as the fret. The same fret on another string makes a different note.',
    'Cross one string',
  ],
  [
    'Space between notes',
    'Keep counting through a rest',
    [
      [64],
      [null],
      [65],
      [null],
      [67, 2],
      [null, 2],
      [67],
      [null],
      [65],
      [null],
      [64, 2],
      [null, 2],
    ],
    'Keep counting during the silent spaces. Let your picking hand return calmly before the next note.',
    'Do not rush into the next note to fill the silence. Note starts are checked; muting and note length are listening goals.',
    'A four-note walk',
  ],
  [
    'Long and short',
    'Hear quarter and half notes',
    [[64], [65], [67, 2], [67], [65], [64, 2], [59, 2], [62], [64], [62, 2], [59, 2]],
    'Count two beats for a half note and one for a quarter note. Listen once before playing.',
    'Let longer notes breathe. The app checks the next note start, so also compare your note lengths by ear.',
    'Space between notes',
  ],
  [
    'The Em shape, one string at a time',
    'Hear the notes inside E minor',
    [
      [40, 2],
      [47, 2],
      [52, 2],
      [55, 2],
      [59, 2],
      [64, 2],
      [59, 2],
      [55, 2],
    ],
    'Hold fret 2 on the A and D strings. Pick from the low E toward the high E, one string at a time.',
    'Curve your fingertips so the neighboring open strings can ring. Open Chord charts to practice the full shape.',
    'Cross one string',
  ],
  [
    'From Em to G',
    'Prepare a chord change slowly',
    [
      [40],
      [47],
      [52],
      [55],
      [43],
      [47],
      [50],
      [55],
      [40],
      [47],
      [52],
      [55],
      [43],
      [47],
      [50],
      [55],
    ],
    'Learn the Em and G diagrams first. This exercise picks four notes from each shape; use the chord workshop for all strings.',
    'Pause the rhythm and place the new shape if the change feels tense. Speed comes after a clean movement.',
    'The Em shape, one string at a time',
  ],
  [
    'First light · the opening',
    'Connect two musical phrases',
    [[64], [65], [67, 2], [64], [62], [60, 2], [59], [60], [62, 2], [60], [59], [60, 2]],
    'Treat each four-note group as one thought. Repeat the opening until the string changes feel familiar.',
    'Work on the transition between phrases as well as each phrase on its own.',
    'Long and short',
  ],
  [
    'First light',
    'Play a complete original 16-bar song',
    [
      [64],
      [65],
      [67, 2],
      [64],
      [62],
      [60, 2],
      [59],
      [60],
      [62, 2],
      [60],
      [59],
      [60, 2],
      [64],
      [65],
      [67, 2],
      [67],
      [65],
      [64, 2],
      [62],
      [60],
      [59, 2],
      [60, 4],
      [67],
      [67],
      [65, 2],
      [64],
      [62],
      [64, 2],
      [65],
      [64],
      [62, 2],
      [60],
      [59],
      [62, 2],
      [64],
      [65],
      [67, 2],
      [64],
      [62],
      [60, 2],
      [59],
      [60],
      [62, 2],
      [60, 4],
    ],
    'Learn the eight phrases, then connect them. Return to the opening when it comes back near the end.',
    'If one transition breaks the flow, use Teach me this part to isolate it before playing the whole song.',
    'First light · the opening',
  ],
];

export const FOUNDATION_LESSONS = steps.map(
  ([title, skill, melody, tip, mistake, prerequisite], index) => {
    const id = `foundations-${String(index + 1).padStart(2, '0')}`;
    const totalBeats = melody.reduce((n, pair) => n + (pair[1] ?? 1), 0);
    const phraseStarts = [];
    let beats = 0,
      notes = 0;
    for (const [midi, duration = 1] of melody) {
      if (midi != null) {
        if (!phraseStarts.length || beats % 8 === 0) phraseStarts.push(notes);
        notes++;
      }
      beats += duration;
    }
    const harmony =
      index < 8
        ? []
        : index === 8
          ? [['Em', 0, totalBeats]]
          : index === 9
            ? [
                ['Em', 0, 4],
                ['G', 4, 8],
                ['Em', 8, 12],
                ['G', 12, 16],
              ]
            : Array.from({ length: Math.ceil(totalBeats / 8) }, (_, i) => [
                i % 2 ? 'G' : 'C',
                i * 8,
                Math.min(totalBeats, (i + 1) * 8),
              ]);
    return arrangement({
      id,
      title,
      skill,
      melody,
      harmony,
      phraseStarts,
      artist: index === 11 ? 'Sattari original song' : 'Sattari original exercise',
      bpm: index < 4 ? 64 : 76,
      key: index === 8 ? 'E minor' : index === 9 ? 'G major' : 'C major',
      color: ['peach', 'sage', 'lavender'][index % 3],
      motif: 'sun',
      difficulty: 'First steps',
      category: 'foundations',
      completeSong: index === 11,
      description: skill + '.',
      teaching: { step: index + 1, prerequisite, tip, mistake, minutes: index === 11 ? 10 : 3 },
    });
  }
);
