import { stretchStems } from './timeStretch.js';

// stems: { id: [left, right] } (copies). Returns stretched copies, transferred.
self.onmessage = ({ data: { id, stems, alpha } }) => {
  try {
    const result = stretchStems(stems, alpha);
    const transfer = Object.values(result).flatMap((channels) => channels.map((c) => c.buffer));
    self.postMessage({ id, result }, transfer);
  } catch (error) {
    self.postMessage({ id, error: error?.message || 'Speed change failed.' });
  }
};
