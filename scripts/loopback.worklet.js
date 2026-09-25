class LoopbackProbe extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.signal = options.processorOptions.signal;
    this.starts = [0.2, 1.2, 2.2].map((t) => Math.round(t * sampleRate));
    this.capture = new Float32Array(Math.round(sampleRate * 3));
    this.position = 0;
  }
  process(inputs, outputs) {
    const output = outputs[0][0],
      input = inputs[0]?.[0];
    for (let i = 0; i < output.length; i++, this.position++) {
      if (this.position < this.capture.length) this.capture[this.position] = input?.[i] || 0;
      let value = 0;
      for (const start of this.starts) {
        const offset = this.position - start;
        if (offset >= 0 && offset < this.signal.length) value = this.signal[offset];
      }
      output[i] = value;
    }
    if (this.position >= this.capture.length) {
      this.port.postMessage({ capture: this.capture, starts: this.starts }, [this.capture.buffer]);
      return false;
    }
    return true;
  }
}
registerProcessor('stemdeck-loopback-probe', LoopbackProbe);
