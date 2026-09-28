export const separatorGuides = [
  {
    slug: 'remove-vocals-for-karaoke',
    title: 'Remove vocals from a song for karaoke',
    linkLabel: 'Karaoke & vocal removal',
    category: 'Backing tracks',
    description:
      'Make a karaoke backing track with Sattari: separate vocals, keep drums, bass and instruments, then combine the WAV stems. Free, on-device vocal removal.',
    answer:
      'To make an estimated karaoke backing track, select Drums, Bass and Instruments in Sattari Stem Separator. Download those three WAV files and align their starts in Studio. Instruments alone is not the full backing track: it leaves out bass and drums.',
    image: '/images/tools/separator.jpg',
    imageAlt: 'Sattari Stem Separator showing downloadable stem results from its practice demo',
    action: { label: 'Open vocal remover', path: '/stem-separator' },
    sections: [
      {
        title: 'Keep the band. Take the lead.',
        paragraphs: [
          'A vocal-free backing track gives you room to rehearse a melody, test harmonies or prepare a performance. Start with an audio file you own or have permission to process. Use a clean source rather than a phone recording of a speaker; distortion and room sound make separation harder.',
          'Sattari accepts audio files, not YouTube or streaming-service links. WAV, MP3, FLAC, M4A, AAC and OGG decoding depends on your browser. If your file will not open, export it as PCM WAV in your audio software instead of changing its filename extension.',
        ],
      },
      {
        title: 'Build your non-vocal mix',
        steps: [
          'Add the song to Stem Separator. Choose Drums, Bass and Instruments. Also choose Vocals if you want an isolated singing reference for rehearsal.',
          'Run separation and preview the results. Listen through a verse and chorus, especially reverb tails and passages with backing singers.',
          'Download the three backing stems as WAV files. The track ZIP packages separate files; it does not automatically mix them into one karaoke file.',
          'Import the WAV files into separate arrangement lanes in Sattari Studio. Align their starts at the same position, leave the vocal out, and listen for clipping before exporting your mix.',
        ],
      },
      {
        title: 'Want an acapella instead?',
        paragraphs: [
          'Select Vocals to retain the estimated vocal stem. This is useful for hearing phrasing, breaths and lyric timing in context. It is not guaranteed to separate a lead singer from backing vocals, and some instruments or reverb may remain audible.',
          'Selecting only Vocals saves result memory, but the model still computes its four source groups internally. A smaller output selection is not a promise of faster processing.',
        ],
      },
      {
        title: 'What a vocal remover does not do',
        paragraphs: [
          'Sattari estimates parts from a finished recording; it does not recover the original studio multitracks. Vocal bleed, missing harmonics and watery artifacts can remain. Compare against the original and keep a reference copy before editing.',
          "Stem Separator does not generate synchronized lyrics or automatically change a song to your singing key. These downloads are practice and production ingredients, not a complete karaoke player. Separation also does not grant permission to publish, distribute or perform someone else's recording.",
        ],
      },
    ],
    related: [
      '/tools/stem-separator',
      '/tools/studio',
      '/guides/find-song-key-and-bpm',
      '/guides/how-to-separate-vocals-drums-bass',
    ],
  },
  {
    slug: 'make-drumless-practice-tracks',
    title: 'Make drumless tracks for drum practice',
    linkLabel: 'Drumless practice tracks',
    category: 'Drum practice',
    description:
      'Turn a song into a drumless practice track. Isolate the drums as a reference, combine the remaining stems, and rehearse grooves, fills and transitions.',
    answer:
      'Separate all four stems. Use Drums as your listening reference, then combine Vocals, Bass and Instruments with aligned starts for an estimated drumless backing track. Play the part yourself and compare your timing with the original drummer.',
    image: '/images/tools/separator.jpg',
    imageAlt: 'The drum stem and playback controls in Sattari Stem Separator',
    action: { label: 'Separate a drum practice track', path: '/stem-separator' },
    sections: [
      {
        title: 'Hear the drummer, then become the drummer',
        paragraphs: [
          'Listen to the complete song first. Notice the pulse, where the backbeat lands, and how the drummer changes between sections. Then solo the Drums stem to hear details that are easy to miss under vocals or guitars. Keep the original nearby: an isolation artifact can sound like a note that was never played.',
          'The Drums output is one combined estimate. It does not provide separate kick, snare, hi-hat or cymbal tracks. Other percussion may also appear in it, and some drum sound can leak into the remaining stems.',
        ],
      },
      {
        title: 'Make the backing track',
        steps: [
          'Upload a recording you have permission to use and select All stems. Separate the track and download the four WAV outputs before leaving the page.',
          'Import Vocals, Bass and Instruments into separate Studio arrangement lanes. Line up the starts exactly. Do not trim silence from only one file, because the parts can drift out of alignment.',
          'Keep the Drums file available as a reference, but mute it when playing your own part. Preview the combined backing and check levels before exporting.',
          'Choose a short section and listen for an unmistakable entry point. The separator does not automatically add a spoken count-in or click track.',
        ],
      },
      {
        title: 'A 12-minute rehearsal',
        steps: [
          'Minutes 0-3: count the pulse and tap the main rhythm while listening. Identify the phrase ending and the first beat of the next phrase.',
          'Minutes 3-6: play a simple groove with the isolated bass and the rest of the band. Keep the pulse steady before copying every fill.',
          'Minutes 6-9: practice one transition. Play through the last bar of the verse and the first bar of the chorus without stopping.',
          'Minutes 9-12: play against the drumless mix. Compare one detail with the reference, such as a cymbal accent, a rest or the placement of the backbeat.',
        ],
      },
      {
        title: 'Let the song decide the tempo',
        paragraphs: [
          'Use the estimated BPM as a starting point and count along to check it. A busy drum pattern may produce a double-time estimate; a sparse groove may suggest half-time. That disagreement does not necessarily mean the audio is playing at a different speed.',
          'A song recorded without a click can change tempo. One BPM number will not describe every bar. Practice listening to the band and returning from fills in time rather than forcing the entire recording to match an uncertain estimate.',
        ],
      },
    ],
    related: [
      '/guides/find-song-key-and-bpm',
      '/guides/practice-bass-with-isolated-stems',
      '/tools/studio',
      '/shop/cymbals',
    ],
  },
  {
    slug: 'find-song-key-and-bpm',
    title: "Find a song's key and BPM from audio",
    linkLabel: 'Song key & BPM',
    category: 'Song analysis',
    description:
      "Estimate a song's key and BPM in Sattari Stem Separator. Compare stem keys, prominent notes and pulse, understand uncertain results, and export an analysis report.",
    answer:
      "Add a song to Sattari Stem Separator and run separation. Its analysis estimates the original song's key and BPM, then analyzes the selected stems. Treat the results as listening clues, not a verified chord chart or transcription.",
    image: '/images/tools/separator.jpg',
    imageAlt: 'Sattari Stem Separator workspace used to separate and analyze audio files',
    action: { label: 'Analyze a song', path: '/stem-separator' },
    sections: [
      {
        title: 'Read the full song before the individual parts',
        paragraphs: [
          'The full mix gives the analyzer more harmonic and rhythmic context than a sparse vocal or bass line. Begin with its estimated key and BPM, then compare the selected stem results. A different stem estimate is not proof that the musicians are playing in different keys or at different speeds.',
          'Musical analysis samples up to three 20-second windows, not every note in the track. A key change, a tempo change or an unusual introduction can fall outside those windows. The report cannot map every section or replace careful listening.',
        ],
      },
      {
        title: 'Key is a suggestion, not a verdict',
        paragraphs: [
          'A key estimate summarizes the tonal pattern the analyzer hears. Relative major and minor keys share the same pitch collection, so a result can favor one even when the other feels like home. Repeated notes, unusual tunings and separation artifacts can also affect the estimate.',
          'Prominent notes are pitch classes, not a melody, a bass transcription or a list of chords in time. Try the suggested home note on your instrument and compare it with the ends of phrases. If the result disagrees with the recording, trust a listening check over a confident-looking label.',
          'Drum stems are not assigned a musical key. Weak or unsuitable tonal material can be shown as undetermined instead of receiving a useful key estimate.',
        ],
      },
      {
        title: 'BPM versus detected pulse',
        paragraphs: [
          'BPM means beats per minute. The analyzer looks for a repeating pulse, which may correspond to the beat, half the beat rate or twice it. For example, a pattern that feels like 80 BPM may generate an estimate around 160 BPM.',
          'Count steady beats along with the original, then check which interpretation matches the phrasing. A vocal line with long gaps is a weak tempo reference; the drum stem often supplies clearer rhythmic information. Estimates do not create a beat grid or guarantee that a song stays at one tempo.',
        ],
      },
      {
        title: 'Keep an analysis report with your stems',
        steps: [
          'Run separation and inspect the original-song summary and each selected stem. Read the evidence labels as well as the key and tempo numbers.',
          'Open the analysis details to review duration, working sample rate, channels, sample peak and RMS levels. Those audio levels are measured across the audio, unlike the sampled musical analysis.',
          'Download the JSON analysis report for a machine-readable record. The stem ZIP includes the report too. Save your outputs before closing or leaving the separator.',
          'Use the findings to pick a practice starting point in Learn or organize a Studio session. Verify the musical choices by ear before building an arrangement around them.',
        ],
      },
    ],
    related: [
      '/tools/stem-separator',
      '/tools/learn',
      '/guides/practice-bass-with-isolated-stems',
      '/guides/make-drumless-practice-tracks',
    ],
  },
  {
    slug: 'batch-separate-audio-stems',
    title: 'Batch separate songs into audio stems',
    linkLabel: 'Batch separation',
    category: 'Audio workflow',
    description:
      'Batch separate up to 20 songs into vocals, drums, bass and instruments. Check file limits, browser support and privacy, then download WAV stems and ZIPs.',
    answer:
      "Drop several audio files into Sattari Stem Separator, choose the stem types once, and start the queue. Tracks process one after another on your device. Download individual WAVs, one track's ZIP, or a ZIP of completed tracks before leaving.",
    image: '/images/tools/separator.jpg',
    imageAlt: 'Sattari Stem Separator with its shared stem selection and track queue',
    action: { label: 'Start a stem batch', path: '/stem-separator' },
    sections: [
      {
        title: 'A queue, not twenty simultaneous jobs',
        paragraphs: [
          'Batch separation saves you from starting every file manually. Add the songs, choose the outputs and let the queue work sequentially. The selected outputs apply to the tracks in that run; this is not a separate instrument preset for every queued song.',
          'The current limits are 20 queued tracks, 100 MiB per source file, 300 MiB of source files in total and ten minutes per track. Input audio must be mono or stereo. Output is 44.1 kHz stereo, 32-bit floating-point WAV, even when the input is a compressed format such as MP3.',
        ],
      },
      {
        title: 'Prepare a manageable batch',
        steps: [
          'Begin with one short file to check that your browser can decode it and run the model. Desktop use is recommended; device memory and available acceleration affect performance.',
          'Name the source files distinctly so their downloads are easy to recognize. Add your remaining files within the queue and size limits.',
          'Select Vocals, Drums, Bass, Instruments or all four. Instruments contains remaining sounds such as guitar and keys, not the entire non-vocal mix.',
          'Start separation and keep the page open. The initial model download is approximately 172 MiB; a later run can reuse the model when the browser cache is available.',
          'Preview completed stems, download them and clear completed tracks when needed. Check any failed file individually before trying it again.',
        ],
      },
      {
        title: 'Why a small MP3 can make a large result',
        paragraphs: [
          'Compressed input size does not predict the memory needed for uncompressed WAV stems. Four stereo outputs can take much more space than one MP3. Sattari caps retained results at 512 MiB; this is not a guarantee that every device can comfortably handle a batch near that limit.',
          'When the output budget is reached, download and clear completed tracks before continuing. Selecting fewer stems reduces retained output, but the separation model still calculates all four source groups internally. It does not become a vocals-only or bass-only model.',
        ],
      },
      {
        title: 'Local processing, temporary results',
        paragraphs: [
          'The separator processes your source audio on your device rather than uploading it for separation. The app still needs network access to load and to download its model from Hugging Face. Normal hosting requests are distinct from sending a song to a processing service.',
          'The current tool is free and does not require sign-in. CPU processing can be slow, and GPU acceleration is attempted only where available. There is no all-browser speed guarantee. Results last for the current page session, so a cached model is not a backup of your songs or stems.',
        ],
      },
    ],
    related: [
      '/tools/stem-separator',
      '/privacy',
      '/guides/remove-vocals-for-karaoke',
      '/guides/find-song-key-and-bpm',
    ],
  },
];

