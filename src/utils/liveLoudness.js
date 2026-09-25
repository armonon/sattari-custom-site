import dspSource from './loudnessDSP.js?raw';
import processorSource from './loudness.worklet.js?raw';
const modules = new WeakMap();
export async function connectLoudness(context, source, connect, disconnect) {
  const raw = context.rawContext || context;
  if (!raw.audioWorklet) throw Error('Continuous loudness metering needs AudioWorklet support.');
  if (!modules.has(raw)) {
    // Tone's standardized-audio-context loader wraps worklets in a blob script.
    // Ship one self-contained script: module imports fail in that wrapper in dev.
    const workletURL = URL.createObjectURL(
      new Blob([dspSource.replace(/^export /gm, ''), '\n', processorSource], {
        type: 'text/javascript',
      })
    );
    modules.set(
      raw,
      raw.audioWorklet
        .addModule(workletURL)
        .catch((error) => {
          modules.delete(raw);
          throw error;
        })
        .finally(() => URL.revokeObjectURL(workletURL))
    );
  }
  await modules.get(raw);
  const options = {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    channelCount: 2,
    channelCountMode: 'explicit',
  };
  const node = context.createAudioWorkletNode
    ? context.createAudioWorkletNode('stemdeck-programme-meter', options)
    : new AudioWorkletNode(raw, 'stemdeck-programme-meter', options);
  let state = {
    available: true,
    integrated: null,
    momentary: null,
    shortTerm: null,
    truePeak: null,
    seconds: 0,
  };
  node.port.onmessage = ({ data }) => {
    state = data;
  };
  try {
    connect(source, node);
    node.connect(raw.destination);
  } catch (error) {
    try {
      disconnect(source, node);
    } catch {
      /* Connection may not have completed. */
    }
    node.disconnect();
    node.port.close();
    throw error;
  }
  return {
    read: () => state,
    setRunning: (running) => {
      node.port.postMessage(running ? 'resume' : 'pause');
      state = { ...state, measuring: !!running };
    },
    reset: () => {
      node.port.postMessage('reset');
      state = {
        ...state,
        integrated: null,
        momentary: null,
        shortTerm: null,
        truePeak: null,
        maxMomentary: null,
        maxShortTerm: null,
        loudnessRange: null,
        rangeStable: false,
        measuring: true,
        measurementSeconds: 0,
        seconds: 0,
      };
    },
    dispose: () => {
      disconnect(source, node);
      node.disconnect();
      node.port.close();
    },
  };
}
