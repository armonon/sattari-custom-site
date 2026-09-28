import { analyzeSong } from './analyze';

self.onmessage = ({ data }) => {
  try {
    const result = analyzeSong(data.samples, data.rate, (value, label) =>
      self.postMessage({ progress: { value, label } })
    );
    self.postMessage({ result });
  } catch {
    self.postMessage({
      error: 'This audio could not be analyzed. Try a shorter, clear guitar recording.',
    });
  }
};
