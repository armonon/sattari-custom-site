import { useEffect, useRef, useState } from 'react';
import { Mic2, AudioLines, Music2, X } from 'lucide-react';

// Native modal semantics provide focus containment, Escape and focus restoration.
// Device permission is requested only after an explicit Mic/Input action.
export default function SourceChooser({ onClose, onTrack, onConnect, inputActive }) {
  const dialog = useRef(null);
  const alive = useRef(true);
  const pending = useRef(false);
  const [kind, setKind] = useState(null);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    alive.current = true;
    const node = dialog.current;
    const previous = document.activeElement;
    node.showModal();
    return () => {
      alive.current = false;
      node.close();
      previous?.focus?.();
    };
  }, []);

  const findInputs = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    let permissionStream;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
        throw new Error('Audio inputs are unavailable in this browser. Use HTTPS or localhost.');
      }
      // Unlock device labels without ever connecting this temporary stream to speakers.
      permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === 'audioinput' && device.deviceId
      );
      if (!alive.current) return;
      setDevices(inputs);
      setDeviceId(inputs[0]?.deviceId || '');
      if (!inputs.length) setError('No audio inputs found. Connect your interface and try again.');
    } catch (reason) {
      if (alive.current)
        setError(
          reason?.name === 'NotAllowedError'
            ? 'Allow microphone access in your browser, then try again.'
            : reason?.message || 'Could not find audio inputs.'
        );
    } finally {
      permissionStream?.getTracks().forEach((track) => track.stop());
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const connect = async () => {
    if (pending.current || inputActive || (kind === 'input' && !deviceId)) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const device = devices.find((item) => item.deviceId === deviceId);
      await onConnect(
        kind === 'mic' ? undefined : deviceId,
        kind === 'mic' ? 'Mic' : device?.label || 'Audio input'
      );
      if (alive.current) onClose();
    } catch (reason) {
      if (alive.current)
        setError(
          reason?.name === 'NotAllowedError'
            ? 'Microphone access was denied. Allow access in your browser and try again.'
            : reason?.message || 'Could not connect this input.'
        );
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      className="sd-source-chooser"
      aria-labelledby="source-chooser-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <h2 id="source-chooser-title">
          {kind === 'mic' ? 'Add mic' : kind === 'input' ? 'Add input' : 'Add source'}
        </h2>
        <button type="button" aria-label="Close source chooser" disabled={busy} onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      {!kind ? (
        <div className="sd-source-choices">
          <button type="button" aria-label="Mic" onClick={() => setKind('mic')}>
            <Mic2 size={24} />
            <span>
              <strong>Mic</strong>
              <small>Sing or speak through your microphone.</small>
            </span>
          </button>
          <button type="button" aria-label="Input" onClick={() => setKind('input')}>
            <AudioLines size={24} />
            <span>
              <strong>Input</strong>
              <small>Connect a guitar, synth, or audio interface.</small>
            </span>
          </button>
          <button type="button" aria-label="Track" onClick={onTrack}>
            <Music2 size={24} />
            <span>
              <strong>Track</strong>
              <small>Load a song or audio file into a deck.</small>
            </span>
          </button>
        </div>
      ) : (
        <div className="sd-source-setup">
          <p>
            Connect safely with monitoring off. In the Input strip, enable Record arm to capture a
            separate lane. Use headphones before enabling Monitor.
          </p>
          {inputActive ? (
            <p role="status">
              An input is already connected. Disconnect it in Perform before adding another. This
              version supports one live input at a time.
            </p>
          ) : kind === 'input' ? (
            <>
              <button type="button" onClick={findInputs} disabled={busy}>
                {busy ? 'Please wait…' : 'Find inputs'}
              </button>
              <label>
                Audio input
                <select
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  disabled={busy || !devices.length}
                >
                  {!devices.length && <option value="">Find inputs to choose a device</option>}
                  {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Input ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <small>Choose the exposed device channel in the Input strip after connecting.</small>
            </>
          ) : (
            <p>
              Your browser’s default microphone will be used. Choose Input to select a different
              device.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <footer>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setKind(null);
                setError('');
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="sd-source-connect"
              disabled={busy || inputActive || (kind === 'input' && !deviceId)}
              onClick={connect}
            >
              {busy ? 'Please wait…' : kind === 'mic' ? 'Connect mic' : 'Connect input'}
            </button>
          </footer>
        </div>
      )}
    </dialog>
  );
}
