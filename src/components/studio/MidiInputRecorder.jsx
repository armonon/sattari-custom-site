import { useEffect, useRef, useState } from 'react';
import { MidiNoteCapture, midiPitch } from '../../utils/arrangementMidi';

export default function MidiInputRecorder({
  getOwner,
  getInstrumentEngine,
  getPosition,
  master,
  instrument = 'triangle',
  voiceContext,
  onRecorded,
  onRecordingChange,
  disabled,
  looping,
}) {
  const [devices, setDevices] = useState([]),
    [device, setDevice] = useState(''),
    [recording, setRecording] = useState(false),
    [message, setMessage] = useState('Connect a MIDI keyboard to play or record a new take.');
  const access = useRef(null),
    take = useRef(null),
    monitor = useRef(new MidiNoteCapture()),
    voices = useRef(new Map()),
    mounted = useRef(true);
  const latest = useRef(null),
    selectedDevice = useRef(device);
  selectedDevice.current = device;
  latest.current = {
    getOwner,
    getInstrumentEngine,
    getPosition,
    master,
    instrument,
    voiceContext,
    onRecorded,
    onRecordingChange,
  };
  const silence = () => {
    for (const stop of voices.current.values()) stop();
    voices.current.clear();
    monitor.current = new MidiNoteCapture();
  };
  const finish = () => {
    const current = take.current;
    take.current = null;
    silence();
    setRecording(false);
    latest.current.onRecordingChange(false);
    if (!current) return;
    const duration = Math.max(
      0.001,
      latest.current.getOwner().getAudioContext().rawContext.currentTime - current.clock
    );
    const notes = current.notes.stop(duration);
    if (notes.length) {
      latest.current.onRecorded(notes, duration, current.start, current.sound);
      setMessage(`${notes.length} notes recorded into a new editable take.`);
    } else setMessage('No notes recorded.');
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      silence();
      if (access.current) {
        access.current.onstatechange = null;
        for (const port of access.current.inputs.values()) port.onmidimessage = null;
      }
    };
  }, []);
  useEffect(() => {
    const warn = (event) => {
      if (take.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  useEffect(() => {
    const context = latest.current.voiceContext;
    if (context?.clip?.instrument !== 'sampler') return;
    let active = true;
    const preview = { ...context.project, tracks: [{ ...context.track, clips: [context.clip] }] };
    void latest.current
      .getInstrumentEngine()
      .prepare(preview, false)
      .catch((error) => {
        if (active && mounted.current) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [voiceContext?.clip?.assetId, voiceContext?.clip?.instrument]);
  useEffect(() => {
    if (!access.current) return;
    for (const port of access.current.inputs.values()) port.onmidimessage = null;
    const port = access.current.inputs.get(device);
    if (!port) return;
    port.onmidimessage = (event) => {
      const { getOwner, getInstrumentEngine, master, instrument, voiceContext } = latest.current;
      const now = getOwner().getAudioContext().rawContext.currentTime;
      const [status, key, value = 0] = event.data;
      const id = `${status & 15}:${key}`;
      if ((status & 240) === 144 && value && midiPitch(key)) {
        voices.current.get(id)?.();
        try {
          voices.current.set(
            id,
            getInstrumentEngine().noteOn(
              midiPitch(key),
              value / 127,
              instrument,
              master,
              voiceContext
            )
          );
        } catch (error) {
          setMessage(error.message);
        }
      }
      monitor.current.message(event.data, now);
      // Monitoring does not retain an ever-growing event history.
      monitor.current.notes.length = 0;
      for (const [id, stop] of voices.current)
        if (!monitor.current.active.has(id)) {
          stop();
          voices.current.delete(id);
        }
      if (take.current)
        take.current.notes.message(event.data, Math.max(0, now - take.current.clock));
    };
    return () => {
      port.onmidimessage = null;
      silence();
    };
  }, [device, devices]);
  const connect = async () => {
    try {
      if (!navigator.requestMIDIAccess)
        throw new Error(
          'Web MIDI is unavailable here. Use a supported browser, or import a .mid file.'
        );
      await latest.current.getOwner().unlock();
      if (latest.current.voiceContext?.project)
        await latest.current.getInstrumentEngine().prepare(latest.current.voiceContext.project);
      const next = await navigator.requestMIDIAccess({ sysex: false });
      if (!mounted.current) return;
      access.current = next;
      const refresh = () => {
        const inputs = [...next.inputs.values()].filter((port) => port.state !== 'disconnected');
        setDevices(inputs.map((port) => ({ id: port.id, name: port.name || 'MIDI input' })));
        if (!inputs.some((port) => port.id === selectedDevice.current)) {
          if (take.current) {
            finishRef.current();
            setMessage('MIDI input disconnected; recorded notes were kept.');
          }
          setDevice(inputs[0]?.id || '');
        }
      };
      next.onstatechange = refresh;
      refresh();
      setMessage(
        next.inputs.size
          ? 'MIDI connected. Notes use the selected instrument.'
          : 'No MIDI inputs found. Connect a keyboard.'
      );
    } catch (error) {
      setMessage(error.message);
    }
  };
  const record = async () => {
    if (take.current) {
      finish();
      return;
    }
    try {
      if (looping)
        throw new Error(
          'Turn off loop playback before recording MIDI; each recording creates one linear take.'
        );
      await latest.current.getOwner().unlock();
      take.current = {
        clock: latest.current.getOwner().getAudioContext().rawContext.currentTime,
        start: latest.current.getPosition(),
        notes: new MidiNoteCapture(),
        sound: structuredClone({
          clip: latest.current.voiceContext?.clip,
          track: latest.current.voiceContext?.track,
          instrument: latest.current.instrument,
        }),
      };
      latest.current.onRecordingChange(true);
      setRecording(true);
      setMessage('Recording MIDI. Stop MIDI take to keep the notes; audio playback can continue.');
    } catch (error) {
      setMessage(error.message);
    }
  };
  return (
    <section aria-label="MIDI recording" className="ae-midi-input">
      <div className="ae-actions">
        <button type="button" disabled={disabled || recording} onClick={connect}>
          Connect MIDI
        </button>
        <label>
          MIDI input
          <select
            aria-label="MIDI input"
            value={device}
            disabled={recording || !devices.length}
            onChange={(event) => setDevice(event.target.value)}
          >
            <option value="">Choose input</option>
            {devices.map((port) => (
              <option key={port.id} value={port.id}>
                {port.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-pressed={recording}
          disabled={!recording && (disabled || !device)}
          onClick={record}
        >
          {recording ? 'Stop MIDI take' : 'Record MIDI take'}
        </button>
        <button type="button" onClick={silence}>
          All notes off
        </button>
      </div>
      <p role="status">{message}</p>
    </section>
  );
}
