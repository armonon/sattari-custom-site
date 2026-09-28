/* global ProgrammeMeter */
// DSP source is prepended by liveLoudness.js; keep this script import-free.
class LoudnessProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.meter = new ProgrammeMeter(sampleRate);
    this.lastBlock = 0;
    this.port.onmessage = ({ data }) => {
      if (data === 'reset') {
        this.meter.reset();
        this.lastBlock = 0;
      }
      if (data === 'pause') this.meter.setRunning(false);
      if (data === 'resume') this.meter.setRunning(true);
    };
  }
  process(inputs) {
    const input = inputs[0];
    if (input?.length) this.meter.process(input[0], input[1]);
    if (this.lastBlock !== this.meter.blocks) {
      this.lastBlock = this.meter.blocks;
      this.port.postMessage(this.meter.snapshot());
    }
    return true; // Silent parallel branch, never modifies the programme signal.
  }
}
registerProcessor('stemdeck-programme-meter', LoudnessProcessor);
