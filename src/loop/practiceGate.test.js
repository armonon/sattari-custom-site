// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { emptyPitchGate, gradePitch } from './practiceGate';

const pitch = (midi, cents = 0) => ({ midi, cents });
describe('guided note scoring', () => {
  it('requires a stable absolute pitch, and restarts the hold when tuning strays', () => {
    let result = gradePitch(emptyPitchGate(), pitch(52), 64, 0);
    result = gradePitch(result.gate, pitch(52), 64, 400);
    expect(result.hit).toBe(false);
    result = gradePitch(result.gate, pitch(64), 64, 500);
    expect(gradePitch(result.gate, pitch(64), 64, 650).hit).toBe(false);
    result = gradePitch(result.gate, pitch(64, 45), 64, 680);
    expect(result.hit).toBe(false);
    expect(gradePitch(result.gate, pitch(64), 64, 800).hit).toBe(false);
    expect(gradePitch(result.gate, pitch(64), 64, 900).hit).toBe(true);
  });
  it('does not count the same sustained pitch twice, but accepts a fresh repeated note', () => {
    let result = gradePitch(emptyPitchGate(), pitch(64), 64, 0);
    result = gradePitch(result.gate, pitch(64), 64, 200);
    expect(result.hit).toBe(true);
    result = gradePitch(result.gate, pitch(64), 64, 800);
    expect(result.hit).toBe(false);
    result = gradePitch(result.gate, null, 64, 900);
    result = gradePitch(result.gate, pitch(64), 64, 1000);
    expect(gradePitch(result.gate, pitch(64), 64, 1200).hit).toBe(true);
  });
  it('accepts the next different note after a fresh stable hold', () => {
    let result = gradePitch(emptyPitchGate(), pitch(64), 64, 0);
    result = gradePitch(result.gate, pitch(64), 64, 200);
    result = gradePitch(result.gate, pitch(65), 65, 400);
    expect(result.hit).toBe(false);
    expect(gradePitch(result.gate, pitch(65), 65, 600).hit).toBe(true);
  });
});
