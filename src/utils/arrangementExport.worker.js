import { wavBytes, zipFiles } from './arrangementExport';
import { pcm24 } from './arrangementStreamExport';
self.onmessage = ({ data }) => {
  try {
    const result =
      data.type === 'pcm'
        ? pcm24(data.channels, data.crc)
        : data.type === 'zip'
          ? zipFiles(data.files)
          : wavBytes(
              {
                ...data,
                numberOfChannels: data.channels.length,
                getChannelData: (index) => data.channels[index],
              },
              data.type === 'float-wav'
            );
    self.postMessage({ result, recycled: data.recycle ? data.channels : undefined }, [
      ...(result instanceof Uint8Array
        ? [result.buffer]
        : result?.bytes
          ? [result.bytes.buffer]
          : []),
      ...(data.recycle ? data.channels.map((channel) => channel.buffer) : []),
    ]);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
