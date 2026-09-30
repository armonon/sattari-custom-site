// Records an explicit, bounded take. Output is always silent: no microphone monitoring.
class LoopPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.take = null;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'cancel') this.take = null;
      if (data.type === 'record') {
        const seconds = Math.max(0.5, Math.min(60, Number(data.seconds) || 2.5));
        this.take = {
          id: data.id,
          samples: new Float32Array(Math.round(seconds * sampleRate)),
          offset: 0,
          inputFrames: 0,
          lastProgress: 0,
        };
      }
    };
  }
  process(inputs, outputs) {
    for (const output of outputs) for (const channel of output) channel.fill(0);
    const take = this.take;
    if (!take) return true;
    const input = inputs[0]?.[0];
    const count = Math.min(
      input?.length || outputs[0]?.[0]?.length || 128,
      take.samples.length - take.offset
    );
    if (input?.length) {
      take.samples.set(input.subarray(0, count), take.offset);
      take.inputFrames += count;
    }
    take.offset += count;
    if (take.offset === take.samples.length) {
      this.port.postMessage(
        {
          type: 'complete',
          id: take.id,
          rate: sampleRate,
          samples: take.samples,
          inputFrames: take.inputFrames,
        },
        [take.samples.buffer]
      );
      this.take = null;
    } else if (take.offset - take.lastProgress >= sampleRate / 10) {
      take.lastProgress = take.offset;
      this.port.postMessage({
        type: 'progress',
        id: take.id,
        progress: take.offset / take.samples.length,
      });
    }
    return true;
  }
}
registerProcessor('loop-pcm-capture', LoopPcmCapture);
