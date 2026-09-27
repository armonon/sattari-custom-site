import { useCallback, useEffect, useRef, useState } from 'react';

const detach = (access) =>
  access?.inputs?.forEach((input) => {
    input.onmidimessage = null;
  });

/** Web MIDI note-ons trigger the performance pads. */
export function useMidi({ triggerPad, padCount, setNotice }) {
  const [midiActive, setMidiActive] = useState(false);
  const access = useRef(null);

  useEffect(() => () => detach(access.current), []);

  const toggleMidi = useCallback(async () => {
    if (midiActive) {
      detach(access.current);
      setMidiActive(false);
      setNotice('MIDI input disconnected.');
      return;
    }
    if (!navigator.requestMIDIAccess) {
      setNotice('Web MIDI is unavailable in this browser.');
      return;
    }
    try {
      const granted = await navigator.requestMIDIAccess();
      access.current = granted;
      granted.inputs.forEach((input) => {
        input.onmidimessage = ({ data }) => {
          const [status, note, velocity] = data;
          if ((status & 0xf0) === 0x90 && velocity > 0) void triggerPad(note % padCount);
        };
      });
      setMidiActive(true);
      setNotice(
        `${granted.inputs.size || 0} MIDI input${granted.inputs.size === 1 ? '' : 's'} connected.`
      );
    } catch {
      setNotice('MIDI access was not granted.');
    }
  }, [midiActive, padCount, setNotice, triggerPad]);

  return { midiActive, toggleMidi };
}
