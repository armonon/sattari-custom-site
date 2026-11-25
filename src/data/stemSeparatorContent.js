export const separatorGuides = [
  {
    slug: 'remove-vocals-for-karaoke',
    title: 'Remove vocals from a song for karaoke',
    linkLabel: 'Karaoke & vocal removal',
    category: 'Backing tracks',
    description:
      'Make a vocal backing track on your device: separate the song, mute the vocal, loop a section, and download drums + bass + other instruments as one WAV.',
    answer:
      'In Sattari Stem Separator choose Vocal backing track, add the song and press Separate. When it is ready the player already has the vocal muted. Listen, adjust levels if needed, then press Download my mix to save drums + bass + other instruments as one WAV. Other instruments alone is not the full backing track: it leaves out bass and drums.',
    image: '/images/tools/separator.jpg',
    imageAlt: 'Sattari Stem Separator showing downloadable stem results from its practice demo',
    action: { label: 'Make a vocal backing track', path: '/stem-separator?goal=vocal-backing' },
    sections: [
      {
        title: 'Keep the band. Take the lead.',
        paragraphs: [
          'A vocal-free backing track gives you room to rehearse a melody, test harmonies or prepare a performance. Start with an audio file you own or have permission to process. Use a clean source rather than a phone recording of a speaker; distortion and room sound make separation harder.',
          'Sattari accepts audio files, not YouTube or streaming-service links. WAV, MP3, FLAC, M4A, AAC and OGG decoding depends on your browser. If your file will not open, export it as PCM WAV in your audio software instead of changing its filename extension.',
        ],
      },
      {
        title: 'Build your vocal backing track',
        steps: [
          'Open Stem Separator and choose Vocal backing track under “What are you making?”. All four parts are separated so you can still bring the vocal back as a guide.',
          'Add the song (or try the 8-second example first) and press Separate. The first run downloads the 172 MB model; later runs reuse it from the browser cache.',
          'When the song is ready, press Play. Vocals is muted and Drums, Bass and Other instruments play together on one clock. Use Original song to compare with the untouched recording.',
          'Rehearse a hard phrase with the A–B loop: press Set A at the start of the phrase and Set B at its end. Clear loop returns to the full song.',
          'Watch the Mix peak readout. If it goes above 0 dBFS, lower the master or tick Prevent clipping, which lowers the whole mix to a −1 dBFS peak and says by how much.',
          'Press Download my mix. You get one full-length WAV (32-bit float by default, or 24-bit) named like song-no-vocals-mix.wav, rendered from exactly the parts and levels you hear.',
        ],
      },
      {
        title: 'Want an acapella instead?',
        paragraphs: [
          'Choose Solo a part and pick Vocals, or press the headphones button on the Vocals lane. Download my mix then renders just the vocal. It is useful for hearing phrasing, breaths and lyric timing. It is not guaranteed to separate a lead singer from backing vocals, and some instruments or reverb may remain audible.',
          'Under Custom you can keep only the Vocals stem to save memory, but the model still computes all four parts internally, so it is not faster.',
        ],
      },
      {
        title: 'What a vocal remover does not do',
        paragraphs: [
          'Sattari estimates parts from a finished recording; it does not recover the original studio multitracks. Vocal bleed, missing harmonics and watery artifacts can remain. Compare against the original and keep a reference copy before editing.',
          "Stem Separator does not generate synchronized lyrics, change the song's speed or move it to your singing key. Check the key in Key & BPM if you need it. Separation also does not grant permission to publish, distribute or perform someone else's recording.",
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
      'Make a drumless practice track on your device: solo the drums to learn the part, loop a fill, then download vocals + bass + other instruments as one WAV.',
    answer:
      'Choose Drum practice in Sattari Stem Separator and separate the song. The player mutes Drums and plays Vocals, Bass and Other instruments together. Solo the drums to study the part, then press Download my mix for a single drumless WAV to play along with.',
    image: '/images/tools/separator.jpg',
    imageAlt: 'The drum stem and playback controls in Sattari Stem Separator',
    action: { label: 'Make a drumless practice track', path: '/stem-separator?goal=drum-practice' },
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
          'Open Stem Separator, choose Drum practice and add a recording you have permission to use. Press Separate. The song and its stems are saved in this browser, but download anything you need to keep.',
          'Press Play. Drums is muted; the other three parts share one clock, so muting, soloing or changing a level never pulls them out of time. Press the headphones button on Drums to hear the part alone.',
          'Loop the fill or groove you are learning: Set A at its start, Set B at its end. Playback stays inside the loop until you press Clear loop.',
          'Press Download my mix for one WAV of vocals + bass + other instruments, full length and aligned to the original. The file name ends in -drumless-mix.wav.',
          'When the player finds a steady pulse, you can turn on a four-beat count-in or a practice click. The downloaded mix contains the selected stems. Use the first clear downbeat as your entry point when playing the WAV.',
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
          'Use the estimated BPM as a starting point and count along to check it. A busy drum pattern may produce a double-time estimate; a sparse groove may suggest half-time. In Key & BPM you can switch the value to half or double time, or tap the tempo yourself. That changes the label you keep, not the speed of the audio.',
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
    title: "Find a song's key & BPM and fix half/double time",
    linkLabel: 'Song key & BPM',
    category: 'Song analysis',
    description:
      "Estimate a song's key, Camelot code and BPM, listen back, fix half- or double-time tempo, tap the beat, and save both the estimate and your correction.",
    answer:
      'Add a song to Sattari Key & BPM. It measures the key, Camelot code and tempo on your device without separating anything. Press play to check the result by ear, use the adjust button to pick half or double time, tap the tempo or choose another key, and export a CSV or report that keeps the detected value and your correction side by side.',
    image: '/images/tools/separator.jpg',
    imageAlt: 'Sattari Stem Separator workspace used to separate and analyze audio files',
    action: { label: 'Open Key & BPM', path: '/studio/keybpm' },
    sections: [
      {
        title: 'Read the full song before the individual parts',
        paragraphs: [
          'The full mix gives the analyzer more harmonic and rhythmic context than a sparse vocal or bass line. Begin with its estimated key and BPM, then compare the selected stem results. A different stem estimate is not proof that the musicians are playing in different keys or at different speeds.',
          'Sattari AutoKey scans the full audio for an overall key; it does not map key changes. Tempo analysis samples up to three 20-second windows, so tempo changes can fall outside those windows. The report cannot map every section or replace careful listening.',
        ],
      },
      {
        title: 'Key is a suggestion, not a verdict',
        paragraphs: [
          'A key estimate summarizes the tonal pattern the analyzer hears. Relative keys share a key signature. C major and A natural minor use the same seven notes, but C and A feel like different points of rest. In A minor, a phrase may also use G-sharp to lead back to A. Repeated notes, unusual tunings and separation artifacts can also affect the estimate.',
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
        title: 'Check and correct a result in Key & BPM',
        steps: [
          'Add one song or a folder. Each file is decoded and measured on this device, one at a time. Stop keeps finished rows; Resume continues the rest.',
          'Press the play button on a row to hear the original audio while you read the result. Rows opened from a saved report have no audio; add the source file again to listen.',
          'Read the flags. Tentative means the best key only narrowly beat the alternative shown in Notes. Rough means the strict tempo estimator declined and a single middle section was used.',
          'Press the adjust button. Under Tempo choose Half time or Double time if the count feels wrong, tap along with Tap (three taps or more), or type a value from 20 to 400 BPM.',
          'Under Key, pick the alternative or any of the 24 keys. The Camelot code follows your choice. Reset to detected removes your corrections.',
          'Export CSV or Save report. The detected key and BPM stay in their original columns; your corrections appear in separate “Corrected” columns. A corrected BPM is a label: the audio is not stretched or transposed.',
        ],
      },
      {
        title: 'Keep an analysis report with your stems',
        steps: [
          'In Stem Separator, each song and stem also gets a key and tempo estimate. Read the evidence labels as well as the numbers, or send the song, a stem or your rendered mix to Key & BPM with Check key & BPM.',
          'Open the analysis details to review duration, working sample rate, channels, sample peak and RMS levels. Those audio levels are measured across the audio, unlike the sampled musical analysis.',
          'Download the JSON analysis report for a machine-readable record. The stem ZIP includes the report too. Saved songs survive a reload in this browser, but the browser can clear that storage, so keep downloads of anything important.',
          'Use the findings to pick a practice starting point in Learn or organize a Studio session. Verify the musical choices by ear before building an arrangement around them.',
        ],
      },
    ],
    related: [
      '/studio/keybpm',
      '/tools/stem-separator',
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
      'Drop several audio files into Sattari Stem Separator, choose the stem types once, and start the queue. Tracks process one after another on your device. Download individual WAVs, a song ZIP, an all-songs ZIP or a rendered practice mix; finished songs are also saved in this browser.',
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
          'Choose what you are making (all parts, a vocal backing track, drum or bass practice), or pick stems under Custom. Other instruments contains remaining sounds such as guitar and keys, not the entire non-vocal mix.',
          'Start separation and keep the page open. The initial model download is approximately 172 MiB; a later run can reuse the model when the browser cache is available.',
          'Open any finished song in the player, download stems, a song ZIP, an all-songs ZIP or a rendered mix. Retrying a failed song keeps every finished one.',
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
        title: 'Local processing, browser-saved results',
        paragraphs: [
          'The separator processes your source audio on your device rather than uploading it for separation. The app still needs network access to load and to download its model from Hugging Face. Normal hosting requests are distinct from sending a song to a processing service.',
          'The current tool is free and does not require sign-in. CPU processing can be slow, and GPU acceleration is attempted only where available. There is no all-browser speed guarantee. Finished songs and stems are saved in this browser so a reload does not lose them, and Clear saved work removes them. Browser storage can be evicted, so it is not a backup: download what you need.',
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
    question: 'Does Other instruments mean a complete instrumental backing track?',
    answer:
      'No. Other instruments is the remaining source group, including sounds such as guitar and keys. For a vocal-free backing track choose Vocal backing track, which plays Drums + Bass + Other instruments, then press Download my mix for one WAV. The ZIP still contains the separate stems.',
  },
  {
    question: 'Can I isolate guitar, piano, kick or snare separately?',
    answer:
      'Not with the current four-source model. Guitar and piano generally share Other instruments; kick, snare and cymbals share Drums. Vocals can include both lead and backing singers. Separation estimates can contain leakage between groups.',
  },
  {
    question: 'Can I paste a YouTube, Spotify or other streaming link?',
    answer:
      'No. Add an audio file that you own or have permission to process. Streaming links and protected downloads are not supported. A supported extension does not guarantee that your browser can decode the codec inside the file.',
  },
  {
    question: 'Why do the song and its stems show different key or BPM estimates?',
    answer:
      'Individual parts contain less context. Sparse notes, relative major/minor ambiguity and half-time or double-time pulses can change the estimate. Sattari AutoKey scans the whole stem; tempo samples up to three 20-second windows. Neither is a full transcription or section map. Drum stems are not assigned a key.',
  },
  {
    question: 'Are my songs uploaded or my stems saved automatically?',
    answer:
      'Source audio is processed on your device, not uploaded for separation. Loading the site and downloading its model still use the network. Finished songs and stems are saved in this browser (IndexedDB) so a reload does not lose them; Clear saved work removes them. Browsers can evict that storage, so download the WAVs, ZIPs or mixes you want to keep.',
  },
];
