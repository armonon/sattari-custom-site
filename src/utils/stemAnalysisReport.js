export function stemAnalysisReport(job) {
  return {
    format: 'sattari-musical-analysis',
    version: 1,
    track: job.file.name,
    song: job.analysis || null,
    stems: job.outputs.map(({ id, name, analysis }) => ({
      id,
      file: name,
      analysis: analysis || null,
    })),
    notes: [
      'Key and tempo are estimates, not a transcription or calibrated confidence scores.',
      'Key uses the browser port of Sattari AutoKey SongKeyEstimator. Prominent notes use a separate pitch-class estimate; pulse uses onset-based tempo tracking.',
      'AutoKey scans the full audio. Prominent notes, tonal-evidence checks and tempo sample up to three 20-second sections. Peak and RMS cover the full audio.',
      'AutoKey keyConfidence is the raw top-two correlation margin, not a probability. Matches below 0.10 are tentative. keyAlternative is the runner-up, not a detected key change.',
      'Prominent notes are pitch classes, not a melody or chord progression. Drums are not assigned a key.',
      'Relative keys and half/double-time pulse are ambiguous, especially on isolated stems.',
      'Sample rate describes decoded working audio, not the original file encoding. Levels are dBFS, not LUFS; null levels indicate silence.',
    ],
  };
}
