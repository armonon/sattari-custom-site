// One stable recording bus survives permission prompts, device swaps and unplugging.
// Monitoring is deliberately opt-in; recording arm never enables speakers.
export class LiveInput {
  constructor(context, destination, media = navigator.mediaDevices) {
    this.context = context;
    this.media = media;
    this.settings = {
      channel: -1,
      gainDb: 0,
      armed: false,
      monitor: false,
      lowLatency: false,
      highpass: 80,
      compression: false,
    };
    this.status = 'disconnected';
    this.request = 0;
    this.gain = context.createGain();
    this.record = context.createGain();
    // Selected-channel pre-gain safety source for editable input processing.
    // Never record an input unless the musician has armed or monitored it.
    this.rawRecord = context.createGain();
    this.rawRecord.gain.value = 0;
    this.monitor = context.createGain();
    this.record.gain.value = 0;
    this.monitor.gain.value = 0;
    this.filter = context.createBiquadFilter();
    this.filter.type = 'highpass';
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.15;
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.samples = new Float32Array(1024);
    this.gain.connect(this.analyser);
    this.gain.connect(this.record);
    if (destination) this.monitor.connect(destination);
    this.update({});
    this.deviceChanged = async () => {
      if (!this.stream) return;
      const active = this.stream;
      try {
        const devices = await this.media.enumerateDevices();
        if (
          this.stream === active &&
          this.actualDeviceId &&
          !devices.some((d) => d.deviceId === this.actualDeviceId)
        )
          this.lost('Input disconnected. Reconnect explicitly; monitoring is off.');
      } catch {
        /* Track ended is the fallback when enumeration is unavailable. */
      }
    };
    this.media?.addEventListener?.('devicechange', this.deviceChanged);
  }

