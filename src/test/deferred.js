// Test-only deferred promise (a small stand-in for Promise.withResolvers).
export function deferred() {
  let resolve, reject;
  const promise = new Promise((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}
