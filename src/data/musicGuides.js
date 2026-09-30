import { separatorGuides } from './stemSeparatorContent';

export const musicGuides = [
  {
    slug: 'how-to-separate-vocals-drums-bass',
    title: 'How to separate vocals, drums, and bass from a song',
    category: 'Stem separation',
    description:
      'Separate a song into vocals, drums, bass and other instruments with Sattari. Choose outputs, preview the results and download WAV stems in your browser.',
    answer:
      'Open Sattari Stem Separator, add an audio file, select the parts you need, and start separation. Preview each result, then download the WAV files or ZIP before leaving the page. Processing happens on your device.',
    image: '/images/tools/separator.jpg',
    imageAlt: 'Sattari Stem Separator with completed bass and drum stems from the original demo',
    action: { label: 'Open Stem Separator', path: '/stem-separator' },
    sections: [
      {
        title: 'Start with a usable source',
        paragraphs: [
          'Use a song you own or have permission to process. Choose a clean export from the original recording when possible. A heavily compressed, distorted or reverberant mix gives the separator less clear information to work with. Renaming a file extension does not convert its audio format.',
          'The picker accepts WAV, MP3, FLAC, M4A, AAC and OGG, but your browser must be able to decode the actual codec. If a file fails, export a PCM WAV from your audio software. Streaming-service links and protected downloads are not supported.',
        ],
      },
      {
        title: 'Choose the parts, then run the batch',
        steps: [
          'Add one file or several files. The queue allows 20 tracks, 100 MiB per file and 300 MiB of source files in total. Each track must be ten minutes or shorter.',
          'Select Vocals, Drums, Bass, Instruments, or All stems. Instruments means the remaining sounds such as guitar and keys; it does not include the bass or drums.',
          'Select Separate tracks. The first run downloads an approximately 172 MiB model. Keep the page open while tracks process one after another.',
          'Listen to each stem. Download individual 44.1 kHz WAV files, a track ZIP, or a ZIP of all completed tracks. Save results before navigating away.',
        ],
      },
      {
        title: 'Make a backing track without the vocal',
        paragraphs: [
          'Select Drums, Bass and Instruments. Import those three WAVs into separate Studio lanes and align their starts. Together they form an estimated non-vocal backing track. Downloading Instruments alone will omit the drum and bass parts.',
          'Choosing fewer outputs reduces the amount of result audio retained in memory. It does not make the underlying model compute only those instruments. If results fill the 512 MiB output budget, download and clear completed tracks before continuing.',
        ],
      },
      {
        title: 'Listen for the limitations',
        paragraphs: [
          'These are estimates extracted from a finished mix, not the original recording-session tracks. Listen for vocal leakage, softened drum attacks, missing harmonics and watery tails. Check important passages against the full song instead of assuming a soloed artifact was played by the musician.',
          'Desktop use is recommended. GPU acceleration is attempted where available, with a CPU fallback during initialization. CPU processing can be much slower than real time. No speed or perfect-isolation guarantee applies to every browser or track.',
        ],
      },
    ],
    related: [
      '/tools/stem-separator',
      '/guides/remove-vocals-for-karaoke',
      '/guides/batch-separate-audio-stems',
      '/guides/practice-bass-with-isolated-stems',
    ],
  },
  {
    slug: 'practice-bass-with-isolated-stems',
    title: 'How to practice bass using isolated stems',
    category: 'Practice',
    description:
      'Build a focused bass practice session from isolated stems: hear the line, match the rhythm, loop a phrase and play with a backing track without bass.',
    answer:
      'Separate the bass and drums, learn a short phrase by ear, and compare it with the full mix. Then mute the bass and play over the remaining stems. Use Studio to align the stems and build your practice backing track.',
    image: '/images/tools/studio.jpg',
    imageAlt: 'Sattari Studio with audio loaded across four decks',
    action: { label: 'Open Sattari Studio', path: '/studio' },
    sections: [
      {
        title: 'Prepare one musical phrase',
        paragraphs: [
          'Choose a recording you have permission to use. In Stem Separator, export all four parts. The Bass stem is your reference; Drums, Vocals and Instruments can become the backing track you play against. Start with a short, repeated phrase rather than the entire song.',
          'Listen to the bass in the full mix first, then in isolation. Count where notes begin and end. A convincing bass part depends on note length, rests and its relationship with the kick as much as the pitches.',
        ],
      },
      {
        title: 'A focused 15-minute session',
        steps: [
          'Minutes 0-3: listen and count. Clap or tap the bass rhythm without playing pitches. Identify the first beat of the phrase.',
          'Minutes 3-7: find the notes slowly by ear. Work on one or two bars. Compare each sustained note with the isolated bass, checking the octave as well as the note name.',
          'Minutes 7-11: play with bass and drums together. Match the starts, rests and releases. Repeat the phrase until those details are consistent.',
          'Minutes 11-15: mute the reference bass. Play against drums and the other stems, then listen back to the reference and note one thing to improve next time.',
        ],
      },
      {
        title: 'Build a backing track in Studio',
        paragraphs: [
          'Import the separated stems into Studio and align their starts. Keep the bass available as a reference, then mute it when you are ready to play the part yourself.',
          'Work on a short phrase you can repeat comfortably. Compare the isolated bass with the full mix: separation can soften attacks or leave sounds from other instruments.',
        ],
      },
      {
        title: 'Listen for timing and note length',
        paragraphs: [
          'Count the beat before playing. Listen for where each note starts, how long it lasts, and the silence before the next note. Repeat slowly until those details feel consistent.',
          'Record a short take with your preferred recorder and compare it with the reference. Choose one detail to improve on the next pass. Sattari Learn currently focuses on guided guitar practice; this bass workflow uses your ears and the isolated stems.',
        ],
      },
    ],
    related: [
      '/tools/learn',
      '/tools/studio',
      '/guides/find-song-key-and-bpm',
      '/guides/how-to-separate-vocals-drums-bass',
    ],
  },
  {
    slug: 'learn-guitar-from-a-song',
    title: 'How to learn a guitar song, one phrase at a time',
    category: 'Practice',
    description:
      'Pick a song in Sattari Learn, explore tabs and chord charts, and practice short phrases with visual guides and microphone feedback.',
    answer:
      'Choose a starter song or import your own audio or score. Review the guide, select a short passage, then enter focused practice. Hear the phrase, find the notes slowly, and build up to playing in time.',
    image: '/images/tools/learn-guitar.jpg',
    imageAlt: 'Sattari Learn song library and interactive guitar practice player',
    action: { label: 'Open Sattari Learn', path: '/learn' },
    sections: [
      {
        title: 'Start with a song and a playable guide',
        paragraphs: [
          'Start with the 12-step beginner path, which builds from one open string to a complete original song. The library also contains short authored classic arrangements. For your own music, import a local audio file or a Guitar Pro or MusicXML score. An uploaded recording produces estimates: listen to the source and correct uncertain notes or chords before beginning practice.',
          'Set your guitar tuning, capo and handedness. Explore the tablature, chord charts, notation and finger guides, then choose the passage you want to work on.',
        ],
      },
      {
        title: 'Make one phrase comfortable',
        steps: [
          'Choose Practice this song and follow the microphone setup, or explore without a microphone.',
          'Hear the phrase at a slower speed. Try the essentials version when the full set of notes feels too much.',
          'Find each note slowly, then try the rhythm in time. Use headphones so the reference audio does not confuse microphone feedback.',
          'Return to a difficult passage, try a suggested drill, or record a short take for comparison. The daily session gives you three focused exercises.',
        ],
      },
      {
        title: 'Use feedback alongside your ears',
        paragraphs: [
          'Microphone feedback works best with clear individual notes in a quiet room. Whole-chord checking is experimental, and a noisy recording or dense mix can produce mistaken estimates. Listen to the reference and use the visual guide together.',
          'Lessons, guitar settings, history and saved takes stay in this browser. Download a Learn backup from the song library to preserve lessons, progress, takes and videos. Restore the file on another device to add missing entries while keeping that device’s existing work. Clearing browser storage removes local saves.',
        ],
      },
    ],
    related: [
      '/tools/learn',
      '/guides/how-to-separate-vocals-drums-bass',
      '/services/music-lessons-los-angeles',
    ],
  },
  ...separatorGuides,
  {
    slug: 'instrument-repairs-near-encino',
    title: 'Where can I get instrument repairs near Encino?',
    category: 'Local services',
    description:
      'Ask Sattari Music in Woodland Hills about guitar, violin, drum and hardware repairs near Encino. What to bring, what to describe and how to request help.',
    answer:
      'Encino musicians can contact Sattari Music in Woodland Hills about instrument repairs, setups and troubleshooting. The shop is at 4881 Topanga Canyon Blvd #202, Woodland Hills, CA 91364. Call (424) 465-3020 to discuss the instrument and arrange a visit.',
    image: '/sattari site/sattari logo.png',
    imageAlt: 'Sattari Music',
    action: {
      label: 'Request a repair',
      path: '/services/instrument-repair-los-angeles#repair-inquiry',
    },
    sections: [
      {
        title: 'One Woodland Hills shop, serving nearby musicians',
        paragraphs: [
          'Sattari serves Woodland Hills, Encino, Calabasas and the wider Los Angeles area from its Woodland Hills address. There is not a separate Sattari storefront in Encino. Confirm visit arrangements and repair availability before traveling.',
          'Repair inquiries can cover guitars, violins, drums, percussion and musician hardware. Describe the specific instrument and problem so the team can confirm whether it is a suitable job. A repair request is not a promise that every instrument or replacement part can be serviced immediately.',
        ],
      },
      {
        title: 'What to include in your repair request',
        steps: [
          'Name the instrument, brand and model if known, and mention whether it is vintage, rare or particularly delicate.',
          'Describe the symptom: buzzing at certain frets, unstable tuning, a loose fitting, a pedal problem, or an intermittent output. Say when it began and what changed beforehand.',
          'Explain the result you want, such as comfortable action for your playing style, stable tuning for rehearsals, or hardware that stays secure.',
          'Include your deadline and preferred contact details. Ask about assessment, parts, price and turnaround before authorizing work.',
        ],
      },
      {
        title: 'Prepare for the visit',
        paragraphs: [
          'Bring the instrument in its case when available. Keep loose pieces together and explain where they came from. For an intermittent electronic problem, ask whether the relevant cable, pedal or power supply should come too so the fault can be reproduced.',
          'Do not force a stuck fitting, apply household glue, or keep tightening damaged hardware while waiting for advice. Mention previous repairs and any unusual tuning or string setup. Those details can change the assessment.',
        ],
      },
      {
        title: 'Cost, timing and other services',
        paragraphs: [
          'There is no fixed repair price or turnaround promised on this page. The work and any necessary parts depend on the instrument and its condition. Confirm the proposed work, estimate and expected completion with the shop.',
          'If an instrument needs to stay for repair, ask about rental availability rather than assuming a loaner is included. Sattari also accepts inquiries for lessons and studio or rehearsal time. Those are separate services with their own availability.',
        ],
      },
    ],
    related: ['/services/instrument-repair-los-angeles', '/visit', '/encino-music-store'],
  },
  {
    slug: 'choose-your-first-cymbals',
    title: 'How to choose your first cymbals',
    category: 'Buying guide',
    description:
      'Choose a useful first cymbal setup: hi-hats, crash and ride. Compare feel, volume, sustain and hardware before shopping Sattari cymbals.',
    answer:
      'Start with the sounds you will use most: hi-hats for timekeeping, a crash for accents and a ride for a sustained pulse. Compare them at your normal playing volume, and budget for stands and protective fittings as well as the cymbals.',
    image: '/sattari site/cymbal.png',
    imageAlt: 'Sattari cymbals',
    action: { label: 'Shop cymbals', path: '/shop/cymbals' },
    sections: [
      {
        title: 'Give each cymbal a job',
        paragraphs: [
          'Hi-hats are a pair played with sticks and a foot pedal. Listen for a clear closed sound, a controllable open sound and a useful foot chick. A crash emphasizes a phrase or transition. A ride should give you a pulse you can hear without the whole cymbal washing over every note.',
          'A crash-ride can combine two roles in a small setup, but try both roles before choosing it. Splash, China and other effects cymbals can wait until you know what your basic setup is missing.',
        ],
      },
      {
        title: 'Compare sound at the volume you actually play',
        paragraphs: [
          'Bring your usual sticks and play a simple groove on each option. Try quiet and louder strokes. Listen to the first attack, how long the sound hangs around, and whether the next hit stays distinct. A sound that is impressive alone may cover a singer or a quieter band.',
          'Diameter, weight, profile and manufacture all contribute to the result. Labels such as bright, dark, thin or heavy can help you shortlist, but they do not replace listening. Do not buy only by alloy name or assume a higher price makes a cymbal right for every style.',
        ],
      },
      {
        title: 'A practical comparison checklist',
        steps: [
          'Play a closed hi-hat groove, then gently open the hats and close them with your foot. Check control and definition.',
          'Play the ride bow and bell. Check whether the stick remains clear as you repeat the pattern.',
          'Play a crash accent at your normal strength and let it decay. Does it open up comfortably, or do you feel pushed to hit too hard?',
          'Compare the cymbals together. Decide which sound is essential now, and leave room in the budget for compatible stands, sleeves and felts.',
        ],
      },
      {
        title: 'Buying used and setting up',
        paragraphs: [
          'For a used cymbal, inspect the edge, bell and center hole for cracks, damage or unusual wear. Ask about repairs and listen in person when possible. A short phone recording is useful context, but microphone placement and processing can change how it sounds.',
          'Use the correct sleeve and felts so the cymbal is not resting directly on metal. Let it move instead of clamping it rigidly. Check the stand is stable and the cymbal is comfortably reachable. Ask a teacher or the shop to help with setup if you are unsure.',
          'Browse the current Sattari cymbal catalog, then ask the shop about the specific model, availability and your playing situation. Product prices and stock belong on the product pages, where they can be kept current.',
        ],
      },
    ],
    sources: [
      { label: 'SABIAN: beginner cymbal roles', url: 'https://sabian.com/beginners-hub/' },
      {
        label: 'Zildjian: cymbal stand setup',
        url: 'https://ae.zildjian.com/wp-content/uploads/Zildjian_Drum_Method_Lesson_11.pdf',
      },
    ],
    related: ['/shop/cymbals', '/services/music-lessons-los-angeles', '/visit'],
  },
];
