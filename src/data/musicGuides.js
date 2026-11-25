import { separatorGuides } from './stemSeparatorContent';

export const musicGuides = [
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
      '/violin-strings-woodland-hills',
      '/product/violin-strings',
      '/product/sattari-rosin',
      '/services/violin-repair-los-angeles',
      '/guides/choose-a-violin-for-beginners',
    ],
  },
  {
    slug: 'choose-a-violin-for-beginners',
    title: 'How to Choose a Violin: Size, Setup & a Beginner’s Checklist',
    category: 'Strings',
    description:
      'Choose a first violin with a fitting and setup checklist. Compare two full-size acoustic and electric models, their prices, and the accessories each includes.',
    answer:
      'Start with the size your teacher recommends and the kind of violin your lessons require. Then try a few notes and compare the cost of everything you need to play your first lesson.',
    image: '/sattari site/violins/brescia-acoustic.jpg',
    imageAlt: 'Sattari Brescia acoustic violin',
    action: {
      label: 'Compare Sattari violins',
      path: '/shop/violins',
    },
    sections: [
      {
        title: 'Confirm size with the player present',
        paragraphs: [
          'A full-size violin is labeled 4/4, but that label is not a recommendation for every beginner. Children and some smaller players need a different fit. Ask a teacher to assess reach, posture and comfort rather than choosing only by age or a photograph.',
          'If buying for someone else, obtain the teacher’s recommended size first. Ask which sizes are actually available; a shop’s full-size catalog does not establish stock of smaller student instruments. Rental availability is also a separate inquiry.',
        ],
      },
      {
        title: 'Choose the sound and practice setup you need',
        paragraphs: [
          'An acoustic violin produces its sound through the body without amplification. If a teacher or ensemble expects an acoustic instrument, start that conversation before comparing other designs.',
          'Electric and quiet-practice models vary. Check the specific model’s output, power requirements and whether headphone listening needs a separate control box, interface or amplifier. A pickup socket is not necessarily a headphone output, and quiet practice is not completely silent.',
          'Compare the complete setup you will use at home, including any cable or amplification. Ask to hear the actual model where a demonstration is available, and identify any processing in a recorded demo.',
        ],
      },
      {
        title: 'Your first-violin buying checklist',
        lead: true,
        steps: [
          'Check the fit in playing position. Ask your teacher to watch your reach and posture and write down the size.',
          'Ask which type your lessons or ensemble require. Try an acoustic violin in the room or an electric violin through the equipment you plan to use.',
          'Play open strings and a few fingered notes. Ask the shop to show how the pegs hold pitch, how the bridge fits and whether the string height feels comfortable.',
          'Inspect the body and seams with the shop. Ask about cracks, previous repairs or any buzzing you hear.',
          'Price the complete kit. Confirm the bow, case, rosin, shoulder rest and any electronics you need, plus collection or delivery and return terms.',
        ],
      },
      {
        title: 'Compare value without relying on a label',
        paragraphs: [
          'Words such as beginner, professional or handmade do not tell you whether an instrument fits this player. Compare the actual instrument, the quality of its setup, included equipment and the support available. Confirm construction or origin claims with the seller instead of inferring them from a model name.',
          'Browse Sattari’s violin pages for the current model details, then contact the Woodland Hills shop with your teacher’s size recommendation and intended use. Visits are by appointment. String fit and repair work are separate questions from the purchase of an instrument.',
        ],
      },
    ],
    sources: [
      {
        label: 'Yamaha: choosing a violin with knowledgeable help',
        url: 'https://www.yamaha.com/en/musical_instrument_guide/violin/selection/',
      },
    ],
    related: [
      '/shop/violins',
      '/guides/beginner-violin-care',
      '/services/music-lessons-los-angeles',
      '/services/violin-repair-los-angeles',
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
    sources: [
      {
        label: 'Vic Firth American Classic 7A specifications',
        url: 'https://vicfirth.com/products/american-classicr-7a',
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
      'Choose a first acoustic guitar by sound, body fit and comfortable playability. Compare steel and nylon strings and check the full purchase before deciding.',
    answer:
      'Choose a guitar you can hold comfortably and want to practice, suited to the music you want to learn. Compare steel-string and nylon-string instruments in person where possible, and ask about setup, included accessories and the total cost before buying.',
    image: '/sattari site/guitars/steel-acoustic.jpg',
    imageAlt: 'Sattari steel-string acoustic guitar',
    action: {
      label: 'Compare guitars and basses',
      path: '/shop/guitar-bass',
    },
    sections: [
      {
        title: 'Start with the music and the feel',
        paragraphs: [
          'Steel-string acoustics generally offer a bright attack; nylon-string instruments have a different response and are common in classical and related styles. Both can be played with a range of techniques. Bring examples of music you want to learn and ask your teacher which design fits the lessons.',
          'Many classical guitars have wider string spacing than steel-string models, but dimensions vary. Compare the actual neck width, scale length and feel. Softer-feeling strings alone do not decide whether a guitar is comfortable for your hands.',
          'String types are not interchangeable by default. Use a set approved for the instrument. In particular, do not fit steel strings to a guitar designed for nylon strings unless its manufacturer explicitly permits it.',
        ],
      },
      {
        title: 'Try the instrument in your normal playing position',
        paragraphs: [
          'Body depth, width and neck reach all affect comfort. Dreadnought, concert and other body names describe different designs, not a single universal full-size fit. A smaller body can be a good choice for an adult as well as a younger player.',
          'Sit in the position you expect to practice in. Can you reach the first few frets without lifting your shoulder or stretching awkwardly? Try a few notes and a simple chord. Stop if playing causes pain, and ask a teacher to help with posture and fit.',
          'Action is the height of the strings above the frets. If fretting feels difficult, have the setup checked rather than assuming you must simply press harder. The appropriate height depends on the instrument and how you play.',
        ],
      },
      {
        title: 'Compare the complete purchase',
        steps: [
          'Check the model’s stated materials and construction. Do not assume a top is solid wood or that an included pickup has a particular feature.',
          'Ask what setup or inspection is included, which strings are fitted and whether the instrument is ready for your intended tuning.',
          'Check case or bag inclusion, then budget for the accessories you actually need, such as a tuner and picks. Avoid buying duplicates of included items.',
          'Confirm availability, total price, shipping or appointment collection, and the seller’s actual return and warranty terms.',
        ],
      },
      {
        title: 'An electric guitar can also be a first guitar',
        paragraphs: [
          'You do not have to learn on acoustic before playing electric. If electric guitar is the sound that interests you, compare that option too. Include a suitable listening setup in the budget and verify headphone support if quiet practice matters.',
          'Sattari lists steel-string acoustic, classical nylon-string and electric guitars. Use the product pages to compare the listed models, then contact the Woodland Hills shop about fit and availability. Visits are by appointment; a setup or string change is a separate service inquiry unless explicitly included.',
        ],
      },
    ],
    sources: [
      {
        label: 'Yamaha: nylon-string and steel-string guitar differences',
        url: 'https://hub.yamaha.com/guitars/g-acoustic/nylon-string-vs-steel-string-guitars/',
      },
      {
        label: 'Yamaha: acoustic guitar buying guide',
        url: 'https://www.yamaha.com/US/houseofworship/downloadables/How-to-Choose-Guides/how-to-choose-an-acoustic-guitar-updated.pdf',
      },
      {
        label: 'Córdoba: string compatibility questions',
        url: 'https://cordobaguitars.com/support/faq/',
      },
    ],
    related: [
      '/product/steel-string-acoustic-guitar',
      '/product/classic-nylon-string-guitar',
      '/product/flame-stratocaster-electric-guitar',
      '/guides/when-does-my-guitar-need-a-setup',
      '/services/guitar-setup-los-angeles',
      '/guitar-strings-woodland-hills',
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
      '/guides/when-does-my-guitar-need-a-setup',
      '/services/guitar-restringing-woodland-hills',
      '/guitar-strings-woodland-hills',
      '/services/guitar-setup-los-angeles',
      '/services/instrument-repair-los-angeles',
    ],
  },
];
