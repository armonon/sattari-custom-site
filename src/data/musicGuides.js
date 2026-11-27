import { separatorGuides } from './stemSeparatorContent';

export const musicGuides = [
  {
    slug: 'how-to-separate-vocals-drums-bass',
    title: 'How to separate vocals, drums, and bass from a song',
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
    action: { label: 'Open the guitar tuner', path: '/learn?tool=tuner' },
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
          columns: ['Instrument', 'Open strings', 'Frequencies (Hz)'],
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
          columns: ['Tuning', 'Strings, low to high', 'What changes'],
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
          columns: ['Key', 'I', 'IV', 'V', 'vi', 'Relative minor'],
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
          columns: ['Signature', 'Major key', 'Minor key'],
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
      'Spot signs your guitar needs a setup: fret buzz, high action, tuning drift and intonation problems. Learn what a setup fixes, how often to get one, and what to tell the shop.',
    answer:
      'A guitar typically needs a setup when it buzzes or feels stiff to play, when frets feel sharp on the edges, when it drifts out of tune after every song, or when notes at the 12th fret are noticeably sharp or flat compared to the open string. A professional setup adjusts neck relief, action, nut and saddle height, and intonation — all together, which is why individual adjustments often cause new problems.',
    image: '/sattari site/guitars/steel-acoustic.jpg',
    imageAlt: 'Steel string acoustic guitar on a stand',
    action: {
      label: 'Request a guitar setup',
      path: '/services/instrument-repair-los-angeles#repair-inquiry',
    },
    sections: [
      {
        title: 'Signs your guitar needs attention',
        paragraphs: [
          'Fret buzz is the most common one — a sitar-like rattle on certain frets, or everywhere below the 5th fret. Some buzz is normal under hard attack, but if it happens at normal playing volume and affects tone, the neck relief, nut, or saddle height is off.',
          'High action makes fretting uncomfortable and causes fatigue, especially on acoustic guitars that have not been adjusted since they left the factory. Low action causes buzz. Both can exist on the same guitar at different string heights.',
          'Intonation drift means the guitar sounds in tune on open strings and at the 5th fret but goes noticeably sharp or flat higher up the neck. This is the saddle position. No amount of tuning fixes it without adjusting the intonation.',
          'Seasonal changes in humidity cause wood to expand and contract, which moves the neck. A guitar that was fine in summer may buzz or play stiff in winter. Climate-sensitive instruments benefit from a setup check after major weather changes.',
        ],
      },
      {
        title: 'What a setup actually adjusts',
        paragraphs: [
          'Neck relief is the slight forward bow in the neck, controlled by the truss rod. It affects how much room the strings have to vibrate at the lower frets. Too straight causes buzz; too much bow raises the middle of the neck uncomfortably.',
          'Action at the nut affects open-string feel and first-position chords. Action at the saddle affects the upper frets. The two interact, so changing one without checking the other is rarely a complete solution.',
          'Intonation means adjusting the saddle position so the string is effectively the right length at pitch. On acoustics this is cut into the saddle; on electrics, each saddle is individually adjusted. A guitar with poor intonation cannot be played fully in tune, regardless of how carefully you tune the open strings.',
        ],
      },
      {
        title: 'How often does a guitar need a setup?',
        steps: [
          'After every string change on an acoustic, at minimum check that the action has not moved noticeably and the guitar is still intonating well.',
          'Annually is a reasonable default for a guitar that is played regularly, even if nothing feels wrong. Small adjustments made early prevent larger problems later.',
          'After traveling between climates or storing the instrument through a season, check the neck relief before playing hard. A few minutes with a ruler or a tech is faster than undoing a cough that developed over months.',
          'After any impact, hard fall or neck symptom — buzzing that appeared overnight, notes that go dead, binding in the nut slots — bring it in before playing the issue deeper.',
        ],
      },
      {
        title: 'What to tell the shop',
        paragraphs: [
          'Describe the specific symptom: which frets buzz, at what playing volume, whether it affects all strings or one in particular. Mention the string gauge you use, because setup height depends on string tension. Mention any recent changes — new strings, travel, a fall.',
          'If you have a playing style preference, say so. A setup for low-action fast electric playing is different from one optimized for heavier acoustic strumming. A tech who knows how you play can calibrate toward it rather than guessing.',
        ],
      },
    ],
    related: [
      '/services/instrument-repair-los-angeles',
      '/product/classic-nylon-string-guitar',
      '/product/steel-string-acoustic-guitar',
      '/shop/guitar-bass',
    ],
  },
  {
    slug: 'how-to-tune-a-snare-drum',
    title: 'How to tune a snare drum',
    category: 'Drums',
    description:
      'Tune a snare drum for a clear, focused sound. Learn even lug tension, the star pattern, and when dull or ringy tone is a tuning problem versus a worn head.',
    answer:
      'Finger-tighten all lugs evenly, then use a drum key to add tension in a star pattern — tuning opposite lugs together in small increments. Tap one inch from each lug and listen for pitch consistency. When all lugs ring at the same pitch, the head is even. A focused crack means even tension at the right pitch range; a dull thud or uncontrolled ring usually means uneven lugs or a worn head.',
    image: '/sattari site/drums/practice-pad-12.jpg',
    imageAlt: 'Sattari practice pad and drumsticks on a stand',
    action: {
      label: 'Ask about drum tuning',
      path: '/services/instrument-repair-los-angeles#repair-inquiry',
    },
    sections: [
      {
        title: 'Start with even tension',
        paragraphs: [
          'Release all tension from the head first. Press gently on the center to seat the head, then finger-tighten all lugs until you feel light resistance. This is your baseline. No lug should be tighter than any other before you begin tuning.',
          'Use the star pattern: tighten lug 1, then the lug directly across from it, then move to the next pair at 90 degrees, and repeat. Never tighten adjacent lugs in sequence — you create uneven tension that takes longer to chase out.',
        ],
      },
      {
        title: 'Match pitch by ear at each lug',
        steps: [
          'Tap the head firmly about one inch from each tension rod, moving around the drum. Listen to the pitch at each point.',
          'Tighten lugs that are lower in pitch, in small increments. A quarter-turn at a time is plenty. Return to the opposite lug before making another adjustment.',
          'Continue around the drum until all lugs produce the same pitch. At that point the head is even, regardless of what overall tension you choose.',
          'Adjust the overall tension to the pitch and feel you want. A higher pitch gives a shorter, crisper crack. A lower pitch gives a deeper, fuller sound with more sustain.',
        ],
      },
      {
        title: 'Tune the bottom head separately',
        paragraphs: [
          'The resonant (bottom) head affects the snare response and the overall sustain. A looser bottom head gives more snare buzz and a longer tone. A tighter bottom head gives a drier, more controlled crack.',
          'Tune the bottom head the same way: even tension first, star pattern second, pitch matching around each lug. Make small changes and listen after each adjustment. The interaction between the two heads changes the tone of both, so expect to go back and forth a few times.',
        ],
      },
      {
        title: 'When tuning does not fix the problem',
        paragraphs: [
          'If the drum sounds dull even at even, correct tension, the head may be worn or dented. A cracked or significantly dented head should be replaced before tuning further.',
          'If the drum has an uncontrolled overtone that cannot be dialed out, check whether the bearing edge — the rim of the shell that the head sits on — is level and undamaged. A damaged bearing edge cannot be fixed by tuning. Bring the drum in for an inspection if the problem persists after careful, even tuning.',
        ],
      },
    ],
    related: [
      '/product/sattari-practice-pad-12',
      '/product/classic-american-hickory-a5',
      '/product/classic-american-hickory-a7',
      '/services/instrument-repair-los-angeles',
    ],
  },
  {
    slug: 'beginner-violin-care',
    title: 'Violin care and maintenance for beginners',
    category: 'Strings',
    description:
      'Keep your violin playing well: how to rosinate the bow, wipe down after playing, store the instrument safely, spot when strings need changing, and when to visit a shop.',
    answer:
      'After every session, wipe rosin dust from the strings, top of the instrument, and the stick of the bow with a soft dry cloth. Store the violin in a closed case away from direct heat, sunlight, and sudden humidity changes. Rosinate the bow before each practice session — four to six slow, even strokes across a fresh cake of rosin is usually enough.',
    image: '/sattari site/violins/rosin.jpg',
    imageAlt: 'Sattari rosin in a cloth wrap',
    action: { label: 'Shop violin accessories', path: '/shop/violins' },
    sections: [
      {
        title: 'After every session',
        steps: [
          'Loosen the bow hair a little before storing — not completely slack, but noticeably less taut than playing tension. Fully tensioned bow hair can warp the stick over time.',
          'Wipe rosin dust from the strings with a soft, dry cloth. Wipe the area of the top between the bridge and the end of the fingerboard. Rosin builds up on the varnish and is harder to remove the longer it sits.',
          'Wipe the bow stick, avoiding the hair. Use a separate cloth from the one you use on the instrument body.',
          'Place the violin in its case and close the latches. Do not leave it on a chair, stand, or music stand when you are not playing.',
        ],
      },
      {
        title: 'Rosin and the bow',
        paragraphs: [
          'New bow hair or hair that has been washed needs rosin before it will produce any sound. Apply four to six slow, even strokes across a fresh cake of rosin, then play a few long bows to set it. Only then add more in light passes as needed.',
          'Too much rosin makes the sound scratchy and leaves heavy white dust on everything. Too little makes the bow slip silently across the string. A consistent tone with a light residue on the strings after playing means the amount is about right.',
          'If the rosin surface becomes shiny or glassy, score it gently with a fingernail or a key before applying. A glossy surface does not grip the bow hair.',
        ],
      },
      {
        title: 'Storage and climate',
        paragraphs: [
          'Violins are sensitive to humidity. Wood expands in humid conditions and contracts in dry ones. Very dry air — especially heated indoor air in winter — causes seams to open, and can crack the top or back. A hard case provides a more stable environment than a soft bag. Some players use a small case humidifier in dry months.',
          'Keep the instrument away from direct sunlight, car interiors in summer, and radiators or heating vents. A temperature that is comfortable to sit in is generally fine for the instrument. Rapid changes — cold car to warm room — are harder on the instrument than a stable temperature at either end.',
        ],
      },
      {
        title: 'Strings, bridge, and when to visit a shop',
        paragraphs: [
          'Strings lose their brightness and responsiveness over time, even without breaking. A set that has been played daily for a year is probably ready to be replaced. Strings that feel rough, produce a dull or unclear tone, or are visibly corroded or fraying should be changed. Change one string at a time so the bridge and soundpost remain under tension.',
          'Check that the bridge is standing straight — it should be perpendicular to the top, with the flat side facing the tailpiece. Seasonal tuning changes can pull the bridge out of position gradually. Never force it; if it has moved significantly, bring the violin to a shop to have it set correctly.',
          'Pegs that slip or stick, a buzz that no amount of careful playing fixes, an open seam, or a crack anywhere on the body all need a professional repair. Minor adjustments that seem small — a loose peg, a low bridge — have real consequences for playability and can escalate if left.',
        ],
      },
    ],
    sources: [
      {
        label: 'Thomann: violin care and maintenance guide',
        url: 'https://www.thomann.de/gb/onlineresources/violin_care.htm',
      },
    ],
    related: [
      '/product/sattari-rosin',
      '/product/violin-strings',
      '/shop/violins',
      '/services/instrument-repair-los-angeles',
    ],
  },
  {
    slug: 'choose-a-violin-for-beginners',
    title: 'How to choose a violin for beginners',
    category: 'Strings',
    description:
      'What to look for when buying a first violin — size, acoustic vs electric, what should be included, and red flags that signal a poor instrument.',
    answer:
      'For most beginners, a full-size (4/4) acoustic violin with a bow, case, and rosin included is the right starting point. Size matters most: an instrument that is too large causes strain and slows progress. Ask your teacher to confirm the size before buying.',
    image: '/sattari site/violins/brescia-acoustic.jpg',
    imageAlt: 'Sattari Brescia acoustic violin',
    action: { label: 'Shop violins', path: '/shop/violins' },
    sections: [
      {
        title: 'Get the right size first',
        paragraphs: [
          'Adult players and most teenagers use a full-size (4/4) violin. Younger children and smaller players may need a 3/4 or smaller instrument. The right way to check is with the player present: hold the violin in rest position under the chin, extend the arm along the neck, and see whether the fingers can reach and curl around the scroll without strain. If you cannot measure in person, ask the teacher for a size recommendation before purchasing.',
          'Playing a violin that is too large causes tension in the shoulder, arm, and wrist, and makes shifting and bowing harder to learn. An instrument that is slightly too small is also limiting. Getting the size right matters more than any other specification at the beginner level.',
        ],
      },
      {
        title: 'Acoustic, electric, or silent?',
        paragraphs: [
          'An acoustic violin needs no power source and produces sound naturally through the body. It is the standard choice for lessons, classical training, and players who want an instrument with an organic, resonant tone. Acoustic violins require a practice environment where some sound is acceptable.',
          'An electric or silent violin uses a piezo pickup and produces very little acoustic sound on its own. Connect headphones for private practice or plug into an amp to perform. Silent violins are practical for apartments or shared spaces. An acoustic violin is the better starting point for most students; a silent model is a good second instrument or the right choice where volume is a real concern.',
        ],
      },
      {
        title: 'What a beginner violin should include',
        paragraphs: [
          'A violin sold as a beginner instrument should include a bow, a case, and rosin. These are not optional: you cannot play without a bow, and a bow cannot grip the strings without rosin. A case protects the instrument during transport and storage. Verify that all three are part of what you are buying before assuming they are included.',
          'The bow matters more than many beginners expect. A warped or low-quality bow is difficult to control and obscures whether the player is making progress. Check that the bow is straight by sighting down the length of the stick and that the hair is in good condition.',
        ],
      },
      {
        title: 'Signs of a well-made instrument and red flags to avoid',
        paragraphs: [
          'A good beginner violin is individually set up before it ships: the bridge is correctly fitted and positioned, the nut slots are cut to the right depth, and the strings are at a comfortable height. An instrument that is poorly set up is harder to play and will not hold tune reliably. Ask explicitly whether the instrument has been set up.',
          'Red flags include pegs that slip immediately, an open seam on the body, visible cracks, a bridge that tilts forward or backward, or strings so high off the fingerboard that the fingers cannot press them down comfortably. These problems are fixable but add cost and time. A workshop-fitted instrument from a reputable seller avoids most of them before the player even picks it up.',
        ],
      },
    ],
    related: [
      '/product/brescia-acoustic-violin',
      '/product/chiara-wooden-electric-violin',
      '/product/violin-strings',
      '/encino-violin-shop',
      '/services/instrument-repair-los-angeles',
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
          'Drumstick sizes are named with a number and a letter — 5A, 7A, 2B, and so on. The number refers roughly to how many sticks fit within a certain diameter (lower numbers = thicker sticks). The letter indicates the original intended use: A for orchestra, B for band, S for street. In practice, the number is what matters most.',
          '5A is the most widely used size and the best starting point for most beginners. It is balanced, comfortable for a range of hand sizes, and versatile enough to cover most playing situations. 7A is thinner and lighter — popular for jazz and lighter playing, but can feel fragile for hard practice. Thicker sizes like 2B are designed for volume and power, not for developing technique.',
        ],
      },
      {
        title: 'Hickory vs maple',
        paragraphs: [
          'Most drumsticks are made from hickory or maple. Hickory is denser and heavier, absorbs shock well, and gives the player more feedback from the drumhead. Hickory sticks are durable and forgiving — a good choice for beginners who are still developing control.',
          'Maple is lighter than hickory, which makes it faster and easier to play for extended periods. The reduced weight also means less rebound from the head. Maple sticks are popular with jazz drummers and players who value speed over power. Either wood works for a beginner; hickory is the more common starting recommendation.',
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
          'Stick with the same size long enough to develop consistency. Switching sticks too early makes it harder to build a reliable stroke. Most beginners should use the same pair for at least several months before experimenting with a different size or material.',
          'Consider moving to a heavier stick if you are playing louder music and want more weight behind each stroke. Consider moving lighter if fatigue is limiting your practice time. The right stick is the one that lets you play longer with better control — not the one endorsed by your favourite drummer.',
        ],
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
    slug: 'choose-a-practice-drum-pad',
    title: 'How to choose a practice drum pad',
    category: 'Drums',
    description:
      'What to look for in your first practice pad — 8-inch vs 12-inch, rubber surface, rebound feel, and what else you need to start.',
    answer:
      'An 8-inch rubber practice pad is the standard starting point: quiet enough to use at home, light enough to carry, and sufficient for developing a consistent stroke. Move up to a 12-inch pad when you want more playing surface, a closer snare feel, or plan to share it with a teacher.',
    image: '/sattari site/drums/practice-pad-8.jpg',
    imageAlt: 'Sattari 8-inch drummer practice pad',
    action: { label: 'Shop practice pads', path: '/shop/essentials' },
    sections: [
      {
        title: '8-inch vs 12-inch: which size to start with',
        paragraphs: [
          'An 8-inch pad fits in a bag, costs less, and takes up almost no space on a desk or table — it is the practical choice for a student who needs to practice away from a kit. The playing surface is smaller, so technique and stick placement have to be precise. That constraint is a feature: it builds accuracy.',
          'A 12-inch pad gives you more room to move around the surface and feels noticeably closer to a real snare drum head in diameter. It is a better choice if you are practicing rudiments that cross the center of the drum, if a teacher will share the pad with you in a lesson, or if you want the experience to map more directly to sitting behind a kit.',
          'Most beginners do not need both. Start with the 8-inch, practice consistently for a few months, and only move to the 12-inch once the size starts limiting your work.',
        ],
      },
      {
        title: 'Surface feel and rebound',
        paragraphs: [
          'Rubber practice pads give consistent rebound and are quieter than foam. The rebound is slightly bouncier than a real drum head, which means strokes that feel good on the pad will need some adjustment when you move to an acoustic kit. That is normal — the pad is for developing control, not reproducing an exact drum feel.',
          'Gum rubber surfaces are the most common and durable option. Some pads include a second surface with a different feel or a quieter response. For most beginners, a standard rubber surface is all you need.',
          "Avoid pads that feel unusually hard or that do not give any rebound. Dead surfaces slow down development by forcing you to muscle strokes rather than using the stick's natural bounce.",
        ],
      },
      {
        title: 'Portability and where you will practice',
        paragraphs: [
          'If you practice at a desk or table, a non-slip base keeps the pad in place without a stand. Most 8-inch pads include one. Check that the base is wide enough that the pad does not tip when you strike near the edge.',
          'If you plan to practice standing up or at drum-kit height, you need a snare stand to mount the pad — or a pad that includes legs. Practicing at the right height builds posture habits that transfer directly to the kit. Practicing hunched over a table does not.',
          'For travel, an 8-inch pad fits in most drum bags or a backpack without special cases. A 12-inch pad usually needs its own bag or a larger stick bag with a pad pocket.',
        ],
      },
      {
        title: 'What else you need to start',
        paragraphs: [
          'You need sticks. For most beginners, 5A hickory is the right starting pair — a balanced weight for practice across most styles. Pick up two pairs so you have a spare.',
          'A metronome or a drum machine track is as important as the pad itself. Consistent tempo is the skill that separates a drummer who sounds good from one who does not. A free app works; the goal is to have something that keeps time while you practice.',
          'A snare stand is optional at first unless you want to practice standing up. If you eventually plan to practice rolls and rudiments for more than 20 minutes at a stretch, standing at proper height makes a real difference in how long you can go without discomfort.',
        ],
      },
    ],
    related: [
      '/product/sattari-practice-pad-8',
      '/product/sattari-practice-pad-12',
      '/guides/drumsticks-for-beginners',
      '/shop/essentials',
      '/woodland-hills-drum-shop',
    ],
  },
  {
    slug: 'choose-a-beginner-acoustic-guitar',
    title: 'How to choose a beginner acoustic guitar',
    category: 'Guitar',
    description:
      'What to look for in your first acoustic guitar — steel-string vs classical nylon, body size, and what to expect from a well-set-up beginner instrument.',
    answer:
      'A full-size steel-string acoustic is the right starting guitar for most beginners. Nylon-string classical guitars suit fingerstyle, classical technique, and younger players. The two feel and sound different — choosing between them depends on the style of music you want to play, not just budget.',
    image: '/sattari site/guitars/steel-acoustic.jpg',
    imageAlt: 'Sattari steel-string acoustic guitar',
    action: { label: 'Shop guitars', path: '/shop/guitar-bass' },
    sections: [
      {
        title: 'Steel-string acoustic vs classical nylon',
        paragraphs: [
          'Steel-string acoustics have a brighter, louder sound and are the standard choice for folk, pop, country, blues, and singer-songwriter music. The strings have higher tension against your fingertips, which means a small amount of discomfort for the first few weeks as you build calluses — that goes away.',
          'Classical nylon-string guitars have lower-tension strings that are softer on fingertips, which makes them slightly more comfortable for complete beginners. They produce a warmer, rounder tone. Nylon-string technique uses classical hand position and fingerpicking — it is the right choice for anyone learning classical music, flamenco, or Latin guitar styles.',
          'The key question is what music you want to play. If your goal is to strum chords to singer-songwriter songs, get a steel-string. If you are drawn to classical or fingerstyle music, start with a nylon. Do not choose one hoping to easily switch later — the technique and feel are different enough that the choice matters.',
        ],
      },
      {
        title: 'Body size and playability',
        paragraphs: [
          'Full-size acoustic guitars (also called dreadnought or orchestra body) are the standard for adults. They produce more volume and bass response than smaller bodies. If you are an adult of average build, start with a full-size — the size difference between models is smaller in practice than it looks in photos.',
          'Smaller bodies (concert, auditorium) are easier to hold and slightly more comfortable for players with shorter arms or smaller frames. They produce a balanced midrange tone with less bass boom. A reasonable choice if full-size feels physically awkward, but not necessary for most beginners.',
          'Action — the height of the strings above the fretboard — matters more than body size for playability. A guitar with high action is harder to press and causes unnecessary soreness. A well-set-up guitar makes learning significantly easier. If you are buying online, choose a brand that sets up instruments before shipping.',
        ],
      },
      {
        title: 'What to look for in a first guitar',
        paragraphs: [
          'The most important thing is that the guitar is properly set up. A cheap guitar with good action is easier to learn on than an expensive guitar with high strings. If a guitar arrives with strings too high to comfortably press in the first few frets, take it to a tech for a basic setup before you spend weeks struggling against the instrument.',
          'For the body, a spruce top produces a bright, articulate sound that improves over time with regular playing. Solid-top guitars develop tone as the wood responds to use; laminate tops do not change as much. For a first guitar, laminate is fine — the difference matters more once you are developing a more refined ear.',
          'Check that the neck is straight and the tuning pegs hold pitch. A guitar that will not stay in tune makes it nearly impossible to develop a good ear and becomes genuinely discouraging. Tune up before every practice session regardless.',
        ],
      },
      {
        title: 'Electric vs acoustic for beginners',
        paragraphs: [
          'Acoustic guitars require no amp or cables and are ready to play anywhere. They build finger strength faster because of slightly higher string resistance. The main drawback is that practicing in an apartment or shared space is louder.',
          'Electric guitars are quieter unplugged and easier to press physically — lighter strings and lower action. The trade-off is the cost and complexity of adding an amp. A practice amp is fine for getting started, but it is another purchase and another cable to manage.',
          'For most beginners without a specific reason to go electric, start acoustic. You can always add an electric later. Learning on acoustic builds technique that transfers cleanly to electric; the reverse is less reliable.',
        ],
      },
    ],
    related: [
      '/product/steel-string-acoustic-guitar',
      '/product/classic-nylon-string-guitar',
      '/product/flame-stratocaster-electric-guitar',
      '/guides/when-does-my-guitar-need-a-setup',
      '/services/guitar-setup-los-angeles',
    ],
  },
  {
    slug: 'how-to-care-for-a-guitar',
    title: 'How to care for a guitar',
    category: 'Guitar care',
    description:
      'A practical guide to keeping your guitar playing well — cleaning strings and fretboard, humidity and storage, and when to take it in for a setup.',
    answer:
      'Wipe down your strings after every session, keep the guitar away from extreme heat and humidity swings, and store it in a case or on a stand away from direct sunlight. Do this consistently and your guitar will stay in good playing condition for years.',
    image: '/sattari site/guitars/steel-acoustic.jpg',
    imageAlt: 'Sattari steel-string acoustic guitar',
    action: { label: 'Guitar setup and repair', path: '/services/guitar-setup-los-angeles' },
    sections: [
      {
        title: 'Clean strings and fretboard regularly',
        paragraphs: [
          'Wipe your strings down after every time you play. Use a dry cloth or a string cleaning cloth — run it under and over each string to remove oils, sweat and debris. Strings that are not cleaned corrode faster, lose tone faster, and feel rough under your fingers. Cleaning adds weeks or months to their life.',
          'The fretboard also collects oils and grime over time. For rosewood and ebony fretboards (unfinished, porous wood), use a dry or lightly dampened cloth. Every several months, or when the wood looks dry, condition the fretboard with a small amount of lemon oil or fretboard conditioner. Apply, let it soak for a few minutes, then wipe off the excess.',
          'Maple fretboards are typically finished and sealed — clean with a dry or barely damp cloth only. Do not use oil on a finished fretboard.',
          'Wipe down the body and neck with a soft cloth after playing. Guitar polish is optional for finished bodies (gloss or satin). Avoid polish on natural or oiled finishes, and keep any cleaning product away from the fretboard.',
        ],
      },
      {
        title: 'Humidity and storage',
        paragraphs: [
          'Wood reacts to humidity. Acoustic guitars are particularly sensitive: too dry and the wood shrinks, causing sharp fret ends, cracking, and raised seams; too wet and the top swells, raising action and muffling tone. The target range for most acoustic guitars is 45–55% relative humidity.',
          'In dry climates or during winter (when indoor heating dries the air), store your guitar in a case with a soundhole humidifier. These are inexpensive and prevent the most common humidity-related damage. Check and refill the humidifier every week or two.',
          'Electric guitars and basses are less sensitive to humidity than acoustics because they have no hollow body to swell or contract — but they are still affected at extremes. The same general guidance applies: avoid leaving them in very dry or very damp environments for extended periods.',
          'Never leave a guitar in a car, especially in summer. Interior car temperatures can reach extreme highs quickly, causing finish checking, glue failure, and neck issues in a single afternoon.',
        ],
      },
      {
        title: 'Strings: when to change them',
        paragraphs: [
          'Change your strings when they sound dull, feel rough, or will not stay in tune. How often depends on how much you play and whether you clean them after each session. For daily players, every 4–8 weeks is common. For occasional players, every 3–6 months. The tone difference between fresh strings and old ones is significant — new strings restore brightness and improve intonation.',
          'For acoustic guitars, light gauge strings (0.012–0.053) are easiest on the fingers and suitable for most playing styles. Medium gauge strings produce more volume and projection but require more finger pressure. Electric strings are lighter — 0.009 or 0.010 gauge is standard for most players.',
          'When you change strings, clean the fretboard at the same time. It is the most convenient opportunity since the strings are off.',
        ],
      },
      {
        title: 'When to take the guitar in',
        paragraphs: [
          'Some issues require a tech rather than at-home maintenance. A professional setup adjusts neck relief, saddle height, nut slots, and intonation — all things that affect how the guitar plays and feels, and none of which can be fixed with a cloth or string change.',
          'Take it in when: the action is too high or too low, the neck has a noticeable bow, the guitar will not intonate correctly (strings fret sharp or flat as you move up the neck), frets are uneven, or anything structural looks wrong — cracks at the bridge, lifting seams, a loose brace.',
          'A setup typically takes one to a few days and makes a noticeable difference in playability. Most guitars benefit from a setup after purchase and again after any significant change in climate or string gauge.',
        ],
      },
    ],
    related: [
      '/guides/when-does-my-guitar-need-a-setup',
      '/product/steel-string-acoustic-guitar',
      '/product/flame-stratocaster-electric-guitar',
      '/services/guitar-setup-los-angeles',
      '/services/instrument-repair-los-angeles',
    ],
  },
];
