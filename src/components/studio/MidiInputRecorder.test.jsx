import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import MidiInputRecorder from './MidiInputRecorder';
it('records keyboard note-on/off times and keeps a take when the device disconnects', async () => {
  const port = { id: 'keyboard', name: 'Test keys', state: 'connected' };
  const access = { inputs: new Map([[port.id, port]]) };
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    value: vi.fn(async () => access),
  });
  const raw = { currentTime: 10 },
    owner = { unlock: vi.fn(async () => {}), getAudioContext: () => ({ rawContext: raw }) };
  const stop = vi.fn(),
    instrument = { noteOn: vi.fn(() => stop), prepare: vi.fn(async () => {}) },
    recorded = vi.fn(),
    recording = vi.fn();
  const sound = {
    clip: { instrument: 'piano', gain: 75 },
    track: { gain: 140, pan: -0.3, effects: [{ id: 'e', type: 'echo' }], stemRole: 'other' },
  };
  render(
    <MidiInputRecorder
      getOwner={() => owner}
      getInstrumentEngine={() => instrument}
      getPosition={() => 4}
      master={{}}
      voiceContext={sound}
      onRecorded={recorded}
      onRecordingChange={recording}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Connect MIDI' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Record MIDI take' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Record MIDI take' }));
  await waitFor(() => expect(recording).toHaveBeenCalledWith(true));
  sound.track.gain = 10;
  act(() => {
    raw.currentTime = 10.2;
    port.onmidimessage({ data: [144, 60, 127] });
    raw.currentTime = 10.7;
    port.onmidimessage({ data: [128, 60, 0] });
  });
  expect(stop).toHaveBeenCalled();
  act(() => {
    raw.currentTime = 11;
    port.state = 'disconnected';
    access.onstatechange();
  });
  expect(recorded).toHaveBeenCalledTimes(1);
  expect(recorded.mock.calls[0][0][0]).toMatchObject({ pitch: 'C4', duration: 0.5, velocity: 1 });
  expect(recorded.mock.calls[0][2]).toBe(4);
  expect(recorded.mock.calls[0][3]).toMatchObject({
    clip: { instrument: 'piano', gain: 75 },
    track: { gain: 140, pan: -0.3, stemRole: 'other' },
  });
  delete navigator.requestMIDIAccess;
});
