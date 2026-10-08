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
      '/product/five-string-bass-guitar',
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
      'Spot the signs your guitar needs a professional setup: fret buzz, high action, tuning drift and intonation problems. What a setup fixes, how often to get one, and what to tell the shop.',
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
          'Avoid pads that feel unusually hard or that do not give any rebound. Dead surfaces slow down development by forcing you to muscle strokes rather than using the stick\'s natural bounce.',
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
];
