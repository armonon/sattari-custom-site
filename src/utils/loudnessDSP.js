// Stereo programme metering based on ITU-R BS.1770-5 Annexes 1 and 2.
// https://www.itu.int/rec/R-REC-BS.1770-5-202311-I
// Fixed 0.01 LU energy histogram bounds integration memory; boundary precision
// is 0.01 LU. This implementation is not an EBU-certified meter.
const loudness = (energy) => (energy > 0 ? -0.691 + 10 * Math.log10(energy) : null);
const peakDb = (peak) => (peak > 0 ? 20 * Math.log10(peak) : null);

export function kWeighting(rate) {
  const k = Math.tan((Math.PI * 1681.974450955533) / rate),
    q = 0.7071752369554196;
  const vh = 10 ** (3.999843853973347 / 20),
    vb = vh ** 0.4996667741545416;
  const a = 1 + k / q + k * k;
  const h = Math.tan((Math.PI * 38.13547087602444) / rate),
    hq = 0.5003270373238773;
  const ha = 1 + h / hq + h * h;
  return [
    [
      (vh + (vb * k) / q + k * k) / a,
      (2 * (k * k - vh)) / a,
      (vh - (vb * k) / q + k * k) / a,
      (2 * (k * k - 1)) / a,
      (1 - k / q + k * k) / a,
    ],
    [1, -2, 1, (2 * (h * h - 1)) / ha, (1 - h / hq + h * h) / ha],
  ];
}
class Biquad {
  constructor(coefficients) {
    this.c = coefficients;
    this.z1 = this.z2 = 0;
  }
  process(x) {
    const c = this.c,
      y = c[0] * x + this.z1;
    this.z1 = c[1] * x - c[3] * y + this.z2;
    this.z2 = c[2] * x - c[4] * y;
    return y;
  }
}
// Four-phase, 12-tap-per-phase interpolator from BS.1770 Annex 2.
const FIR = [
  [
    0.001708984375, 0.010986328125, -0.0196533203125, 0.033203125, -0.0594482421875,
    0.1373291015625, 0.97216796875, -0.102294921875, 0.047607421875, -0.026611328125,
    0.014892578125, -0.00830078125,
  ],
  [
    -0.0291748046875, 0.029296875, -0.0517578125, 0.089111328125, -0.16650390625, 0.465087890625,
    0.77978515625, -0.2003173828125, 0.1015625, -0.0582275390625, 0.0330810546875, -0.0189208984375,
  ],
  [
    -0.0189208984375, 0.0330810546875, -0.0582275390625, 0.1015625, -0.2003173828125, 0.77978515625,
    0.465087890625, -0.16650390625, 0.089111328125, -0.0517578125, 0.029296875, -0.0291748046875,
  ],
  [
    -0.00830078125, 0.014892578125, -0.026611328125, 0.047607421875, -0.102294921875, 0.97216796875,
    0.1373291015625, -0.0594482421875, 0.033203125, -0.0196533203125, 0.010986328125,
    0.001708984375,
  ],
];
export class ProgrammeMeter {
  constructor(rate) {
    if (!Number.isFinite(rate) || rate < 32000 || rate > 192000)
      throw Error('Loudness metering needs 32–192 kHz audio.');
    this.rate = rate;
    this.hop = Math.round(rate * 0.02);
    this.reset();
  }
  reset() {
    // Reset measurements, not the continuous signal. Zeroing FIR/IIR history
    // mid-wave invents an onset transient and a false held true-peak maximum.
    if (!this.filters) {
      const coefficients = kWeighting(this.rate);
      this.filters = [
        coefficients.map((c) => new Biquad(c)),
        coefficients.map((c) => new Biquad(c)),
      ];
      // Mirrored ring avoids modulo in the 4x interpolation hot loop.
      this.history = [new Float64Array(24), new Float64Array(24)];
      this.historyAt = 0;
    }
    this.counts = new Float64Array(10001);
    this.energies = new Float64Array(10001);
    this.recent = new Float64Array(150);
    this.rangeCounts = new Float64Array(10001);
    this.rangeSum = this.rangeCount = 0;
    this.frames = this.filled = this.blocks = this.hops = this.sum = this.recentAt = 0;
    this.measurementFrames = this.activeFrames = 0;
    this.running = true;
    this.absoluteSum = this.absoluteCount = this.truePeak = this.samplePeak = this.invalid = 0;
    this.momentary = this.shortTerm = this.integrated = null;
    this.maxMomentary = this.maxShortTerm = this.loudnessRange = null;
  }
  setRunning(running) {
    this.running = !!running;
    this.activeFrames = 0;
  }
  process(left, right) {
    const length = left?.length || right?.length || 0;
    for (let i = 0; i < length; i++) {
      let energy = 0;
      for (let channel = 0; channel < 2; channel++) {
        // A single programme channel is measured as mono, not duplicated stereo.
        let sample = (channel ? right?.[i] : left?.[i]) ?? 0;
        if (!Number.isFinite(sample)) {
          sample = 0;
          this.invalid++;
        }
        this.samplePeak = Math.max(this.samplePeak, Math.abs(sample));
        const history = this.history[channel];
        history[this.historyAt] = history[this.historyAt + 12] = sample;
        let p0 = 0,
          p1 = 0,
          p2 = 0,
          p3 = 0;
        for (let tap = 0; tap < 12; tap++) {
          const value = history[this.historyAt + 12 - tap];
          p0 += FIR[0][tap] * value;
          p1 += FIR[1][tap] * value;
          p2 += FIR[2][tap] * value;
          p3 += FIR[3][tap] * value;
        }
        this.truePeak = Math.max(
          this.truePeak,
          Math.abs(p0),
          Math.abs(p1),
          Math.abs(p2),
          Math.abs(p3),
          Math.abs(sample)
        );
        const filtered = this.filters[channel][1].process(this.filters[channel][0].process(sample));
        energy += filtered * filtered;
      }
      this.historyAt = (this.historyAt + 1) % 12;
      this.sum += energy;
      this.frames++;
      if (this.running) {
        this.measurementFrames++;
        this.activeFrames++;
      }
      if (++this.filled === this.hop) this.finishHop();
    }
  }
  finishHop() {
    this.recent[this.recentAt] = this.sum / this.hop;
    this.recentAt = (this.recentAt + 1) % 150;
    this.hops++;
    this.blocks = Math.floor(this.hops / 5);
    this.filled = this.sum = 0;
    if (this.hops >= 20) {
      let energy = 0;
      for (let i = 1; i <= 20; i++) energy += this.recent[(this.recentAt - i + 150) % 150] / 20;
      this.momentary = loudness(energy);
      if (Number.isFinite(this.momentary))
        this.maxMomentary = Math.max(this.maxMomentary ?? -Infinity, this.momentary);
      if (this.running && this.activeFrames >= this.hop * 20 && this.hops % 5 === 0) {
        if (Number.isFinite(this.momentary) && this.momentary > -70) {
          const bin = Math.min(10000, Math.max(0, Math.floor((this.momentary + 70) * 100)));
          this.counts[bin]++;
          this.energies[bin] += energy;
          this.absoluteSum += energy;
          this.absoluteCount++;
        }
        const gate = Math.max(-70, (loudness(this.absoluteSum / this.absoluteCount) ?? -70) - 10);
        let sum = 0,
          count = 0;
        for (let i = Math.max(0, Math.ceil((gate + 70) * 100)); i < this.counts.length; i++) {
          sum += this.energies[i];
          count += this.counts[i];
        }
        this.integrated = count ? loudness(sum / count) : null;
      }
    }
    if (this.hops >= 150) {
      const energy = this.recent.reduce((a, b) => a + b, 0) / 150;
      this.shortTerm = loudness(energy);
      if (Number.isFinite(this.shortTerm))
        this.maxShortTerm = Math.max(this.maxShortTerm ?? -Infinity, this.shortTerm);
      if (
        this.running &&
        this.activeFrames >= this.hop * 150 &&
        this.hops % 5 === 0 &&
        Number.isFinite(this.shortTerm) &&
        this.shortTerm > -70
      ) {
        const bin = Math.min(10000, Math.max(0, Math.floor((this.shortTerm + 70) * 100)));
        this.rangeCounts[bin]++;
        this.rangeSum += energy;
        this.rangeCount++;
        const gate = Math.max(-70, loudness(this.rangeSum / this.rangeCount) - 20);
        const start = Math.max(0, Math.ceil((gate + 70) * 100));
        let count = 0;
        for (let i = start; i < this.rangeCounts.length; i++) count += this.rangeCounts[i];
        const lowRank = Math.round((count - 1) * 0.1),
          highRank = Math.round((count - 1) * 0.95);
        let seen = 0,
          low = null;
        for (let i = start; i < this.rangeCounts.length; i++) {
          seen += this.rangeCounts[i];
          if (low === null && seen > lowRank) low = i;
          if (seen > highRank) {
            this.loudnessRange = (i - low) / 100;
            break;
          }
        }
      }
    }
  }
  snapshot() {
    return {
      momentary: this.momentary,
      shortTerm: this.shortTerm,
      integrated: this.integrated,
      maxMomentary: this.maxMomentary,
      maxShortTerm: this.maxShortTerm,
      loudnessRange: this.loudnessRange,
      rangeStable: this.measurementFrames / this.rate >= 60,
      measuring: this.running,
      measurementSeconds: this.measurementFrames / this.rate,
      truePeak: peakDb(this.truePeak),
      samplePeak: peakDb(this.samplePeak),
      seconds: this.frames / this.rate,
      invalidSamples: this.invalid,
      available: true,
    };
  }
}
