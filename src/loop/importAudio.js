export function validateSongFile(file) {
  if (!file) return '';
  if (!(file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|flac|aac|webm)$/i.test(file.name)))
    return 'Choose an audio file: MP3, WAV, M4A, OGG or FLAC.';
  if (file.size > 40 * 1024 * 1024) return 'Choose a file smaller than 40 MB.';
  if (!file.size) return 'This file is empty. Choose a recording with audio.';
  return '';
}

// Some stereo exports have opposite polarity. Preserve the strongest channel
// when averaging would erase the performance; sanitize non-finite samples too.
export function analysisMono(buffer) {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i)
  );
  const energies = channels.map(() => 0),
    mono = new Float32Array(buffer.length);
  let mixEnergy = 0;
  for (let i = 0; i < mono.length; i++) {
    let sum = 0;
    channels.forEach((channel, c) => {
      const v = Number.isFinite(channel[i]) ? channel[i] : 0;
      sum += v;
      energies[c] += v * v;
    });
    mono[i] = sum / channels.length;
    mixEnergy += mono[i] ** 2;
  }
  const strongest = Math.max(...energies);
  if (mixEnergy < strongest * 0.05) {
    const channel = channels[energies.indexOf(strongest)];
    for (let i = 0; i < mono.length; i++) mono[i] = Number.isFinite(channel[i]) ? channel[i] : 0;
  }
  return mono;
}
