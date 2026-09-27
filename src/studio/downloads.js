/** Starts a browser download and releases the object URL after `releaseAfter` ms. */
export function downloadBlob(blob, name, releaseAfter) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), releaseAfter);
}