  async devices() {
    return (await this.media.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  }

  async open(deviceId) {
    const request = ++this.request;
    this.disconnectStream();
    this.update({ monitor: false });
    this.status = 'connecting';
    this.error = '';
    this.deviceId = deviceId || '';
    let stream;
    try {
      stream = await this.media.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 32 },
          latency: { ideal: 0.005 },
        },
      });
      if (this.disposed || request !== this.request) throw new Error('Input connection cancelled.');
      const track = stream.getAudioTracks()[0];
      if (!track || track.readyState === 'ended') throw new Error('Input is unavailable.');
      const actual = track.getSettings();
      if (deviceId && actual.deviceId && actual.deviceId !== deviceId)
        throw new Error('The selected input is unavailable.');
      this.channelCount = Math.max(1, Math.min(32, actual.channelCount || 1));
      this.actualDeviceId = actual.deviceId;
      this.label = track.label || 'Microphone';
      this.reportedInputLatency = actual.latency;
      this.stream = stream;
      this.source = this.context.createMediaStreamSource(stream);
      track.onended = () => {
        if (this.stream === stream) this.lost('Input disconnected. Reconnect to continue.');
      };
      track.onmute = () => {
        if (this.stream === stream) {
          this.status = 'interrupted';
          this.notifyState();
        }
      };
      track.onunmute = () => {
        if (this.stream === stream) {
          this.status = 'connected';
          this.notifyState();
        }
      };
      this.route();
      this.status = 'connected';
      this.notifyState();
    } catch (error) {
      stream?.getTracks().forEach((t) => t.stop());
      if (request === this.request && !this.disposed) {
        this.disconnectStream();
        this.status = 'disconnected';
        this.error =
          error.name === 'NotAllowedError'
            ? 'Microphone permission denied. Allow access and reconnect.'
            : error.message;
        this.notifyState();
      }
      throw error;
    }
  }

  route() {
    this.source?.disconnect();
    this.splitter?.disconnect();
    if (!this.source) return;
    const channel = this.settings.channel;
    if (channel < 0) {
      this.source.connect(this.gain);
      this.source.connect(this.rawRecord);
    } else if (channel < this.channelCount) {
      this.splitter = this.context.createChannelSplitter(this.channelCount);
      this.source.connect(this.splitter);
      this.splitter.connect(this.gain, channel, 0);
      this.splitter.connect(this.rawRecord, channel, 0);
    } else throw new Error('Selected input channel is unavailable. Choose an available channel.');
  }

  update(patch) {
    const previous = this.settings;
    const next = { ...previous, ...patch };
    for (const [key, lo, hi] of [
      ['gainDb', -60, 24],
      ['highpass', 20, 300],
      ['channel', -1, 31],
    ]) {
      const value = Number(next[key]);
      next[key] = Number.isFinite(value) ? Math.max(lo, Math.min(hi, value)) : previous[key];
    }
    next.channel = Math.round(next.channel);
    if (this.source && next.channel >= this.channelCount)
      throw new Error('Selected input channel is unavailable.');
    this.settings = next;
    const set = (param, value) => param.setTargetAtTime(value, this.context.currentTime, 0.005);
    set(this.gain.gain, Math.pow(10, next.gainDb / 20));
    const gate = (param, enabled) => {
      param.cancelScheduledValues(this.context.currentTime);
      // Safety OFF must reach mathematical zero, not an asymptotic fade that can
      // leak the first input samples or residual audio into an unarmed recording.
      if (!enabled) param.setValueAtTime(0, this.context.currentTime);
      else set(param, 1);
    };
    gate(this.record.gain, next.armed);
    // Capture-only authorization gate: do not bake the monitor fade into the
    // raw source and then apply that fade a second time during editable replay.
    this.rawRecord.gain.cancelScheduledValues(this.context.currentTime);
    this.rawRecord.gain.setValueAtTime(
      next.armed || next.monitor ? 1 : 0,
      this.context.currentTime
    );
    gate(this.monitor.gain, next.monitor);
    set(this.filter.frequency, next.highpass);
    if (previous.channel !== next.channel) this.route();
    // Keep the record/meter branches intact when rebuilding only the monitor FX.
    if (
      !this.fxReady ||
      previous.lowLatency !== next.lowLatency ||
      previous.compression !== next.compression
    ) {
      if (this.fxReady) this.gain.disconnect(this.fxEntry);
      this.filter.disconnect();
      this.compressor.disconnect();
      this.fxEntry = next.lowLatency ? this.monitor : this.filter;
      this.gain.connect(this.fxEntry);
      if (!next.lowLatency) {
        this.filter.connect(next.compression ? this.compressor : this.monitor);
        if (next.compression) this.compressor.connect(this.monitor);
      }
      this.fxReady = true;
    }
    this.notifyState();
  }

  notifyState() {
    this.onStateChange?.({
      ...this.settings,
      status: this.status,
      deviceId: this.deviceId || '',
      channelCount: this.channelCount || 0,
    });
  }

  snapshot() {
    this.analyser.getFloatTimeDomainData(this.samples);
    let peak = 0;
    for (const value of this.samples) peak = Math.max(peak, Math.abs(value));
    if (peak >= 0.99) this.clipUntil = this.context.currentTime + 2;
    return {
      ...this.settings,
      status: this.status,
      error: this.error,
      label: this.label,
      deviceId: this.deviceId,
      channelCount: this.channelCount || 0,
      peak,
      clipping: this.context.currentTime < (this.clipUntil || 0),
      // This is a driver/context estimate, NOT a measured round-trip result.
      estimatedLatencyMs:
        1000 *
        ((this.reportedInputLatency || 0) +
          (this.context.baseLatency || 0) +
          (this.context.outputLatency || 0)),
    };
  }
  disconnectStream() {
    this.source?.disconnect();
    this.splitter?.disconnect();
    this.source = this.splitter = null;
    this.stream?.getTracks().forEach((track) => {
      track.onended = track.onmute = track.onunmute = null;
      track.stop();
    });
    this.stream = null;
  }
  lost(message) {
    this.close();
    this.error = message;
  }
  close() {
    ++this.request;
    this.disconnectStream();
    this.update({ monitor: false });
    this.status = 'disconnected';
    this.notifyState();
  }
  dispose() {
    this.disposed = true;
    this.close();
    this.media?.removeEventListener?.('devicechange', this.deviceChanged);
    for (const node of [
      this.gain,
      this.record,
      this.rawRecord,
      this.monitor,
      this.filter,
      this.compressor,
      this.analyser,
    ])
      node.disconnect();
  }
}
