import { describe, expect, it, vi } from 'vitest';
import { StudioAudioEngine } from './studioAudioEngine';
import { LiveInput } from './liveInput';

function fixture() {
  const param = () => ({
    value: 0,
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
  });
  const node = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: param(),
    frequency: param(),
    threshold: param(),
    ratio: param(),
    attack: param(),
    release: param(),
    getFloatTimeDomainData: (values) => values.fill(0),
  });
  const context = {
    currentTime: 0,
    createGain: node,
    createBiquadFilter: node,
    createDynamicsCompressor: node,
    createAnalyser: node,
    createChannelSplitter: node,
    createMediaStreamSource: node,
  };
  const track = {
    stop: vi.fn(),
    readyState: 'live',
    label: 'Interface',
    getSettings: () => ({ deviceId: 'usb', channelCount: 8 }),
  };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const media = {
    getUserMedia: vi.fn(async () => stream),
    enumerateDevices: vi.fn(async () => [{ kind: 'audioinput', deviceId: 'usb' }]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const input = new LiveInput(context, node(), media);
  return { input, context, track, stream, media };
}

describe('live input safety and stable recording bus', () => {
  it('cancels an engine connection while audio unlock is still pending', async () => {
    const input = { open: vi.fn() };
    const engine = { ensureLiveInput: () => input };
    engine.unlock = async () => StudioAudioEngine.prototype.closeMicrophone.call(engine);
    await expect(StudioAudioEngine.prototype.openMicrophone.call(engine)).rejects.toThrow(
      'cancelled'
    );
    expect(input.open).not.toHaveBeenCalled();
  });
  it('opens an exact device without enabling monitoring or record arm', async () => {
    const { input, media } = fixture();
    await input.open('usb');
    expect(media.getUserMedia.mock.calls[0][0].audio.deviceId).toEqual({ exact: 'usb' });
    expect(input.snapshot()).toMatchObject({
      status: 'connected',
      monitor: false,
      armed: false,
      channelCount: 8,
    });
  });
  it('arm is independent of monitor and survives reconnect on the same capture bus', async () => {
    const { input } = fixture();
    const bus = input.record;
    await input.open('usb');
    input.update({ armed: true });
    expect(input.record.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 0, 0.005);
    expect(input.monitor.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0);
    input.close();
    await input.open('usb');
    expect(input.record).toBe(bus);
    expect(input.settings.armed).toBe(true);
    expect(input.settings.monitor).toBe(false);
  });
  it('selects channels above two and rejects unavailable channels', async () => {
    const { input } = fixture();
    await input.open('usb');
    input.update({ channel: 7 });
    expect(input.splitter.connect).toHaveBeenCalledWith(input.gain, 7, 0);
    expect(input.splitter.connect).toHaveBeenCalledWith(input.rawRecord, 7, 0);
    expect(() => input.update({ channel: 8 })).toThrow('unavailable');
  });
  it('rejects substituted devices and disposes a late permission grant', async () => {
    const { input, media, track, stream } = fixture();
    await expect(input.open('wrong')).rejects.toThrow('unavailable');
    expect(track.stop).toHaveBeenCalled();
    media.getUserMedia.mockImplementation(async () => {
      input.close();
      return stream;
    });
    await expect(input.open('usb')).rejects.toThrow('cancelled');
    expect(input.stream).toBe(null);
  });
  it('unplugging turns monitoring off, keeps arm and permits explicit reconnect', async () => {
    const { input, track } = fixture();
    await input.open('usb');
    input.update({ armed: true, monitor: true });
    track.onended();
    expect(input.snapshot()).toMatchObject({ status: 'disconnected', monitor: false, armed: true });
    await input.open('usb');
    expect(input.snapshot().status).toBe('connected');
    expect(input.settings.monitor).toBe(false);
  });
  it('devicechange fails safely without selecting a default device', async () => {
    const { input, media } = fixture();
    await input.open('usb');
    media.enumerateDevices.mockResolvedValue([]);
    await input.deviceChanged();
    expect(input.snapshot().status).toBe('disconnected');
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
  });
  it('low latency bypasses input FX without changing the record branch', () => {
    const { input } = fixture();
    input.update({ compression: true });
    expect(input.filter.connect).toHaveBeenLastCalledWith(input.compressor);
    input.update({ lowLatency: true });
    expect(input.gain.connect).toHaveBeenLastCalledWith(input.monitor);
    expect(input.record.disconnect).not.toHaveBeenCalled();
  });
  it('holds clipping indication for two seconds', () => {
    const { input, context } = fixture();
    input.analyser.getFloatTimeDomainData = (samples) => samples.fill(1);
    expect(input.snapshot().clipping).toBe(true);
    input.analyser.getFloatTimeDomainData = (samples) => samples.fill(0);
    context.currentTime = 1;
    expect(input.snapshot().clipping).toBe(true);
    context.currentTime = 3;
    expect(input.snapshot().clipping).toBe(false);
  });
  it('journals successful input edits and automatic interruption, never rejected channel edits', async () => {
    const { input, track } = fixture();
    input.onStateChange = vi.fn();
    await input.open('usb');
    input.update({ gainDb: 6, monitor: true, compression: true });
    expect(input.onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ gainDb: 6, monitor: true, compression: true, status: 'connected' })
    );
    input.onStateChange.mockClear();
    expect(() => input.update({ channel: 30 })).toThrow();
    expect(input.onStateChange).not.toHaveBeenCalled();
    track.onmute();
    expect(input.onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'interrupted' })
    );
    track.onunmute();
    track.onended();
    expect(input.onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'disconnected', monitor: false })
    );
  });
  it('only opens the editable pre-gain recording bus when armed or monitoring', () => {
    const { input } = fixture();
    expect(input.rawRecord.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0);
    input.update({ monitor: true, gainDb: -20 });
    expect(input.rawRecord.gain.setValueAtTime).toHaveBeenLastCalledWith(1, 0);
    input.update({ monitor: false });
    expect(input.rawRecord.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0);
    input.update({ armed: true });
    expect(input.rawRecord.gain.setValueAtTime).toHaveBeenLastCalledWith(1, 0);
  });
  it('engine delegates connection after unlock and rejects disposed engines', async () => {
    const input = { open: vi.fn(async () => {}) };
    const engine = { unlock: vi.fn(async () => {}), ensureLiveInput: () => input };
    await StudioAudioEngine.prototype.openMicrophone.call(engine, 'usb');
    expect(input.open).toHaveBeenCalledWith('usb');
    engine.disposed = true;
    await expect(StudioAudioEngine.prototype.openMicrophone.call(engine)).rejects.toThrow(
      'cancelled'
    );
  });
});
