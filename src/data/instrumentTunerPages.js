const instruments = [
  {
    slug: 'guitar',
    name: 'Guitar',
    title: 'Online Guitar Tuner for Acoustic, Electric & Drop D',
    description:
      'Tune acoustic, electric or classical guitar by microphone or by ear. Hear low E and high E, switch from standard tuning to drop D, and check each open string.',
    intro:
      'For a six-string acoustic, electric or classical guitar, tap an open string to hear it ring. To check your own pitch, start the microphone, select the string and pluck it once.',
    presets: ['guitar', 'drop-d', 'chromatic'],
    root: 'E',
    octave: 2,
    tips: [
      [
        'Which E string am I tuning?',
        'In standard tuning the strings run E2, A2, D3, G3, B3 and E4 from thickest to thinnest. The two E strings are two octaves apart. Select Low E for the thickest string or High E for the thinnest and compare the octave as well as the note name.',
      ],
      [
        'Switching to drop D',
        'Select Guitar · drop D and lower only the sixth string from E2 to D2. Leave the other five strings at A2, D3, G3, B3 and E4. Pluck the open sixth and fourth strings in turn to hear the two Ds an octave apart.',
      ],
    ],
    links: [
      [
        'Guitar string replacement in Woodland Hills',
        '/services/guitar-restringing-woodland-hills',
      ],
      ['When does my guitar need a setup?', '/guides/when-does-my-guitar-need-a-setup'],
    ],
  },
  {
    slug: 'violin',
    name: 'Violin',
    title: 'Online Violin Tuner for G, D, A & E Strings',
    description:
      'Tune violin or fiddle to G3, D4, A4 and E5. Play a continuous reference pitch, check an open string with your microphone, or match an ensemble’s concert A.',
    intro:
      'Check each open violin or fiddle string with a steady bow stroke. Start the microphone to see the pitch, or tap G, D, A or E to hear a continuous reference.',
    presets: ['violin', 'chromatic'],
    root: 'G',
    octave: 3,
    tips: [
      [
        'Starting with the orchestra’s A',
        'The open A string is A4. If your ensemble uses A4 at 442 Hz, choose 442 Hz under Concert A before you match it. The other three reference pitches move with it. Violin strings run G3, D4, A4 and E5 from lowest to highest.',
      ],
      [
        'Getting a steady reading on the E string',
        'Bow the E string alone with an even stroke and no vibrato. Read the center of the sustained note after the bow attack. If D or A rings along, stop the other strings and try again. Use a fine tuner for small corrections if your violin has one.',
      ],
    ],
    links: [
      ['Violin restringing in Woodland Hills', '/services/violin-restringing-woodland-hills'],
      ['Beginner violin care', '/guides/beginner-violin-care'],
    ],
  },
  {
    slug: 'viola',
    name: 'Viola',
    title: 'Online Viola Tuner for C, G, D & A Strings',
    description:
      'Tune a viola to C3, G3, D4 and A4. Hear the low C, match an ensemble’s A, check cents with the microphone and practice a scale from the open C.',
    intro:
      'Tap a viola string to hear its reference pitch, or start the microphone and bow one open string at a time. The lowest string is C3 and the highest is A4.',
    presets: ['viola', 'chromatic'],
    root: 'C',
    octave: 3,
    tips: [
      [
        'Finding the low C on viola',
        'The four open strings are C3, G3, D4 and A4, a fifth apart. If you also play violin, G, D and A sound at the same pitches on both instruments. On viola, the extra lower string is C3, one octave below middle C.',
      ],
      [
        'Checking your C major scale',
        'After the open strings settle, play the C major reference in the scale panel. The first note is your open C3 and the last is C4, which you can play on the G string. To measure individual stopped notes, select Chromatic and sound them separately with the microphone on.',
      ],
    ],
    links: [
      ['Compare violin tuning', '/tuner/violin'],
      ['Compare cello tuning', '/tuner/cello'],
    ],
  },
  {
    slug: 'cello',
    name: 'Cello',
    title: 'Online Cello Tuner for C, G, D & A Strings',
    description:
      'Hear cello open strings C2, G2, D3 and A3 or tune by microphone. Check your lowest string, match concert pitch and practice a scale from the cello’s low C.',
    intro:
      'Tap an open string for a cello reference tone or bow the string into your microphone. Select the string you intend to tune and look for a steady reading near zero cents.',
    presets: ['cello', 'chromatic'],
    root: 'C',
    octave: 2,
    tips: [
      [
        'Checking the cello’s open A',
        'Cello strings run C2, G2, D3 and A3 from lowest to highest. With Concert A set to 440 Hz, the cello’s open A is 220 Hz. A violin or viola open A sounds an octave higher. Tap A3 to hear the cello pitch before you adjust the string.',
      ],
      [
        'Hearing the lowest string clearly',
        'A bowed C2 has upper harmonics that can stand out on a small speaker. Headphones can make the low reference easier to compare. For microphone tuning, damp the unused strings and sustain the middle of a bow stroke so the tuner can follow one pitch.',
      ],
    ],
    links: [
      ['Compare viola tuning', '/tuner/viola'],
      ['Explore all instrument tunings', '/studio/keybpm#live-tuner'],
    ],
  },
  {
    slug: 'bass',
    name: 'Bass',
    title: 'Online Bass Tuner for 4-String & 5-String Bass',
    description:
      'Tune four-string bass to E1, A1, D2 and G2, or add the low B0 on a five-string bass. Hear each reference note and measure the pitch using your microphone.',
    intro:
      'Choose your bass tuning, then tap a string to hear its pitch. For a microphone reading, mute the other strings, pluck once and let the note ring past the first attack.',
    presets: ['bass', 'bass-five', 'chromatic'],
    root: 'E',
    octave: 1,
    tips: [
      [
        'Four-string and five-string bass tuning',
        'A standard four-string bass uses E1, A1, D2 and G2. A five-string bass with a low B adds B0 below E1. Choose Bass · five strings to see that extra reference. If your five-string uses a high C, use Chromatic to check C3.',
      ],
      [
        'Octaves on bass',
        'At concert A440 the bass low E is about 41.2 Hz, one octave below the guitar’s low E. To hear the difference on your instrument, play the open E and then the note at the twelfth fret. Use the open note when checking the E1 target.',
      ],
    ],
    links: [
      ['Practice bass with isolated stems', '/guides/practice-bass-with-isolated-stems'],
      ['Compare six-string guitar tuning', '/tuner/guitar'],
    ],
  },
  {
    slug: 'ukulele',
    name: 'Ukulele',
    title: 'Online Ukulele Tuner for High-G GCEA Tuning',
    description:
      'Tune a high-G ukulele to G4, C4, E4 and A4 by ear or microphone. Learn which G to use for your strings and check a low-G ukulele in chromatic mode.',
    intro:
      'Tap G, C, E or A to hear a high-G ukulele reference. Start the microphone to compare a plucked open string, or switch to Chromatic for a different ukulele tuning.',
    presets: ['ukulele', 'chromatic'],
    root: 'C',
    octave: 4,
    tips: [
      [
        'Why the G string sounds higher than C',
        'On a high-G ukulele, strings four through one are G4, C4, E4 and A4. C4 is middle C and the lowest of these four notes. This string order is called reentrant tuning and is common on soprano, concert and tenor ukuleles.',
      ],
      [
        'Does my ukulele use low G or baritone tuning?',
        'A low-G set uses G3 in place of G4, while the other three strings stay at C4, E4 and A4. A baritone set in standard tuning uses D3, G3, B3 and E4. Check the tuning specified for your strings, then use Chromatic to read those pitches.',
      ],
    ],
    links: [
      ['Explore all tunings and scales', '/studio/keybpm#live-tuner'],
      ['Explore Sattari music tools', '/hub'],
    ],
  },
];

export const instrumentTunerPages = instruments.map((instrument) => ({
  ...instrument,
  path: `/tuner/${instrument.slug}`,
  heading: `Online ${instrument.name.toLowerCase()} tuner`,
}));

export const getInstrumentTunerPage = (slug) =>
  instrumentTunerPages.find((page) => page.slug === slug);
