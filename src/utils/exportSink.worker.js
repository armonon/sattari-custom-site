// Writes one temporary export file through a synchronous access handle. Safari
// before 26 offers OPFS writes only this way, and only inside a worker.
let access = null;
let position = 0;

self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'open') {
      const root = await navigator.storage.getDirectory();
      const directory = await root.getDirectoryHandle(data.directory);
      const handle = await directory.getFileHandle(data.name);
      access = await handle.createSyncAccessHandle();
      position = 0;
    } else if (type === 'write') {
      if (!access) throw new Error('Export file is not open.');
      const bytes = data.bytes;
      for (let offset = 0; offset < bytes.byteLength; ) {
        const written = access.write(bytes.subarray(offset), { at: position });
        if (!written) throw new Error('Export file could not be written.');
        offset += written;
        position += written;
      }
    } else if (type === 'close' || type === 'abort') {
      // Safari 15.2-16.3 returns promises from flush/close; later versions do not.
      if (access && type === 'close') await access.flush();
      await access?.close();
      access = null;
    }
    self.postMessage({ id, ok: true });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      name: error?.name,
      message: error?.message || String(error),
    });
  }
};