export const separatorQuestions = [
  {
    question: 'Is Sattari Stem Separator free, with no sign-up?',
    answer:
      'The current browser tool is free and does not require an account or app installation. Your device supplies the processing power. The first run downloads an approximately 172 MiB model, and browser, memory and queue limits still apply.',
  },
  {
    question: 'Does Instruments mean a complete instrumental backing track?',
    answer:
      'No. Instruments is the remaining source group, including sounds such as guitar and keys. For a non-vocal backing track, combine Drums, Bass and Instruments with aligned starts. A ZIP contains separate stems, not an automatically mixed instrumental.',
  },
  {
    question: 'Can I isolate guitar, piano, kick or snare separately?',
    answer:
      'Not with the current four-source model. Guitar and piano generally share Instruments; kick, snare and cymbals share Drums. Vocals can include both lead and backing singers. Separation estimates can contain leakage between groups.',
  },
  {
    question: 'Can I paste a YouTube, Spotify or other streaming link?',
    answer:
      'No. Add an audio file that you own or have permission to process. Streaming links and protected downloads are not supported. A supported extension does not guarantee that your browser can decode the codec inside the file.',
  },
  {
    question: 'Why do the song and its stems show different key or BPM estimates?',
    answer:
      'Individual parts contain less context. Sparse notes, relative major/minor ambiguity and half-time or double-time pulses can change the estimate. Musical analysis samples up to three 20-second windows and is not a full transcription or tempo map. Drum stems are not assigned a key.',
  },
  {
    question: 'Are my songs uploaded or my stems saved automatically?',
    answer:
      'Source audio is processed on your device, not uploaded for separation. Loading the site and downloading its model still use the network. Results last only for the current page session: download your WAVs, ZIPs and analysis report before leaving or reloading.',
  },
];
