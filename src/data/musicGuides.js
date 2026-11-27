import { bowedInstrumentGuides } from './bowedInstrumentGuides.js';
import { guitarInstrumentGuides } from './guitarInstrumentGuides.js';
import { instrumentHistoryGuides } from './instrumentHistoryGuides.js';
import {
  acousticStringChangeGuide,
  electricStringChangeGuide,
} from './guitarStringChangeGuides.js';
import { bassStringChangeGuide } from './bassStringChangeGuide.js';
import { classicalStringChangeGuide } from './classicalStringChangeGuide.js';
import { celloStringChangeGuide } from './celloStringChangeGuide.js';
import { ukuleleStringChangeGuide } from './ukuleleStringChangeGuide.js';
import { persianTarStringChangeGuide } from './persianTarStringChangeGuide.js';
import { setarStringChangeGuide } from './setarStringChangeGuide.js';
import { oudStringChangeGuide } from './oudStringChangeGuide.js';
import { violaStringChangeGuide } from './violaStringChangeGuide.js';
import { snareTuningGuide } from './snareTuningGuide.js';
import { violinStringChangeGuide } from './violinStringChangeGuide.js';
import { practicePadGuide } from './practicePadGuide.js';
import { separatorGuides } from './stemSeparatorContent.js';

const practiceGuides = [
  {
    slug: 'how-to-separate-vocals-drums-bass',
    title: 'How to separate vocals, drums & bass from a song',
    category: 'Stem separation',
    description:
      'Separate a song into vocals, drums, bass and other instruments with Sattari. Choose outputs, preview the results and download WAV stems in your browser.',
    answer:
      'Open Sattari Stem Separator, add an audio file, select the parts you need, and start separation. Play the parts together, mute or solo any of them, then download individual WAVs, a ZIP or your own mix. Processing happens on your device.',
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
      'Make a bassless practice track on your device: solo the bass to learn the line, loop a phrase, then download vocals + drums + other instruments as one WAV.',
    answer:
      'In Sattari Stem Separator choose Bass practice and separate the song. Solo the Bass lane to learn a phrase by ear, loop it with Set A and Set B, then press Download my mix for one bassless WAV of vocals, drums and other instruments to play along with.',
    image: '/images/tools/studio.jpg',
    imageAlt: 'Sattari Studio with audio loaded across four decks',
    action: { label: 'Make a bass practice track', path: '/stem-separator?goal=bass-practice' },
    sections: [
      {
        title: 'Prepare one musical phrase',
        link: { path: '/tuner/bass', label: 'Tune your bass before matching the recording' },
        paragraphs: [
          'Choose a recording you have permission to use. In Stem Separator, choose Bass practice and separate it. The Bass stem is your reference; Vocals, Drums and Other instruments become the backing track you play against. Start with a short, repeated phrase rather than the entire song.',
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
        title: 'Make the bassless track',
        steps: [
          'In the Stem Separator player, Bass is muted by the Bass practice choice. Press the headphones button on Bass, or choose Solo a part, to hear the line alone; press it again to return.',
          'Loop the phrase: Set A where it starts, Set B where it ends. Every part stays on the same clock while looping, muting or changing levels.',
          'Press Download my mix. You get one full-length WAV of vocals + drums + other instruments, named like song-bassless-mix.wav, rendered at the levels you set. Check key & BPM of this mix if you need the key to play in.',
          'Want more control? Open in Songboard sends the song and all four stems to the Songboard decks in the same tab.',
          'Compare the isolated bass with the full mix: separation can soften attacks or leave sounds from other instruments.',
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
      '/tools/stem-separator',
      '/tools/studio',
      '/product/five-string-bass-guitar',
      '/guides/find-song-key-and-bpm',
      '/guides/how-to-separate-vocals-drums-bass',
    ],
  },
  {
    slug: 'how-to-tune-an-instrument',
    title: 'How to tune a guitar, bass, ukulele or violin',
    linkLabel: 'How to tune your instrument',
    category: 'Tuning',
    description:
      'Standard tunings with note names and frequencies for guitar, bass, ukulele, violin, viola and cello, plus how to tune with a tuner or by ear and stay in tune.',
    answer:
      'Tune each open string to its standard note, one string at a time, using a clip-on tuner or a tuner app. Start below the note and tighten up to it, then go round every string a second time. Standard guitar tuning is E A D G B E from the thickest string to the thinnest, with the A above middle C set to 440 Hz.',
    image: '/images/guides/standard-guitar-tuning.jpg',
    imageAlt:
      'Standard guitar tuning from the thickest string: E2 82.41 Hz, A2 110 Hz, D3 146.83 Hz, G3 196 Hz, B3 246.94 Hz, E4 329.63 Hz',
    action: { label: 'Open the live instrument tuner', path: '/studio/keybpm#live-tuner' },
    sections: [
      {
        title: 'What in tune means',
        paragraphs: [
          'Almost all modern music is tuned to the same reference: the A above middle C (A4) vibrates 440 times a second, written A = 440 Hz. Every other note is measured from it. A tuner listens to your string, names the nearest note, and shows how far away you are in cents. A cent is one hundredth of a semitone, so 50 cents is halfway to the next note. Within about 3 cents is close enough for almost any playing.',
          'Flat means too low: tighten the string. Sharp means too high: loosen it. The note name matters as much as the needle. A tuner showing a perfectly centred D sharp when you wanted E is telling you the string is a full semitone low, not that it is in tune.',
        ],
      },
      {
        title: 'Standard tunings and their frequencies',
        paragraphs: [
          'Strings are listed in the order they sit on the instrument, from the lowest-pitched side. The number after each note is its octave: E2 is the low E of a guitar, E4 the high one. Frequencies assume A4 = 440 Hz.',
        ],
        table: {
          headers: ['Instrument', 'Open strings', 'Frequencies (Hz)'],
          rows: [
            [
              'Guitar (6-string)',
              'E2  A2  D3  G3  B3  E4',
              '82.41 · 110.00 · 146.83 · 196.00 · 246.94 · 329.63',
            ],
            ['Bass (4-string)', 'E1  A1  D2  G2', '41.20 · 55.00 · 73.42 · 98.00'],
            [
              'Ukulele (soprano, concert, tenor)',
              'G4  C4  E4  A4',
              '392.00 · 261.63 · 329.63 · 440.00',
            ],
            ['Violin', 'G3  D4  A4  E5', '196.00 · 293.66 · 440.00 · 659.26'],
            ['Viola', 'C3  G3  D4  A4', '130.81 · 196.00 · 293.66 · 440.00'],
            ['Cello', 'C2  G2  D3  A3', '65.41 · 98.00 · 146.83 · 220.00'],
            ['Mandolin (pairs)', 'G3  D4  A4  E5', '196.00 · 293.66 · 440.00 · 659.26'],
          ],
        },
        after: [
          'The ukulele looks out of order because it is: the G string nearest your face is tuned higher than the C next to it. This is called re-entrant tuning and it is what gives the ukulele its bright strum. A bass is tuned like the lowest four guitar strings, one octave down. A mandolin has the same notes as a violin, with each string doubled.',
        ],
      },
      {
        title: 'Tune with a tuner, step by step',
        steps: [
          'Clip the tuner to the headstock, or put a tuner app close to the instrument in a quiet room. If the tuner has modes, choose chromatic, or the mode named for your instrument.',
          'Check the reference pitch reads 440 Hz. Some tuners can be nudged to 432 or 442 by accident, and everything you tune will then be slightly off against other players and recordings.',
          'Pluck one open string and let it ring. Pluck at normal playing strength: a hard pluck starts sharp and then settles.',
          'Read the note name first. If it is the wrong note, turn the peg until the right letter appears before you worry about the needle.',
          'If the string is sharp, loosen it to below the note and come back up. Finishing on a tightening turn takes the slack out of the gear and the string, so it holds better.',
          'Repeat for every string, then go round all of them a second time. Tightening one string changes the tension on the neck and bridge and pulls the others slightly flat.',
          'Play a chord or two notes you know. Your ear is the final check.',
        ],
      },
      {
        title: 'Tune by ear from one reference note',
        paragraphs: [
          'You only need one correct note, from a piano, a tuning fork, a tone on your phone or another instrument. Tune one string to it and tune the rest from that string.',
          'On a guitar, press the low E string at the 5th fret. That note is A and should match the open A string next to it. Do the same from A to D and from D to G. From G to B use the 4th fret, then go back to the 5th fret from B to the high E. On a bass every pair uses the 5th fret.',
          'Listen for beats. When two notes are close but not the same, the sound wobbles in volume: wah, wah, wah. The wobble slows down as the notes get closer and disappears when they match. Turning the peg while listening for the wobble to stop is more precise than trying to judge higher or lower.',
          'Violins, violas and cellos are tuned in fifths. Tune the A string to the reference, then bow A and D together and adjust D until the two-note sound is steady and open, with no wobble. Continue with D and G, then A and E.',
        ],
      },
      {
        title: 'What is different on each instrument',
        paragraphs: [
          'Guitar and bass: the machine heads hold their position, so small turns are enough. On most guitars, turning the peg so the string winds tighter raises the pitch; watch the string, not the peg. If the open strings are in tune but chords higher up the neck sound sour, the problem is intonation, not tuning, and it is adjusted at the bridge during a setup.',
          'Ukulele: nylon-type strings stretch a great deal when new. Expect to retune many times in the first few days. This is normal and not a fault.',
          'Violin, viola and cello: the wooden pegs are held only by friction. Push the peg gently inward as you turn it so it grips. Use the pegs for large changes and the fine tuners on the tailpiece for small ones. Tune up to the note in small steps, because a string tightened far above pitch can snap. Check now and then that the bridge still stands straight; tuning slowly pulls its top toward the fingerboard.',
          'Drums are tuned by evening out the tension around the head, not to a fixed note. That has its own guide.',
        ],
      },
      {
        title: 'Why an instrument will not stay in tune',
        paragraphs: [
          'New strings are the most common reason. They keep stretching for the first few hours of playing. After fitting them, tune up, pull each string gently away from the fingerboard along its length, and retune. Two or three rounds settles most of the stretch.',
          'Old strings are the second. Worn, corroded strings stop vibrating evenly, so they sound dull and will not tune true at any fret. Changes in temperature and humidity move wood and metal: an instrument carried from a cold car into a warm room will drift until it settles.',
          'If one string goes out again and again, look for a mechanical cause. On a guitar, a string that pings while you tune is sticking in its slot at the nut. Strings wound loosely around the post slip. On a violin, pegs slip when the air is dry or the peg no longer fits its hole. A shop can fix all of these, usually quickly.',
        ],
      },
      {
        title: 'Common alternate guitar tunings',
        paragraphs: [
          'Once standard tuning is comfortable, a few alternatives come up often in songs. A recording that sounds slightly lower than your guitar is frequently in one of the first two.',
        ],
        table: {
          headers: ['Tuning', 'Strings, low to high', 'What changes'],
          rows: [
            ['Standard', 'E  A  D  G  B  E', 'The reference for chord charts and tabs'],
            ['Half step down', 'E♭  A♭  D♭  G♭  B♭  E♭', 'Every string one fret lower'],
            ['Drop D', 'D  A  D  G  B  E', 'Only the lowest string, down a whole step'],
            ['D standard', 'D  G  C  F  A  D', 'Every string two frets lower'],
            ['DADGAD', 'D  A  D  G  A  D', 'Strings 6, 2 and 1 down a whole step'],
            ['Open G', 'D  G  D  G  B  D', 'Strings 6, 5 and 1 down a whole step'],
            ['Open D', 'D  A  D  F♯  A  D', 'Strums a D major chord with no fingers'],
          ],
        },
      },
    ],
    related: [
      '/guides/how-to-find-the-key-of-a-song',
      '/guides/how-to-tune-a-snare-drum',
      '/guides/when-does-my-guitar-need-a-setup',
      '/guides/beginner-violin-care',
      '/services/instrument-repair-los-angeles',
    ],
  },
  {
    slug: 'how-to-find-the-key-of-a-song',
    title: 'How to find the key of a song by ear, from chords or with software',
    linkLabel: 'How to find the key of a song',
    category: 'Music theory',
    description:
      'Find the key of any song: hum the home note, decide major or minor, confirm it with the chords or the key signature, and check a software estimate by ear.',
    answer:
      'Find the note the song comes home to: hum along and hold the note that sounds finished, usually the last note of the chorus. Match it on an instrument. That note is the tonic. Then decide whether the song is major or minor by testing the note three or four frets above it. The tonic plus major or minor is the key.',
    image: '/images/tools/key-bpm.jpg',
    imageAlt: 'Sattari Key & BPM showing C major, Camelot 8B and 120 BPM for a demo track',
    action: { label: 'Estimate the key with Key & BPM', path: '/studio/keybpm' },
    sections: [
      {
        title: 'What a key actually is',
        paragraphs: [
          'A key is two things: a home note, called the tonic, and the scale of seven notes built on it. In the key of G major, G is home and the notes are G A B C D E F♯. The melody and chords wander away from G and return to it, and the return is what makes a phrase sound finished.',
          'So finding the key is two questions. Which note is home? And is the scale built on it major or minor? Everything below is a way of answering one of those two.',
        ],
      },
      {
        title: 'Find the home note by ear',
        steps: [
          'Play the song and hum or sing along with the chorus. You do not need to sing well.',
          'Stop the music at the end of a section and hold the note that feels like the natural place to land. If the note you are holding feels like it wants to move somewhere else, slide to where it wants to go.',
          'Keep humming that note and find it on a guitar, a keyboard or a piano app. Move one fret or key at a time until the instrument and your voice match.',
          'Test it. Play that note low and let it ring while the song plays. If it sits comfortably under most of the song, especially the last chord, you have the tonic. If it clashes at the points where the song sounds most settled, try the note a fourth or fifth away, which are the most common wrong guesses.',
        ],
        after: [
          'The last chord of a song is the tonic chord most of the time, and the first chord often is. Neither is a rule. Plenty of songs start away from home, and some never land on it at all.',
        ],
      },
      {
        title: 'Decide whether it is major or minor',
        paragraphs: [
          'From the tonic, play the note four frets (four semitones) higher along with the song. Then try the note three frets higher. Only one of them will fit. If four fits, the key is major. If three fits, it is minor. That note is called the third, and it is the whole difference between a major and a minor key.',
          'Do not judge by mood alone. Sad songs are written in major keys and upbeat songs in minor keys all the time.',
          'Every major key has a relative minor that uses exactly the same seven notes, starting three semitones lower: C major and A minor, G major and E minor, and so on. This is the most common way to get a key wrong, for people and for software. The notes cannot tell them apart. Only the home note can. If the song rests on C, it is C major; if it rests on A, it is A minor.',
        ],
      },
      {
        title: 'Work it out from the chords',
        paragraphs: [
          'If you have the chords from a chart or by ear, the key is the one scale that contains them all. In any major key, the chords built on the first, fourth and fifth notes are major, the ones on the second, third and sixth are minor. Three major chords two and a half and three and a half steps apart, like G, C and D, point straight to one key.',
        ],
        table: {
          headers: ['Key', 'I', 'IV', 'V', 'vi', 'Relative minor'],
          rows: [
            ['C major', 'C', 'F', 'G', 'Am', 'A minor'],
            ['G major', 'G', 'C', 'D', 'Em', 'E minor'],
            ['D major', 'D', 'G', 'A', 'Bm', 'B minor'],
            ['A major', 'A', 'D', 'E', 'F♯m', 'F♯ minor'],
            ['E major', 'E', 'A', 'B', 'C♯m', 'C♯ minor'],
            ['F major', 'F', 'B♭', 'C', 'Dm', 'D minor'],
            ['B♭ major', 'B♭', 'E♭', 'F', 'Gm', 'G minor'],
          ],
        },
        after: [
          'A song using G, C, D and Em is in G major or E minor. Which one depends on where it rests. If you are reading chords from a guitar chart with a capo, the real key is higher than the chord shapes by one semitone per fret of capo: G shapes with a capo on the 2nd fret sound in A.',
        ],
      },
      {
        title: 'Read it from the key signature',
        paragraphs: [
          'Sheet music states the key at the start of every line as a group of sharps or flats. Each signature belongs to one major key and its relative minor. With sharps, the major key is one semitone above the last sharp. With flats, the major key is the second-to-last flat. One flat is F major.',
        ],
        table: {
          headers: ['Signature', 'Major key', 'Minor key'],
          rows: [
            ['No sharps or flats', 'C major', 'A minor'],
            ['1 sharp', 'G major', 'E minor'],
            ['2 sharps', 'D major', 'B minor'],
            ['3 sharps', 'A major', 'F♯ minor'],
            ['4 sharps', 'E major', 'C♯ minor'],
            ['5 sharps', 'B major', 'G♯ minor'],
            ['6 sharps', 'F♯ major', 'D♯ minor'],
            ['1 flat', 'F major', 'D minor'],
            ['2 flats', 'B♭ major', 'G minor'],
            ['3 flats', 'E♭ major', 'C minor'],
            ['4 flats', 'A♭ major', 'F minor'],
            ['5 flats', 'D♭ major', 'B♭ minor'],
            ['6 flats', 'G♭ major', 'E♭ minor'],
          ],
        },
        after: [
          'To choose between the major and the minor, look at the last note or chord of the piece, and look for a raised seventh: a minor-key piece often sharpens the note just below its tonic, such as G♯ appearing throughout a piece with no sharps in the signature, which points to A minor.',
        ],
      },
      {
        title: 'Use software, then check it',
        paragraphs: [
          'Key detection software measures how much of each of the twelve notes is in the recording and compares that to the pattern of each key. It is fast and works on songs you cannot play yet. It is also guessing, in the same places people do: it confuses a key with its relative major or minor, and with the keys a fifth above or below.',
          'Sattari Key & BPM reports one key for the whole track, a second choice when the result was close, and a label saying whether the evidence was strong or tentative. Treat a tentative result as two candidates to test, not as an answer.',
          'The test is the drone. Play the song and hold the suggested tonic underneath it. The right key sounds settled against that note through most of the song. The wrong one rubs. Key & BPM can play the drone for the detected key and for the second choice so you can compare them directly.',
        ],
      },
      {
        title: 'When there is no single answer',
        paragraphs: [
          'Some songs change key, often lifting a step for the final chorus. Find the key of each section separately. Software that reports one key per track will pick whichever section dominates.',
          'Some songs use a mode: the notes of a major scale but with a different home note. A song with the notes of C major that rests on D is in D Dorian, and one that rests on G is in G Mixolydian. Tools will usually name the related major or minor key, which gives you the right notes but the wrong home.',
          'Some recordings are not at standard pitch. Guitars tuned a half step down, tape that ran slightly fast, or deliberate pitch shifting can leave a song between two keys. If every note you try is a little off, tune your instrument to the recording, or accept the nearest key.',
          'Songs also borrow chords from outside the key for colour. One or two outside chords do not change the key. The home note still decides.',
        ],
      },
    ],
    related: [
      '/keys',
      '/guides/find-song-key-and-bpm',
      '/guides/how-to-tune-an-instrument',
      '/tools/key-bpm',
      '/bpm',
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
      '/product/classic-nylon-string-guitar',
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
    related: [
      '/shop/cymbals',
      '/product/sattari-effect-cymbal',
      '/services/music-lessons-los-angeles',
      '/visit',
    ],
  },
  {
    slug: 'when-does-my-guitar-need-a-setup',
    title: 'When does a guitar need a professional setup?',
    category: 'Guitar care',
    description:
      'Notice fret buzz, uncomfortable action or notes that sound out of tune? Learn what to check, how restringing differs from a setup, and what to tell the shop.',
    answer:
      'A setup assessment is useful when your guitar has become uncomfortable to play, buzzes during your usual playing, or sounds out of tune higher on the neck. Describe what changed before choosing an adjustment: worn strings, playing technique, humidity and damage can cause similar symptoms.',
    image: '/sattari site/guitars/steel-acoustic.jpg',
    imageAlt: 'Steel string acoustic guitar on a stand',
    action: {
      label: 'Request a guitar setup',
      path: '/services/guitar-setup-los-angeles',
    },
    sections: [
      {
        title: 'Describe the symptom before diagnosing it',
        paragraphs: [
          'For buzz, note the string, fret and playing strength. Is it present on an open string, one fretted note or several? On an electric guitar, say whether it is audible through a clean amplifier as well as unplugged. A short recording can help explain an intermittent problem.',
          'For uncomfortable action, describe where fretting feels difficult: near the nut, around the middle of the neck or higher up. Mention a recent string-gauge or tuning change. Very low action can trade easier fretting for less room to strike the string strongly.',
          'For tuning concerns, separate a string that drifts after tuning from a fretted note that sounds sharp or flat. Old strings, excessive fretting pressure and the instrument’s setup can all affect the comparison; a tuner reading alone does not identify the repair.',
        ],
      },
      {
        title: 'Restringing, setup and repair are different jobs',
        link: {
          path: '/services/guitar-restringing-woodland-hills',
          label: 'See guitar restringing prices in Woodland Hills',
        },
        paragraphs: [
          'Restringing replaces worn or unsuitable strings and brings the instrument back to the intended tuning. It does not automatically include fretwork, nut cutting or a complete setup. Decide on the string type, gauge and usual tuning before a setup assessment.',
          'A setup considers neck relief, string height and intonation together, within the adjustments available on that instrument. Many electric bridges allow individual saddle adjustments; an acoustic saddle is a different design. There is no single measurement that suits every guitar and playing style.',
          'Cracks, lifting bridges, damaged frets and electrical faults need their own assessment. They should not be treated as routine string-height adjustments. Ask which work and parts are included in the estimate before authorizing it.',
        ],
      },
      {
        title: 'Make a useful comparison at home',
        link: { path: '/tuner/guitar', label: 'Check the open strings with the guitar tuner' },
        steps: [
          'Tune to your normal tuning and play the same familiar chords and notes at your usual strength.',
          'Write down exactly where the symptom occurs and when it began. Keep the current string packet or note the brand and gauge if known.',
          'Mention changes in storage, travel, tuning or string type, and any impact. Stop experimenting with adjustments if there is visible damage or a part resists movement.',
          'Bring those observations to the assessment. Ask the shop to explain the proposed work and demonstrate the result when you collect the instrument.',
        ],
      },
      {
        title: 'When to book an assessment',
        paragraphs: [
          'Check playability after a string or tuning change and when the instrument feels different after storage or travel. A comfortable guitar does not necessarily need work simply because a date has arrived. Follow its manufacturer’s maintenance guidance and discuss a sensible check interval for how you use it.',
          'Sattari accepts guitar and bass setup inquiries in Woodland Hills by appointment. Share the model, symptom, intended tuning and deadline. Scope, price, parts and completion timing are confirmed for the individual instrument.',
        ],
      },
    ],
    sources: [
      {
        label: 'Fender: setup adjustments and playing preferences',
        url: 'https://support.fender.com/hc/en-us/articles/42584764005019-How-do-I-set-up-my-Stratocaster-guitar-properly',
      },
      {
        label: 'Fender: understanding intonation',
        url: 'https://support.fender.com/hc/en-us/articles/42584627801243-How-do-I-intonate-my-instrument',
      },
    ],
    related: [
      '/services/guitar-setup-los-angeles',
      '/services/guitar-restringing-woodland-hills',
      '/guitar-strings-woodland-hills',
      '/guides/how-to-care-for-a-guitar',
      '/services/instrument-repair-los-angeles',
    ],
  },
  {
    slug: 'beginner-violin-care',
    title: 'Violin care and maintenance for beginners',
    category: 'Strings',
    description:
      'Build a simple violin-care routine: remove rosin dust, loosen the bow, check strings and store safely. Learn which problems need a teacher or repair assessment.',
    answer:
      'After playing, gently remove rosin dust with suitable dry cloths, release the bow’s playing tension and secure the instrument and bow in their case. Check string condition and ask for help with a leaning bridge, damaged string or persistent tuning problem instead of forcing an adjustment.',
    image: '/sattari site/violins/rosin.jpg',
    imageAlt: 'Sattari rosin in a cloth wrap',
    action: {
      label: 'Ask about violin repair',
      path: '/services/violin-repair-los-angeles',
    },
    sections: [
      {
        title: 'A short after-practice routine',
        steps: [
          'Use a clean, soft, dry cloth to remove loose rosin dust from the instrument. Keep a separate cloth for the strings and fingerboard so collected dirt is not rubbed into the varnish.',
          'Wipe the bow stick gently without touching the hair. Loosen the hair after playing as your teacher or bow maker has shown you; do not dismantle the screw.',
          'Check that the violin and bow are secured in the case and that loose accessories cannot strike them. Close the case before carrying it.',
        ],
      },
      {
        title: 'Add rosin according to the bow’s response',
        paragraphs: [
          'There is no useful stroke count for every bow and practice session. Start with your teacher’s guidance and add a small amount when needed. New hair and an already rosined bow can need different amounts.',
          'A slipping or scratchy sound is not always a rosin problem: bow speed, pressure, contact point and hair condition also matter. Ask a teacher to listen before repeatedly adding more. Do not wash the hair, use household cleaners or scratch the rosin with a key as routine maintenance.',
        ],
      },
      {
        title: 'Protect the finish and storage environment',
        paragraphs: [
          'Avoid alcohol, furniture polish and unapproved cleaning products on the violin. If rosin has hardened onto the varnish, ask a specialist about removal rather than scrubbing it. Follow the maker’s care instructions for the particular finish.',
          'Keep the closed case away from heating vents, direct sun and parked cars. Monitor the environment where the instrument actually rests. Ask the maker or repairer about suitable humidity control; a humidifier should not drip water into the case or onto the instrument.',
        ],
      },
      {
        title: 'Strings and bridge: check before playing',
        link: { path: '/tuner/violin', label: 'Check your violin’s open G, D, A and E strings' },
        paragraphs: [
          'Look for a broken winding, corrosion or a string that has become difficult to tune or respond consistently. Replacement timing depends on condition and use. Record the instrument size and the string’s end fitting before ordering; a listing for one size or fitting is not automatically suitable for another.',
          'If you have not changed strings before, ask a teacher or repairer to demonstrate. Removing all strings together can release the bridge. A leaning, displaced or damaged bridge needs assessment; do not force it upright or attempt a soundpost adjustment.',
          'For slipping or stuck pegs, new buzzing, an open seam or a crack, describe the symptom and arrange an assessment. Sattari takes violin string-replacement and repair inquiries by appointment. Confirm suitable strings, the work, price and timing before visiting.',
        ],
      },
    ],
    sources: [
      {
        label: 'Yamaha: daily violin care',
        url: 'https://www.yamaha.com/en/musical_instrument_guide/violin/maintenance/',
      },
      {
        label: 'Yamaha: bow maintenance',
        url: 'https://www.yamaha.com/en/musical_instrument_guide/violin/maintenance/maintenance004.html',
      },
      {
        label: 'Yamaha: changing violin strings',
        url: 'https://www.yamaha.com/en/musical_instrument_guide/violin/maintenance/maintenance002.html',
      },
    ],
    related: [
      '/guides/how-to-change-a-violin-string',
      '/violin-strings-woodland-hills',
      '/product/violin-strings',
      '/product/sattari-rosin',
      '/services/violin-repair-los-angeles',
      '/guides/choose-a-violin-for-beginners',
    ],
  },
  {
    slug: 'drumsticks-for-beginners',
    title: 'What drumsticks should a beginner use?',
    category: 'Drums',
    description:
      'A practical guide to choosing your first pair of drumsticks — size, wood type, and tip material explained, without the jargon.',
    answer:
      '5A hickory drumsticks are the standard starting point for beginners. The 5A size is versatile, comfortable for most hand sizes, and works well across rock, pop, and practice sessions. Hickory absorbs shock well, which reduces fatigue.',
    image: '/sattari site/sticks.png',
    imageAlt: 'Sattari drumsticks',
    action: { label: 'Shop drumsticks', path: '/shop/sticks' },
    sections: [
      {
        title: 'Why stick size matters',
        paragraphs: [
          'Drumstick models use size names such as 5A, 5B and 7A. In the Vic Firth American Classic line, a 7A is slimmer than a 5A, and a 5B is thicker than a 5A. Compare the diameter, length and taper of the particular models you are considering.',
          'Try a 5A as a starting point. Play the same single strokes quietly with a 5A and a 7A to feel the difference in reach, weight and rebound. If you want more weight behind a stroke, try a 5B or 2B.',
        ],
      },
      {
        title: 'Hickory vs maple',
        paragraphs: [
          'Hickory and maple are common drumstick woods. With comparable dimensions, hickory usually produces a heavier stick and maple a lighter one. Within each species, actual pairs differ in weight and balance.',
          'Try both on your practice surface. The taper, tip, surface tension and how you hold the stick also influence rebound. A maple pair can suit someone who wants a larger diameter without as much weight.',
        ],
      },
      {
        title: 'Wood tips vs nylon tips',
        paragraphs: [
          'A wood tip gives a warm, full sound on cymbals and a natural feel on drums. A nylon tip is brighter and more articulate on cymbals — it catches the surface more precisely, which is useful when cymbal definition matters. Nylon tips are also more durable; they do not chip the way wood tips can.',
          'For practice pads and in-room practice, there is no meaningful difference. For playing with a kit and cymbals, nylon tips give a brighter, more defined sound on ride and hi-hat. Wood tips blend more naturally into a mix. Neither is wrong — it depends on the sound you prefer and the music you are playing.',
        ],
      },
      {
        title: 'When to move to a different size',
        paragraphs: [
          'Use one pair for repeated practice sessions so you learn its feel. You can try another size alongside it as soon as you have a specific question about balance, reach or sound.',
          'Consider moving to a heavier stick if you are playing louder music and want more weight behind each stroke. Consider moving lighter if fatigue is limiting your practice time. The right stick is the one that lets you play longer with better control — not the one endorsed by your favourite drummer.',
        ],
      },
    ],
    sources: [
      {
        label: 'Vic Firth American Classic 7A specifications',
        url: 'https://vicfirth.com/products/american-classicr-7a',
      },
      {
        label: 'Vic Firth guide to wood, taper and tip choices',
        url: 'https://vicfirth.com/pages/frequently-asked-questions',
      },
      {
        label: 'Vic Firth American Classic 55A and its 5A / 5B size comparison',
        url: 'https://vicfirth.com/products/american-classicr-55a',
      },
    ],
    related: [
      '/product/classic-american-hickory-a5',
      '/product/classic-american-hickory-a7',
      '/product/classic-maple-5a-nylon-tip',
      '/shop/sticks',
      '/product/sattari-practice-pad-8',
    ],
  },
  {
    slug: 'how-to-care-for-a-guitar',
    title: 'How to care for a guitar',
    category: 'Guitar care',
    description:
      'Care for your guitar with gentle cleaning, sensible storage and string checks. Learn when model-specific instructions or a repair assessment are needed.',
    answer:
      'Wipe the instrument gently after playing, store it securely away from heat and environmental extremes, and check strings and playability regularly. Follow the maker’s instructions for its finish, strings and humidity needs; routine care does not replace assessment of a developing fault.',
    image: '/sattari site/guitars/steel-acoustic.jpg',
    imageAlt: 'Sattari steel-string acoustic guitar',
    action: {
      label: 'Ask about guitar setup and repair',
      path: '/services/guitar-setup-los-angeles',
    },
    sections: [
      {
        title: 'Start with a clean, dry cloth',
        paragraphs: [
          'Use a soft cloth to remove sweat and loose dirt from the strings, neck and body after playing. Keep cloths free of grit. Avoid rubbing a damaged finish or a rough, broken string winding.',
          'Identify the finish before applying a cleaner, polish or fretboard conditioner. A product intended for unfinished wood may be unsuitable for a sealed fingerboard; a polish may change a satin surface. Use only care products approved for the particular instrument, and follow their instructions.',
          'Do not apply household cleaners, alcohol or oil as a general remedy. If grime will not lift with gentle dry wiping, ask the maker or repairer what is appropriate. Cleaning is not a reason to dismantle parts you are unfamiliar with.',
        ],
      },
      {
        title: 'Measure the environment where you store it',
        paragraphs: [
          'Wooden instruments react to changes in moisture. Follow the manufacturer’s recommended humidity range and measure near the instrument with a hygrometer. Taylor, for example, recommends 45–55% relative humidity for its guitars; use your own maker’s guidance rather than treating one brand’s specification as universal.',
          'A case and a suitable humidity-control system can help when used correctly. Follow the device’s maintenance instructions and check readings; do not add moisture just because the calendar says winter. Keep liquid water away from the instrument.',
          'Keep guitars away from heating vents, direct sun and parked cars. Use a stable stand or closed case where the instrument cannot be knocked over. Electric guitars and basses also contain parts affected by environmental changes; solid, hollow and semi-hollow designs should all be stored with care.',
        ],
      },
      {
        title: 'Choose replacement strings for the instrument',
        paragraphs: [
          'Inspect for corrosion, damaged windings and changes in feel or sound. String life depends on use, sweat, storage and the string type, so a fixed number of weeks will not suit every player. Record the date and set you fit to learn what works for you.',
          'Keep the packet or note the instrument type, brand, gauge and tuning. Nylon-string, steel-string acoustic, electric and bass sets serve different instruments. Before changing gauge or tuning substantially, check the manufacturer’s recommendations and ask whether the setup needs attention.',
          'If you are unsure how the bridge or tuning machines work, ask for help with the string change. A locking tremolo or other unfamiliar hardware needs its own procedure; do not assume all guitars restring the same way.',
        ],
      },
      {
        title: 'Know when cleaning and strings are not enough',
        paragraphs: [
          'If buzzing, uncomfortable action or tuning concerns persist, note the affected strings and frets and arrange an assessment. A crack, lifting bridge or loose structural joint needs inspection before further adjustment.',
          'Sattari takes guitar string-replacement, setup and repair inquiries in Woodland Hills by appointment. Send the model, symptom, recent changes and your deadline. Confirm suitable parts, the estimate and timing before work; there is no fixed turnaround promised by this guide.',
        ],
      },
    ],
    sources: [
      {
        label: 'Taylor: humidity requirements for Taylor guitars',
        url: 'https://taylorguitars.zendesk.com/hc/en-us/articles/360061909892-Do-I-have-to-humidify-my-guitar',
      },
      {
        label: 'Taylor: using and monitoring a guitar humidifier',
        url: 'https://www.taylorguitars.com/support/maintenance/using-guitar-humidifier',
      },
      {
        label: 'Taylor: deciding when to change strings',
        url: 'https://blog.taylorguitars.com/how-often-should-you-change-guitar-strings',
      },
      {
        label: 'Taylor: choosing cleaning products for the finish',
        url: 'https://www.taylorguitars.com/support/maintenance/properly-cleaning-your-guitar',
      },
    ],
    related: [
      '/guides/how-to-change-acoustic-guitar-strings',
      '/guides/how-to-change-electric-guitar-strings',
      '/guides/when-does-my-guitar-need-a-setup',
      '/services/guitar-restringing-woodland-hills',
      '/guitar-strings-woodland-hills',
      '/services/guitar-setup-los-angeles',
      '/services/instrument-repair-los-angeles',
    ],
  },
];

// Each collection is also a destination in the crawlable guide index.
export const guideCollections = [
  {
    id: 'string-replacement',
    title: 'How to change instrument strings',
    guides: [
      persianTarStringChangeGuide,
      setarStringChangeGuide,
      oudStringChangeGuide,
      acousticStringChangeGuide,
      classicalStringChangeGuide,
      electricStringChangeGuide,
      bassStringChangeGuide,
      violinStringChangeGuide,
      violaStringChangeGuide,
      celloStringChangeGuide,
      ukuleleStringChangeGuide,
    ],
  },
  { id: 'bowed-strings', title: 'Violin and viola', guides: bowedInstrumentGuides },
  { id: 'guitar-and-bass', title: 'Guitar and bass', guides: guitarInstrumentGuides },
  {
    id: 'instrument-history',
    title: 'Instrument history and listening',
    guides: instrumentHistoryGuides,
  },
  {
    id: 'practice-and-care',
    title: 'Practice, technique and care',
    guides: [snareTuningGuide, practicePadGuide, ...practiceGuides],
  },
];

export const musicGuides = guideCollections.flatMap((collection) => collection.guides);
