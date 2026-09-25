import { it, expect } from 'vitest';
import { hardwareSessionReport } from './hardwareSessionReport';
function fixture() {
  const captured = {
    id: 'qa',
    tracks: [
      {
        id: 'mic',
        name: 'Input',
        replayInput: 'microphone',
        clips: [
          { assetId: 'a', start: 0, duration: 30 },
          { assetId: 'b', start: 30, duration: 30 },
        ],
      },
    ],
  };
  return {
    targetSeconds: 60,
    sampleRate: 48000,
    samples: [{ duration: 60, contextState: 'running', clockLag: 0, pendingBytes: 0 }],
    captured,
    recovered: structuredClone(captured),
    events: 10,
    committedEvents: 10,
  };
}
it('passes continuous recovered input capture without claiming hardware certification', () => {
  expect(hardwareSessionReport(fixture()).status).toBe('capture-checks-passed');
});
it('rejects incomplete, disconnected, stalled, missing and discontinuous capture', () => {
  const value = fixture();
  value.interrupted = true;
  value.samples[0].duration = 20;
  value.samples[0].clockLag = 2;
  value.captured.tracks[0].clips[1].start = 30.01;
  value.recovered.tracks[0].clips.pop();
  value.committedEvents = 9;
  const report = hardwareSessionReport(value);
  expect(report.status).toBe('needs-review');
  expect(report.failures.join(' ')).toMatch(/Target session/);
  expect(report.failures.join(' ')).toMatch(/Chunk gap/);
  expect(report.failures.join(' ')).toMatch(/Recovery mismatch/);
  expect(report.failures.join(' ')).toMatch(/events/);
});
