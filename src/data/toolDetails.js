export const toolDetails = {
  'stem-separator': {
    key: 'separator',
    name: 'Sattari Stem Separator',
    path: '/stem-separator',
    status: 'Beta',
    description:
      'Separate songs into vocals, drums, bass and other instruments locally. Compare supported files, limits, privacy and real output before starting.',
    summary:
      'Extract vocals, drums, bass and other instruments from one track or a batch, with estimated song and stem keys, tempo, prominent notes and audio levels.',
    screenshot: '/images/tools/separator.jpg',
    screenshotCaption:
      'Actual completed HTDemucs separation of the original Sattari synthetic demo into bass and drums. The audio below is the real output from this run, not hand-isolated source tracks.',
    facts: [
      [
        'Input',
        'WAV, MP3, FLAC, M4A, AAC and OGG when the browser can decode the codec. Mono or stereo files only; no streaming links or DRM-protected audio.',
      ],
      [
        'Output',
        '44.1 kHz, 32-bit float stereo WAV. Individual stems, per-track ZIP and batch ZIP. Instruments is the other source, excluding vocals, drums and bass.',
      ],
      [
        'Musical analysis',
        'On-device Sattari AutoKey and pulse estimates for the song and selected stems, prominent pitch classes, duration, sample peak and RMS levels. Download an analysis JSON report separately or in the ZIP. AutoKey and levels cover the full audio; note summaries, tonal-evidence checks and tempo sample up to three 20-second sections.',
      ],
      [
        'Limits',
        '20 tracks; 100 MiB per file; 300 MiB total source files; 10 minutes per track; 512 MiB of retained outputs. The queue processes sequentially.',
      ],
      [
        'Browser',
        'Requires JavaScript, Web Audio, Web Workers and WebAssembly. Desktop recommended. WebGPU is attempted with CPU fallback during initialization; acceleration and speed depend on hardware.',
      ],
      [
        'Privacy',
        'Source audio is not uploaded. An approximately 172 MiB model is downloaded from Hugging Face on first use and cached when available. The model host receives a normal download request, not your song.',
      ],
      [
        'Price',
        'The current browser tool is free to use, with no sign-in or payment step. Your own internet and device costs still apply.',
      ],
      [
        'Storage',
        'Results are temporary for this page session. Download before leaving or reloading. Model caching does not save your finished stems.',
      ],
      [
        'Limitations',
        'AI estimates may contain bleed and artifacts. All four sources are computed even when fewer outputs are selected. This is not recovery of the original studio multitracks. Musical analysis is approximate, not a transcription: sparse stems, relative keys, tempo changes and half/double-time pulses can be ambiguous. No key is assigned to drums; weak estimates may remain undetermined.',
      ],
    ],
    demo: [
      'Download the original eight-second demo below.',
      'Add it to Stem Separator and choose Bass and Drums, or all four stems.',
      'Run separation and compare the returned parts with the original. This synthetic sample tests the workflow, not vocal-isolation quality.',
    ],
    guides: [
      'how-to-separate-vocals-drums-bass',
      'remove-vocals-for-karaoke',
      'make-drumless-practice-tracks',
      'find-song-key-and-bpm',
      'batch-separate-audio-stems',
      'practice-bass-with-isolated-stems',
    ],
  },
  studio: {
    key: 'studio',
    name: 'Sattari Studio',
    path: '/studio',
    status: 'Alpha',
    description:
      'Evaluate the StemDeck browser workspace: four decks, arrangements, instruments and recording. See real screenshots, supported audio, storage and limitations.',
    summary:
      'A browser-based StemDeck workspace for four-deck mixing, audio and instrument arrangements, live input, and exports.',
    screenshot: '/images/tools/studio.jpg',
    screenshotCaption:
      'Actual Sattari Studio browser workspace with the original demo loaded. No desktop-app mockup.',
    facts: [
      [
        'Input',
        'Local audio files supported by your browser decoder. PCM WAV is the simplest interchange option. Import stem files into lanes; use the separate Stem Separator for AI extraction.',
      ],
      [
        'Output',
        'Arrangement WAV exports, recordings and downloadable project backups. Recording containers depend on browser MediaRecorder support; they are not always WAV.',
      ],
      [
        'Browser',
        'JavaScript, Web Audio and local browser storage required. Use a current desktop browser for the full workspace. Microphone access requires HTTPS and permission; Web MIDI and audio-output selection are not available in every browser.',
      ],
      [
        'Privacy',
        'Imported audio and project assets are processed locally. Sessions and the music library use storage in this browser, not a cloud account.',
      ],
      [
        'Price',
        'The current alpha workspace is free to use without a paid account. No subscription or export payment is required by this build.',
      ],
      [
        'Storage',
        'Local saves are device-, browser- and site-specific. Clearing site data or using private browsing can lose them. Download portable project backups and verify important exports.',
      ],
      [
        'Limitations',
        'This is a browser port, not a guarantee of native StemDeck feature parity. It does not host arbitrary VST/AU plugins or provide cloud collaboration. Long sessions depend on memory, available storage and device performance.',
      ],
      [
        'Musical estimates',
        'Tempo and key analysis are estimates. Generated instrument templates are not audio-to-MIDI transcription. Listen and check timing before relying on automatic synchronization.',
      ],
    ],
    demo: [
      'Download the original demo below and import it into an empty deck.',
      'Start playback, adjust a channel level, and stop. Use the Arrange workspace to build a short arrangement.',
      'Export a short WAV and listen back. Save a project backup before clearing browser data.',
    ],
    guides: ['practice-bass-with-isolated-stems'],
  },
  learn: {
    key: 'learn',
    name: 'Sattari Learn',
    path: '/learn',
    status: 'Preview',
    description:
      'Learn guitar with a guided song library, audio and score imports, chord charts, tablature, sheet music and microphone feedback.',
    summary:
      'Pick a song, get to know the notes and chords, then practice one phrase at a time. Build confidence with slower examples, visual finger guides and a daily session.',
    screenshot: '/images/tools/learn-guitar.jpg',
    screenshotCaption:
      'The Sattari Learn song library and practice player. Starter lessons use short authored arrangements; uploaded audio produces an editable guide to review before practicing.',
    screenshotWidth: 1280,
    screenshotHeight: 900,
    facts: [
      [
        'Input',
        'Choose a starter lesson, upload an audio file, or import a Guitar Pro or MusicXML score. Audio imports support files up to 40 MB and eight minutes. Streaming-service links are not supported.',
      ],
      [
        'Song guides',
        'Explore chord charts, tablature, standard notation and animated finger guides. Audio analysis estimates key, tempo and notes; listen and correct the guide before practicing. Score imports currently support constant tempo and 4/4.',
      ],
      [
        'Practice',
        'Select a passage, slow it down, choose essentials or full notes, and work through pitch and rhythm exercises. A 12-step beginner path, daily sessions, suggested drills and local recorded takes help you revisit difficult phrases.',
      ],
      [
        'Guitar setup',
        'Choose right- or left-handed diagrams, standard, Drop D or DADGAD tuning, and a capo position. Suggested positions should always be checked for comfortable playability.',
      ],
      [
        'Browser',
        'JavaScript and Web Audio are required. Microphone feedback requires permission and HTTPS or localhost. Start in a current desktop browser with headphones and a quiet room.',
      ],
      [
        'Privacy',
        'Audio analysis and microphone processing run on your device. Optional analysis models are downloaded when selected. Recordings and attached lesson videos stay in local browser storage.',
      ],
      [
        'Price',
        'The current Learn preview is free to use without signing in. It is separate from booking a lesson with a teacher.',
      ],
      [
        'Storage',
        'Imported lessons, guitar settings, practice history and saved takes remain in this browser. Download a Learn backup to keep them or restore on another device. Restores add missing entries and keep existing data. There is no automatic cloud sync.',
      ],
      [
        'Limitations',
        'A finished mix can confuse note and chord estimates and cannot reliably isolate guitar alone. Single-note feedback works best on clear, steady notes. Whole-chord checking is experimental; feedback is a practice aid, not a complete performance assessment.',
      ],
    ],
    demoTitle: 'Try a starter lesson',
    demoDescription:
      'An authored guitar arrangement of Ode to Joy at 88 BPM, with synthesized reference audio. The lesson notes, tabs and practice targets come from the same arrangement.',
    demoAudio: '/audio/loop-ode-to-joy.wav',
    demoLabel: 'Sattari Learn Ode to Joy reference',
    demo: [
      'Open Learn and choose Ode to Joy from the song library.',
      'Explore the notes, chord charts and finger guides. Select a short passage and choose an easier version if you need one.',
      'Choose Practice this song. Follow microphone setup for live feedback, or explore without a microphone. Hear the phrase, play slowly, then try it in time.',
    ],
    guides: ['learn-guitar-from-a-song', 'how-to-separate-vocals-drums-bass'],
  },
};
