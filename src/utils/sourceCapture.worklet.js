/* global currentFrame, sampleRate */
class StemDeckCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.count = options.processorOptions.count;
    this.start = options.processorOptions.startFrame;
    this.size = Math.round(sampleRate * 5);
    this.frames = 0;
    this.inflight = 0;
    this.used = 0;
    this.running = true;
    this.reportAt = sampleRate;
    this.pool = [this.allocate(), this.allocate()];
    this.data = this.allocate();
    this.port.onmessage = ({ data }) => {
      if (data?.ack) {
        this.inflight = Math.max(0, this.inflight - 1);
        if (
          data.channels?.length === this.count &&
          data.channels.every(
            (pair) => pair.length === 2 && pair.every((values) => values.length === this.size)
          )
        )
          this.pool.push(data.channels);
      }
      if (data === 'stop') {
        this.flush();
        this.running = false;
        this.port.postMessage({ done: true, frames: this.frames });
      }
    };
  }
  allocate() {
    return Array.from({ length: this.count }, () => [
      new Float32Array(this.size),
      new Float32Array(this.size),
    ]);
  }
  flush() {
    if (!this.used) return;
    if (this.inflight >= 2 || !this.pool.length) {
      this.running = false;
      this.used = 0;
      this.port.postMessage({
        error:
          'Source storage stopped acknowledging chunks. Capture stopped; recover completed chunks and keep the master safety recording.',
      });
      this.port.postMessage({ done: true, frames: this.frames });
      return;
    }
    this.inflight++;
    const channels = this.data;
    this.data = this.pool.pop();
    this.port.postMessage(
      { channels, start: this.frames - this.used, length: this.used },
      channels.flat().map((values) => values.buffer)
    );
    this.used = 0;
  }
  process(inputs, outputs) {
    if (!this.running) return false;
    const length = outputs[0]?.[0]?.length || 128;
    for (let frame = 0; frame < length; frame++) {
      if (currentFrame + frame < this.start) continue;
      if (this.frames === 0)
        this.port.postMessage({ startedAt: (currentFrame + frame) / sampleRate });
      for (let source = 0; source < this.count; source++) {
        this.data[source][0][this.used] = inputs[source]?.[0]?.[frame] || 0;
        this.data[source][1][this.used] =
          inputs[source]?.[1]?.[frame] ?? inputs[source]?.[0]?.[frame] ?? 0;
      }
      this.used++;
      this.frames++;
      if (this.frames >= this.reportAt) {
        this.port.postMessage({ progress: true, frames: this.frames });
        this.reportAt += sampleRate;
      }
      if (this.used === this.size) {
        this.flush();
        if (!this.running) return false;
      }
    }
    return true;
  }
}
registerProcessor('stemdeck-source-capture', StemDeckCapture);
