// Channel meters for the mixer. Nodes are created once, on first activation,
// and only listen while active; a read reuses its buffers and reading object.
export const METER_WINDOW = 2048; // 42.7 ms at 48 kHz: poll at >= 25 Hz to see every sample

export const toDb = (value) => (value > 0 ? 20 * Math.log10(value) : -Infinity);
export const meterReading = () => ({ peakDb: -Infinity, rmsDb: -Infinity, clip: false });

export function silenceReading(reading) {
  reading.peakDb = -Infinity;
  reading.rmsDb = -Infinity;
  reading.clip = false;
  return reading;
}

// Peak over both channels; RMS as mean power across channels (measureMasterChannels).
// A non-finite sample is an overload: it sets clip and is left out of the sums.
export function measureInto(reading, channels) {
  let peak = 0,
    sum = 0,
    count = 0,
    overload = false;
  for (let c = 0; c < channels.length; c++) {
    const samples = channels[c];
    for (let i = 0; i < samples.length; i++) {
      const value = samples[i];
      if (!Number.isFinite(value)) {
        overload = true;
        continue;
      }
      const magnitude = value < 0 ? -value : value;
      if (magnitude > peak) peak = magnitude;
      sum += value * value;
    }
    count += samples.length;
  }
  reading.peakDb = toDb(peak);
  reading.rmsDb = toDb(count ? Math.sqrt(sum / count) : 0);
  reading.clip = overload || peak >= 1;
  return reading;
}

const link = (from, to) => from.connect(to);
const unlink = (from, to) => from.disconnect(to);

export class LevelMeter {
  constructor(raw, { connect = link, disconnect = unlink, size = METER_WINDOW } = {}) {
    Object.assign(this, { raw, connect, disconnect, size });
    this.source = null;
    this.active = false;
    this.listening = false;
  }
  // Mono sources are up-mixed so both analysers see them (a splitter would not).
  ensureNodes() {
    if (this.tap) return;
    const { raw, size } = this;
    this.tap = raw.createGain();
    this.tap.channelCount = 2;
    this.tap.channelCountMode = 'explicit';
    this.tap.channelInterpretation = 'speakers';
    this.splitter = raw.createChannelSplitter(2);
    this.tap.connect(this.splitter);
    this.analysers = [0, 1].map((channel) => {
      const analyser = raw.createAnalyser();
      analyser.fftSize = size;
      analyser.smoothingTimeConstant = 0;
      this.splitter.connect(analyser, channel);
      return analyser;
    });
    this.buffers = this.analysers.map(() => new Float32Array(size));
  }
  // The source's owner may already have disconnected it (a rebuilt track bus
  // drops every output), which makes a second disconnect throw.
  unlink() {
    try {
      this.disconnect(this.source, this.tap);
    } catch {
      // Already disconnected.
    }
    this.listening = false;
  }
  sync() {
    const listen = this.active && !!this.source;
    if (listen === this.listening) return;
    if (!listen) {
      this.unlink();
      return;
    }
    this.ensureNodes();
    this.connect(this.source, this.tap);
    this.listening = true;
  }
  attach(source) {
    if (source === this.source) return;
    if (this.listening) this.unlink();
    this.source = source || null;
    this.sync();
  }
  setActive(active) {
    this.active = !!active;
    this.sync();
  }
  read(reading = meterReading()) {
    if (!this.listening) return silenceReading(reading);
    for (let c = 0; c < this.analysers.length; c++)
      this.analysers[c].getFloatTimeDomainData(this.buffers[c]);
    return measureInto(reading, this.buffers);
  }
  dispose() {
    this.attach(null);
    this.tap?.disconnect();
    this.splitter?.disconnect();
    for (const analyser of this.analysers || []) analyser.disconnect();
  }
}
