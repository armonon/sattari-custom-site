// Small self-contained radix-2 Cooley-Tukey FFT. No third-party DSP library:
// Clean's spectral denoiser and spectrogram both need a real-valued STFT, and
// this is the whole engine they share. `re`/`im` are modified in place and
// must have a power-of-two length.
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wr = Math.cos(angle),
      wi = Math.sin(angle);
    for (let start = 0; start < n; start += len) {
      let curR = 1,
        curI = 0;
      for (let k = 0; k < half; k++) {
        const a = start + k,
          b = a + half;
        const ur = re[a],
          ui = im[a];
        const vr = re[b] * curR - im[b] * curI;
        const vi = re[b] * curI + im[b] * curR;
        re[a] = ur + vr;
        im[a] = ui + vi;
        re[b] = ur - vr;
        im[b] = ui - vi;
        const nr = curR * wr - curI * wi;
        const ni = curR * wi + curI * wr;
        curR = nr;
        curI = ni;
      }
    }
  }
}

/** Inverse FFT, in place, normalised by N. */
export function ifft(re, im) {
  const n = re.length;
  for (let i = 0; i < n; i++) im[i] = -im[i];
  fft(re, im);
  for (let i = 0; i < n; i++) {
    re[i] /= n;
    im[i] = -im[i] / n;
  }
}

export function nextPowerOfTwo(n) {
  let size = 1;
  while (size < n) size <<= 1;
  return size;
}

/** Periodic (DFT-even) Hann window: gives exact COLA reconstruction at hop = size/4. */
export function hannWindow(size) {
  const window = new Float64Array(size);
  for (let i = 0; i < size; i++) window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / size));
  return window;
}
