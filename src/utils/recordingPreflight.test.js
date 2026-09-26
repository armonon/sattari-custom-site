import { expect, it } from 'vitest';
import { recordingBudget, recordingPreflight } from '../../scripts/recording-preflight.mjs';

it('budgets capture, recovery and export plus untouched disk headroom', () => {
  const result = recordingBudget({ seconds: 7200 });
  expect(result.requiredBytes).toBe(7200 * 48000 * 12 * 4 * 3 + 5 * 1024 ** 3);
});
it('refuses inadequate available-user storage before any recording is started', async () => {
  const inspect = async () => ({ bavail: 6 * 1024 ** 3, bsize: 1 });
  expect((await recordingPreflight('.', { seconds: 7200 }, inspect)).pass).toBe(false);
  expect((await recordingPreflight('.', { seconds: 120, channels: 2 }, inspect)).pass).toBe(true);
});
it.each([0, -1, NaN, Infinity])('rejects invalid session duration %s', (seconds) => {
  expect(() => recordingBudget({ seconds })).toThrow('Invalid recording budget');
});
it('does not treat missing filesystem telemetry as available capacity', async () => {
  await expect(recordingPreflight('.', { seconds: 120 }, async () => ({}))).rejects.toThrow(
    'Cannot establish'
  );
});
