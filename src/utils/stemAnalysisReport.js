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
      'Key and prominent notes use chroma profiles; pulse uses onset-based tempo tracking.',
      'Musical estimates sample up to three 20-second sections. Peak and RMS cover the full audio.',
      'Prominent notes are pitch classes, not a melody or chord progression. Drums are not assigned a key.',
      'Relative keys and half/double-time pulse are ambiguous, especially on isolated stems.',
      'Sample rate describes decoded working audio, not the original file encoding. Levels are dBFS, not LUFS; null levels indicate silence.',
    ],
  };
}
