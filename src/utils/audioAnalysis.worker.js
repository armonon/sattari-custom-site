import { analyzeDecodedAudio } from './audioAnalysis';
self.onmessage = ({ data }) => {
  try {
    const { channels, rate } = data;
    self.postMessage({
      result: analyzeDecodedAudio({
        numberOfChannels: channels.length,
        length: channels[0].length,
        sampleRate: rate,
        duration: channels[0].length / rate,
        getChannelData: (i) => channels[i],
      }),
    });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
