import { useEffect, useState } from 'react';
import { CloudOff, LoaderCircle, Trash2 } from 'lucide-react';
import { splitRuntimeOffline } from '../../pwa/studioPwa';

// The page's own model cache (src/utils/stemSeparatorModel.js).
const MODEL_CACHE = 'sattari-demucs-v1';

async function modelSaved() {
  const { MODEL_URL } = await import('../../utils/stemSeparatorModel');
  const cache = await globalThis.caches?.open(MODEL_CACHE);
  return Boolean(await cache?.match(MODEL_URL));
}

/**
 * Opt-in offline Split. The rest of the studio works offline after one visit,
 * but Split also needs its 172 MB model and 28 MB runtime, so those are only
 * stored when someone asks for it here, and can be removed again.
 */
export default function SplitOffline({ disabled }) {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      const runtime = await splitRuntimeOffline('status').catch(() => ({ unsupported: true }));
      if (!live) return;
      if (runtime.unsupported) return setStatus('unsupported');
      setStatus(runtime.saved && (await modelSaved()) ? 'saved' : 'not-saved');
    })();
    return () => {
      live = false;
    };
  }, []);

  const save = async () => {
    setStatus('saving');
    setMessage('');
    try {
      await navigator.storage?.persist?.().catch(() => false);
      const { loadSeparationModel } = await import('../../utils/stemSeparatorModel');
      await loadSeparationModel(({ message: text, progress }) =>
        setMessage(progress == null ? text : `${text} (${Math.round(progress * 100)}%)`)
      );
      setMessage('Saving the separation runtime');
      const runtime = await splitRuntimeOffline('save');
      if (!runtime.saved) throw new Error(runtime.error || 'The runtime could not be saved.');
      if (!(await modelSaved()))
        throw new Error('This browser did not keep the model (storage full?).');
      setStatus('saved');
      setMessage('');
    } catch (error) {
      setStatus('not-saved');
      setMessage(`Could not save Split for offline use: ${error.message}`);
    }
  };

  const remove = async () => {
    await splitRuntimeOffline('remove').catch(() => {});
    const { MODEL_URL } = await import('../../utils/stemSeparatorModel');
    await (await globalThis.caches?.open(MODEL_CACHE))?.delete(MODEL_URL);
    setStatus('not-saved');
    setMessage('Removed. Split will download the model again the next time you use it.');
  };

  if (status === 'checking') return null;
  return (
    <section className="alab-card alab-offline" aria-labelledby="split-offline-title">
      <h2 id="split-offline-title">
        <CloudOff size={16} aria-hidden="true" /> Use Split offline (optional)
      </h2>
      {status === 'unsupported' ? (
        <p className="alab-note">
          Offline Split needs the installed studio app. Reload this page once it has finished
          loading, or install the Sattari app, to turn it on.
        </p>
      ) : status === 'saved' ? (
        <>
          <p className="alab-note">
            Split works offline in this browser: the model and runtime (about 200 MB) are saved on
            this device.
          </p>
          <button type="button" className="alab-text-button" onClick={() => void remove()}>
            <Trash2 size={14} aria-hidden="true" /> Remove offline Split
          </button>
        </>
      ) : (
        <>
          <p className="alab-note">
            The rest of the studio works offline after your first visit. Split also needs its 172 MB
            model and a 28 MB runtime, which are only saved if you ask: press the button to store
            them in this browser (about 200 MB). Your songs and stems are never stored.
          </p>
          <button
            type="button"
            className="alab-button"
            disabled={disabled || status === 'saving'}
            onClick={() => void save()}
          >
            {status === 'saving' ? (
              <LoaderCircle className="alab-spin" size={16} aria-hidden="true" />
            ) : (
              <CloudOff size={16} aria-hidden="true" />
            )}{' '}
            Make Split available offline
          </button>
        </>
      )}
      {message && (
        <p className="alab-note" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
