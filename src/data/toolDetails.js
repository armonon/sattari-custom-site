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
        'On-device key and pulse estimates for the song and selected stems, prominent pitch classes, duration, sample peak and RMS levels. Download an analysis JSON report separately or in the ZIP. Musical estimates sample up to three 20-second sections; levels cover the full audio.',
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
    guides: ['how-to-separate-vocals-drums-bass', 'practice-bass-with-isolated-stems'],
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
      'Explore what Sattari Learn can estimate from audio: key, tempo and representative chords, with practice ideas, a rhythm test, microphone and MIDI feedback.',
    summary:
      'Turn a local audio file into a starting point for practice: tempo and key estimates, representative chords, exercises and playable accompaniment.',
    screenshot: '/images/tools/learn.jpg',
    screenshotCaption:
      'Actual Learn analysis of the original demo. The reference run estimated C major and 117 BPM for an A minor, 120 BPM source: a concrete reminder to verify estimates by ear.',
    facts: [
      [
        'Input',
        'One local audio file at a time, using your browser audio decoder. PCM WAV is a useful fallback when another codec fails. Streaming links are not supported.',
      ],
      [
        'Analysis',
        'Estimated key and tempo, a waveform, section suggestions and four representative chord regions. Practice suggestions cover piano, guitar, bass and drums.',
      ],
      [
        'Practice',
        'Synthesized bass, drum and chord patterns in Arrange; tap-spacing feedback in Challenge; single-note microphone pitch and MIDI note feedback when supported.',
      ],
      [
        'Browser',
        'JavaScript and Web Audio required. A current desktop browser is the recommended starting point. Microphone permission requires HTTPS; Web MIDI requires browser support and a connected MIDI device.',
      ],
      [
        'Privacy',
        'Song analysis and microphone pitch detection run locally. Audio is not sent to a transcription server. Send to Studio stores the source and music map in local browser storage.',
      ],
      [
        'Price',
        'The current Learn preview is free to use without signing in. It is not a paid course or a teacher booking.',
      ],
      [
        'Storage',
        'Analysis is held for the current page session. Sending to Studio can retain local assets; it does not create an online backup.',
      ],
      [
        'Limitations',
        'Not a note-for-note transcription, automatic guitar tablature, complete curriculum or performance examiner. Four-region chords can miss changes. Quiet, monophonic notes work best for microphone pitch detection. Large files can exceed available memory.',
      ],
    ],
    demo: [
      'Download the original demo below and add it to Learn.',
      'Choose Analyze & teach and wait for the local analysis.',
      'Compare the estimates with the demo notes: A minor accompaniment at 120 BPM. Tempo may be interpreted at half or double time. Try Bass practice or Arrange next.',
    ],
    guides: ['practice-bass-with-isolated-stems', 'how-to-separate-vocals-drums-bass'],
  },
};
