import { describe, expect, it, vi } from 'vitest';
import { LevelMeter, measureInto, meterReading, silenceReading, toDb } from './mixerMeters';

describe('meter readings', () => {
  it('measures peak and RMS across both channels', () => {
    const reading = meterReading();
    measureInto(reading, [Float32Array.of(0.5, -0.5), Float32Array.of(0, 0)]);
    expect(reading.peakDb).toBeCloseTo(toDb(0.5), 9);
    expect(reading.rmsDb).toBeCloseTo(toDb(Math.sqrt(0.5 / 4)), 9);
    expect(reading.clip).toBe(false);
  });

  it('flags full scale and non-finite samples as clipping', () => {
    expect(measureInto(meterReading(), [Float32Array.of(1)]).clip).toBe(true);
    const overload = measureInto(meterReading(), [Float32Array.of(0.25, NaN)]);
    expect(overload.clip).toBe(true);
    expect(overload.peakDb).toBeCloseTo(toDb(0.25), 9);
  });

  it('reads silence as -Infinity without allocating a new reading', () => {
    const reading = { peakDb: -3, rmsDb: -9, clip: true };
    expect(silenceReading(reading)).toBe(reading);
    expect(reading).toEqual({ peakDb: -Infinity, rmsDb: -Infinity, clip: false });
  });
});

describe('level meter', () => {
  const fakeRaw = () => {
    const made = [];
    const node = (kind) => {
      const item = { kind, connect: vi.fn(), disconnect: vi.fn() };
      made.push(item);
      return item;
    };
    return {
      made,
      createGain: () => node('gain'),
      createChannelSplitter: () => node('splitter'),
      createAnalyser: () => ({
        ...node('analyser'),
        getFloatTimeDomainData: (buffer) => buffer.fill(0.5),
      }),
    };
  };

  it('creates no nodes until it is shown, and listens only while active', () => {
    const raw = fakeRaw();
    const connect = vi.fn(),
      disconnect = vi.fn();
    const meter = new LevelMeter(raw, { connect, disconnect, size: 8 });
    const source = { kind: 'source' };
    meter.attach(source);
    expect(raw.made).toHaveLength(0);
    expect(meter.read().peakDb).toBe(-Infinity);
    meter.setActive(true);
    expect(connect).toHaveBeenCalledWith(source, meter.tap);
    const reading = meterReading();
    expect(meter.read(reading)).toBe(reading);
    expect(reading.peakDb).toBeCloseTo(toDb(0.5), 9);
    meter.setActive(false);
    expect(disconnect).toHaveBeenCalledWith(source, meter.tap);
    expect(meter.read(reading).peakDb).toBe(-Infinity);
  });

  it('moves to a new source without leaving the old one connected', () => {
    const raw = fakeRaw();
    const connect = vi.fn(),
      disconnect = vi.fn();
    const meter = new LevelMeter(raw, { connect, disconnect, size: 8 });
    const first = { kind: 'first' },
      second = { kind: 'second' };
    meter.setActive(true);
    meter.attach(first);
    meter.attach(second);
    expect(disconnect).toHaveBeenCalledWith(first, meter.tap);
    expect(connect).toHaveBeenLastCalledWith(second, meter.tap);
    meter.dispose();
    expect(disconnect).toHaveBeenLastCalledWith(second, meter.tap);
    expect(meter.listening).toBe(false);
  });
});
