import * as Tone from 'tone';
import { getAudioAsset } from './audioProjectStore';
import { decodeSourceWindow, sourceWindows } from './arrangementSourceWindow';
import { playbackWindow, needsStreaming } from './arrangementStreaming';
import {
  arrangementDuration,
  arrangementRange,
  arrangementSchedule,
  automationAt,
  linearGain,
  validateArrangement,
} from './arrangementModel';
import { masterGain, normalizeMasterProcessing, masterStemGain, trimGain } from './masterOutput';
import { masterAssistProfile } from './studioAudioEngine';
import { packageAudio } from './arrangementPackaging';
import { createExportSink, exportFrames, wavHeader, StreamZip } from './arrangementStreamExport';
import { instrumentVoice, rollingNotes, VoiceBudget } from './arrangementInstruments';
import {
  createEffectRack,
  createMutableEffectRack,
  rackTopology,
  rackTail,
} from './arrangementEffects';

export function scheduleParameter(
  param,
  points,
  elapsed,
  duration,
  start,
  fallback,
  transform = (value) => value
) {
  param.setValueAtTime(transform(automationAt(points, elapsed, fallback)), start);
  const sorted = [...(points || [])].sort((a, b) => a.time - b.time);
  for (const point of sorted)
    if (point.time > elapsed && point.time < elapsed + duration)
      param.linearRampToValueAtTime(transform(point.value), start + point.time - elapsed);
  param.linearRampToValueAtTime(
    transform(automationAt(points, elapsed + duration, fallback)),
    start + duration
  );
}

function automateTrack(rack, track, cursor, duration, when, scale = 1) {
  scheduleParameter(
    rack.output.gain,
    track.automation?.volume,
    cursor,
    duration,
    when,
    track.gain,
    (value) => linearGain(value) * scale
  );
  if (rack.trackPan)
    scheduleParameter(rack.trackPan.pan, track.automation?.pan, cursor, duration, when, 0);
  for (const [target, bindings] of Object.entries(rack.automationBindings || {})) {
    const points = track.automation?.[target];
    if (!points?.length) continue;
    for (const { param, transform } of bindings)
      scheduleParameter(param, points, cursor, duration, when, points[0].value, transform);
  }
}

function masterGraph(context, settings, output, preMaster = false) {
  const input = new Tone.Gain({ context, gain: preMaster ? 1 : masterGain(settings.level ?? 100) });
  if (preMaster) {
    Tone.connect(input, output);
    return { input, nodes: [input] };
  }
  const processing = normalizeMasterProcessing(settings.processing);
  const inputTrim = new Tone.Gain({ context, gain: trimGain(processing.inputTrim) });
  const limiterDrive = new Tone.Gain({ context, gain: trimGain(processing.limiterDrive) });
  const reference = new Tone.Gain({ context, gain: linearGain(settings.level ?? 100) });
  Tone.connect(reference, output);
  const lowCut = new Tone.Filter({
    context,
    type: 'highpass',
    frequency: processing.bypass ? 20 : processing.lowCut,
    rolloff: -12,
  });
  const eq = new Tone.EQ3({
    context,
    low: processing.bypass ? 0 : processing.low,
    mid: processing.bypass ? 0 : processing.mid,
    high: processing.bypass ? 0 : processing.high,
    lowFrequency: processing.lowFrequency,
    highFrequency: processing.highFrequency,
  });
  const width = new Tone.StereoWidener({
    context,
    width: processing.bypass ? 0.5 : processing.width / 200,
  });
  const compressor = new Tone.Compressor({
    context,
    ...masterAssistProfile(settings.compression, settings.mode),
  });
  const limiter = new Tone.Limiter({ context, threshold: processing.ceiling });
  const limited = new Tone.Gain({ context, gain: settings.limiter !== false ? 1 : 0 });
  const dry = new Tone.Gain({ context, gain: settings.limiter === false ? 1 : 0 });
  const inserts = createMutableEffectRack(context.rawContext, processing.effects);
  input.chain(inputTrim, lowCut, eq, width);
  Tone.connect(width, inserts.input);
  Tone.connect(inserts.output, compressor);
  compressor.chain(limiterDrive, limiter, limited);
  limiterDrive.connect(dry);
  Tone.connect(limited, output);
  Tone.connect(dry, output);
  return {
    input,
    nodes: [
      input,
      inputTrim,
      limiterDrive,
      lowCut,
      eq,
      width,
      inserts,
      compressor,
      limiter,
      limited,
      dry,
      reference,
    ],
    referenceOutput: reference,
    reduction: () => Math.max(0, -(compressor.reduction || 0)),
    update(next) {
      const value = normalizeMasterProcessing(next.processing),
        profile = masterAssistProfile(next.compression, next.mode);
      inserts.update(value.effects || []);
      input.gain.rampTo(masterGain(next.level ?? 100), 0.025);
      inputTrim.gain.rampTo(trimGain(value.inputTrim), 0.04);
      limiterDrive.gain.rampTo(trimGain(value.limiterDrive), 0.04);
      eq.lowFrequency.rampTo(value.lowFrequency, 0.04);
      eq.highFrequency.rampTo(value.highFrequency, 0.04);
      reference.gain.rampTo(linearGain(next.level ?? 100), 0.025);
      lowCut.frequency.rampTo(value.bypass ? 20 : value.lowCut, 0.025);
      for (const key of ['low', 'mid', 'high'])
        eq[key].rampTo(value.bypass ? 0 : value[key], 0.025);
      width.width.rampTo(value.bypass ? 0.5 : value.width / 200, 0.025);
      for (const [key, value] of Object.entries(profile)) compressor[key].value = value;
      limiter.threshold.rampTo(value.ceiling, 0.025);
      limited.gain.rampTo(next.limiter !== false ? 1 : 0, 0.025);
      dry.gain.rampTo(next.limiter === false ? 1 : 0, 0.025);
    },
  };
}

export function pitchFrequency(pitch) {
  const match = /^([A-G])(#?)([0-8])$/.exec(pitch);
  if (!match) throw new Error(`Invalid note: ${pitch}`);
  const semitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]] + (match[2] ? 1 : 0);
  return 440 * 2 ** (((Number(match[3]) + 1) * 12 + semitone - 69) / 12);
}

// A single scheduler drives realtime and offline rendering. Visual RAF never starts,
// stops, fades or automates audio. Every source receives an explicit audio-clock end.
export function scheduleArrangement(
  context,
  project,
  buffers,
  cursor,
  start,
  output,
  options = {}
) {
  const nodes = [],
    sources = [],
    entries = [],
    controls = [],
    raw = context.rawContext;
  const solo = project.tracks.some((track) => track.solo);
  const audible = (track) => !track.muted && (!solo || track.solo);
  const buses = options.trackBuses || new Map(),
    ownsBuses = !options.trackBuses;
  const automatedBuses = new Set();
  const schedule = arrangementSchedule(
    options.liveMix
      ? {
          ...project,
          tracks: project.tracks.map((track) => ({ ...track, muted: false, solo: false })),
        }
      : project,
    cursor
  ).filter((item) => item.delay < (options.windowDuration ?? Infinity));
  // Validate all sources before connecting anything: a damaged later clip must
  // not leave an earlier clip playing after a failed transport start.
  for (const { clip, duration, offset } of schedule)
    if (clip.kind === 'audio') {
      const key = options.sourceKeys?.get(clip.id) || clip.assetId;
      const buffer = buffers.get(key);
      if (!buffer) throw new Error(`Missing audio: ${clip.name}`);
      const windowDuration = Math.min(
        duration,
        (options.windowDuration ?? Infinity) - Math.max(0, clip.start - cursor)
      );
      if (
        offset - (options.sourceOffsets?.get(key) || 0) + windowDuration * clip.rate >
        buffer.duration + 0.001
      )
        throw new Error(
          `Clip exceeds its source: ${clip.name}. Shorten its duration or source offset.`
        );
    }
  try {
    for (const item of schedule) {
      const { track, clip, elapsed, delay, offset } = item,
        when = start + delay,
        duration = Math.min(item.duration, (options.windowDuration ?? Infinity) - delay);
      const nodeStart = nodes.length,
        sourceStart = sources.length,
        controlStart = controls.length;
      const gain = raw.createGain(),
        gate = raw.createGain(),
        volume = raw.createGain(),
        fadeIn = raw.createGain(),
        fadeOut = raw.createGain(),
        pan = raw.createStereoPanner(),
        filter = raw.createBiquadFilter();
      const originalTrack = project.tracks.find((row) => row.id === track.id);
      let rack = buses.get(track.id);
      if (
        (options.liveMix || track.effects?.length || Object.keys(track.automation || {}).length) &&
        !rack
      ) {
        rack = (options.liveMix ? createMutableEffectRack : createEffectRack)(raw, track.effects);
        rack.output.gain.value =
          (audible(originalTrack) ? 1 : 0) *
          linearGain(track.gain) *
          masterStemGain(options.masterStems, track.stemRole);
        rack.trackPan = raw.createStereoPanner();
        rack.nodes.push(rack.trackPan);
        rack.output.connect(rack.trackPan);
        Tone.connect(
          rack.trackPan,
          track.role === 'reference' && options.referenceOutput ? options.referenceOutput : output
        );
        buses.set(track.id, rack);
      }
      if (rack && !automatedBuses.has(track.id)) {
        automateTrack(
          rack,
          track,
          cursor,
          Math.max(
            0.001,
            Math.min(options.windowDuration ?? Infinity, arrangementDuration(project) - cursor)
          ),
          start,
          (audible(originalTrack) ? 1 : 0) * masterStemGain(options.masterStems, track.stemRole)
        );
        automatedBuses.add(track.id);
      }
      gain.gain.value =
        (rack
          ? 1
          : (audible(originalTrack) ? 1 : 0) *
            linearGain(track.gain) *
            masterStemGain(options.masterStems, track.stemRole)) *
        linearGain(clip.gain) *
        (clip.mixGain ?? 1);
      controls.push({
        trackId: track.id,
        clipGain: clip.gain,
        mixGain: clip.mixGain ?? 1,
        gain: gain.gain,
        pan: pan.pan,
        automatedPan: !!clip.automation.pan?.length,
        rack: !!rack,
      });
      filter.type = 'lowpass';
      filter.Q.value = 0;
      scheduleParameter(
        volume.gain,
        clip.automation.volume,
        elapsed,
        duration,
        when,
        100,
        linearGain
      );
      scheduleParameter(filter.frequency, clip.automation.filter, elapsed, duration, when, 20000);
      scheduleParameter(
        pan.pan,
        clip.automation.pan,
        elapsed,
        duration,
        when,
        track.automation?.pan?.length ? 0 : track.pan
      );
      const attack = clip.fadeIn || 0,
        release = clip.fadeOut || 0;
      fadeIn.gain.setValueAtTime(attack ? Math.min(1, elapsed / attack) : 1, when);
      if (attack > elapsed) fadeIn.gain.linearRampToValueAtTime(1, when + attack - elapsed);
      fadeOut.gain.setValueAtTime(release ? Math.min(1, item.duration / release) : 1, when);
      if (release) {
        fadeOut.gain.setValueAtTime(
          Math.min(1, item.duration / release),
          when + Math.max(0, item.duration - release)
        );
        fadeOut.gain.linearRampToValueAtTime(0, when + item.duration);
      }
      if (clip.fadeInCurve) {
        fadeIn.gain.cancelScheduledValues(when);
        scheduleParameter(fadeIn.gain, clip.fadeInCurve, elapsed, duration, when, 1);
      }
      if (clip.fadeOutCurve) {
        fadeOut.gain.cancelScheduledValues(when);
        scheduleParameter(fadeOut.gain, clip.fadeOutCurve, elapsed, duration, when, 1);
      }
      gain.connect(volume).connect(fadeIn).connect(fadeOut);
      if (clip.automation.filter?.length) fadeOut.connect(filter).connect(pan);
      else fadeOut.connect(pan);
      gate.gain.setValueAtTime(options.editFade ? 0 : 1, when);
      if (options.editFade) gate.gain.linearRampToValueAtTime(1, when + Math.min(0.008, duration));
      pan.connect(gate);
      Tone.connect(
        gate,
        rack
          ? rack.input
          : track.role === 'reference' && options.referenceOutput
            ? options.referenceOutput
            : output
      );
      nodes.push(gain, volume, fadeIn, fadeOut, filter, pan, gate);
      if (clip.kind === 'audio') {
        const key = options.sourceKeys?.get(clip.id) || clip.assetId;
        const buffer = buffers.get(key);
        if (!buffer) throw new Error(`Missing audio: ${clip.name}`);
        const source = raw.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = clip.rate;
        source.connect(gain);
        source.start(when, Math.max(0, offset - (options.sourceOffsets?.get(key) || 0)));
        source.stop(when + duration);
        nodes.push(source);
        sources.push(source);
      } else if (options.realtimeMidi) {
        // Only the next 300 ms gets voices. Finished voices disconnect immediately.
        const scheduler = rollingNotes(
          clip.notes || [],
          elapsed,
          when,
          duration,
          (item) => {
            const voice = instrumentVoice(
              raw,
              gain,
              clip,
              item.note,
              item.start,
              item.end - item.start,
              item.elapsed,
              buffers,
              Math.min(clip.duration, item.note.time + item.note.duration) -
                Math.max(elapsed, item.note.time)
            );
            return () => releaseGraph(voice);
          },
          options.voiceBudget
        );
        entries.push({
          id: clip.id,
          trackId: track.id,
          signature: clipSoundKey(track, clip),
          nodes: nodes.slice(nodeStart),
          sources: [],
          controls: controls.slice(controlStart),
          gate: gate.gain,
          midi: scheduler,
        });
        continue;
      } else {
        for (const note of clip.notes || []) {
          const noteEnd = Math.min(clip.duration, elapsed + duration, note.time + note.duration),
            noteStart = Math.max(elapsed, note.time);
          if (
            noteEnd <= noteStart ||
            noteStart - elapsed + delay >= (options.windowDuration ?? Infinity)
          )
            continue;
          const at = when + noteStart - elapsed,
            length = noteEnd - noteStart;
          const voice = instrumentVoice(
            raw,
            gain,
            clip,
            note,
            at,
            length,
            noteStart - note.time,
            buffers,
            Math.min(clip.duration, note.time + note.duration) - noteStart
          );
          nodes.push(...voice.nodes);
          sources.push(...voice.sources);
        }
      }
      entries.push({
        id: clip.id,
        trackId: track.id,
        signature: clipSoundKey(track, clip),
        nodes: nodes.slice(nodeStart),
        sources: sources.slice(sourceStart),
        controls: controls.slice(controlStart),
        gate: gate.gain,
      });
    }
    return { nodes, sources, controls, entries, buses, ownsBuses };
  } catch (error) {
    releaseGraph({ nodes, sources, entries, buses, ownsBuses });
    throw error;
  }
}

function clipSoundKey(track, clip) {
  // Names, overview samples and mixer values do not change a clip's scheduled sound.
  const sound = { ...clip };
  delete sound.name;
  delete sound.waveform;
  return JSON.stringify([track.id, track.role, sound]);
}

function releaseGraph(graph) {
  if (!graph) return;
  graph.midi?.cancel();
  for (const entry of graph.entries || []) entry.midi?.cancel();
  for (const source of graph.sources || []) {
    try {
      source.stop();
    } catch {
      /* Already ended. */
    }
  }
  for (const node of graph.nodes || []) {
    if (node.dispose) node.dispose();
    else node.disconnect();
  }
  if (graph.ownsBuses) for (const rack of graph.buses?.values() || []) rack.dispose();
}

export class ArrangementEngine {
  constructor(context, output, sharedMaster = null) {
    this.context = context;
    this.output = output;
    this.sharedMaster = sharedMaster;
    this.buffers = new Map();
    this.generation = 0;
    this.cursor = 0;
    this.playing = false;
  }
  playbackMaster(settings) {
    if (!this.sharedMaster) return masterGraph(this.context, settings, this.output);
    // The live engine owns the sole program chain. Do not dispose it when the
    // arranger pauses. Printed references already contain master processing.
    const reference = new Tone.Gain({
      context: this.context,
      gain: linearGain(settings.level ?? 100),
    });
    Tone.connect(reference, this.output);
    return {
      input: this.sharedMaster.input,
      referenceOutput: reference,
      nodes: [reference],
      reduction: this.sharedMaster.reduction,
      update(next) {
        reference.gain.rampTo(linearGain(next.level ?? 100), 0.025);
      },
    };
  }
  async prepare(project, prune = true, window = null) {
    validateArrangement(project);
    const relevantClips = project.tracks
      .filter((track) => !track.offline)
      .flatMap((track) =>
        track.clips
          .filter(
            (clip) => !clip.disabled && (clip.kind === 'audio' || clip.instrument === 'sampler')
          )
          .filter(
            (clip) =>
              !window || (clip.start < window.end && clip.start + clip.duration > window.start)
          )
      );
    const ids = new Set(relevantClips.map((clip) => clip.assetId));
    if (prune) for (const id of [...this.buffers.keys()]) if (!ids.has(id)) this.buffers.delete(id);
    this.bufferOffsets ||= new Map();
    this.windowedBuffers ||= new Set();
    this.clipSourceKeys = new Map();
    if (window) {
      this.buffers.clear();
      this.bufferOffsets.clear();
      this.windowedBuffers.clear();
    }
    const budget = window?.budget ?? 384 * 1024 * 1024;
    const used = () =>
      [...this.buffers.values()].reduce(
        (sum, buffer) => sum + (buffer.length || 0) * (buffer.numberOfChannels || 2) * 4,
        0
      );
    for (const id of ids) {
      if (window || this.windowedBuffers.has(id)) this.buffers.delete(id);
      if (!this.buffers.has(id)) {
        const asset = await getAudioAsset(id);
        if (!asset?.blob)
          throw new Error(
            `Arrangement audio is missing (${id}). Reimport the original project with embedded audio.`
          );
        const clips = relevantClips.filter((clip) => clip.assetId === id);
        if (window && clips.every((clip) => clip.kind === 'audio')) {
          const ranges = sourceWindows(clips, window);
          for (const [index, range] of ranges.entries()) {
            const decoded = await decodeSourceWindow(
              this.context.rawContext,
              asset.blob,
              range.start,
              range.end,
              budget - used(),
              { signal: window.signal }
            );
            const key = ranges.length === 1 ? id : `${id}:window:${index}`;
            this.buffers.set(key, decoded.buffer);
            this.bufferOffsets.set(key, decoded.offset);
            this.windowedBuffers.add(key);
            for (const clipId of range.clips) this.clipSourceKeys.set(clipId, key);
          }
          continue;
        }
        const estimated =
          Math.max(...clips.map((clip) => clip.sourceDuration || 0)) *
          (this.context.rawContext.sampleRate || 48000) *
          8;
        if (used() + estimated > budget)
          throw new Error(
            `Decoded sources exceed the ${Math.round(budget / 1048576)} MiB audio budget. Use windowed arrangement playback/export or shorter sampler sources. Your project is unchanged.`
          );
        const buffer = await this.context.rawContext.decodeAudioData(
          await asset.blob.arrayBuffer()
        );
        if (used() + buffer.length * buffer.numberOfChannels * 4 > budget)
          throw new Error(
            `Decoded sources exceed the ${Math.round(budget / 1048576)} MiB audio budget. Use shorter source files.`
          );
        this.buffers.set(id, buffer);
        this.bufferOffsets.set(id, 0);
        this.windowedBuffers.delete(id);
      }
    }
  }
  position() {
    if (this.playing && this.loop) {
      const elapsed =
        this.cursor -
        this.loop.start +
        Math.max(0, this.context.rawContext.currentTime - this.startedAt);
      return this.loop.start + (elapsed % (this.loop.end - this.loop.start));
    }
    return this.playing
      ? Math.min(
          this.end,
          this.cursor + Math.max(0, this.context.rawContext.currentTime - this.startedAt)
        )
      : this.cursor;
  }
  pause() {
    this.streamDecodeController?.abort();
    for (const cleanup of this.auditions || []) cleanup();
    const position = this.position();
    this.generation++;
    this.playing = false;
    this.cursor = position;
    clearInterval(this.loopTimer);
    clearInterval(this.midiTimer);
    clearInterval(this.streamTimer);
    this.streaming = false;
    for (const part of this.streamGraphs || []) releaseGraph(part);
    this.streamGraphs = [];
    this.midiTimer = null;
    this.loopTimer = null;
    for (const part of this.loopGraphs || []) releaseGraph(part);
    this.loopGraphs = [];
    for (const retired of this.retired || []) {
      clearTimeout(retired.timer);
      releaseGraph(retired.graph);
    }
    this.retired = [];
    releaseGraph(this.graph);
    this.graph = null;
    return position;
  }
  stop() {
    this.pause();
    this.cursor = 0;
  }
  async play(project, cursor = 0, settings = {}, loop = null) {
    this.pause();
    this.error = null;
    this.loop = null;
    this.masterStems = settings.processing?.stems;
    this.masterSettings = settings;
    this.voiceBudget = new VoiceBudget();
    this.liveProject = project;
    if (
      loop &&
      (!Number.isFinite(loop.start) ||
        !Number.isFinite(loop.end) ||
        loop.start < 0 ||
        loop.end - loop.start < 0.25 ||
        loop.end > 86400)
    )
      throw new Error('Loop must be at least 0.25 seconds and within the timeline.');
    const generation = this.generation;
    if (needsStreaming(project))
      return this.playStream(project, cursor, settings, loop, generation);
    await this.prepare(project);
    if (generation !== this.generation) return false;
    this.cursor = Math.max(0, cursor);
    const contentEnd = arrangementDuration(project);
    if (!contentEnd) return false;
    this.end = contentEnd + rackTail(settings.processing?.effects);
    if (!loop && this.cursor >= this.end) return false;
    const when = this.context.rawContext.currentTime + 0.04;
    const master = this.playbackMaster(settings);
    try {
      if (loop) {
        this.loop = { ...loop };
        this.cursor = cursor >= loop.start && cursor < loop.end ? cursor : loop.start;
        this.startedAt = when;
        this.end = Infinity;
        this.graph = {
          nodes: master.nodes,
          sources: [],
          controls: [],
          master,
          buses: new Map(),
          ownsBuses: true,
        };
        this.liveProject = project;
        this.loopGraphs = [];
        this.nextLoopAt = when;
        this.nextLoopCursor = this.cursor;
        this.playing = true;
        this.queueLoops();
        this.startMidiClock();
        this.loopTimer = setInterval(() => {
          try {
            this.queueLoops();
          } catch (error) {
            this.pause();
            this.error = error.message;
          }
        }, 100);
        return true;
      }
      const scheduled = scheduleArrangement(
        this.context,
        project,
        this.buffers,
        this.cursor,
        when,
        master.input,
        {
          liveMix: true,
          referenceOutput: master.referenceOutput,
          masterStems: this.masterStems,
          realtimeMidi: true,
          voiceBudget: this.voiceBudget,
        }
      );
      this.graph = {
        ...scheduled,
        nodes: [...scheduled.nodes, ...master.nodes],
        sources: scheduled.sources,
      };
      this.graph.controls = scheduled.controls;
      this.graph.entries = scheduled.entries;
      this.graph.master = master;
      this.startedAt = when;
      this.playing = true;
      this.startMidiClock();
      return true;
    } catch (error) {
      if (this.graph) this.pause();
      else releaseGraph({ nodes: master.nodes });
      throw error;
    }
  }
  async playStream(project, cursor, settings, loop, generation) {
    this.buffers.clear();
    this.loop = loop ? { ...loop } : null;
    this.cursor =
      loop && (cursor < loop.start || cursor >= loop.end) ? loop.start : Math.max(0, cursor);
    this.end = loop
      ? Infinity
      : arrangementDuration(project) + rackTail(settings.processing?.effects);
    if (!arrangementDuration(project) || this.cursor >= this.end) return false;
    const master = this.playbackMaster(settings);
    this.graph = {
      nodes: master.nodes,
      sources: [],
      controls: [],
      master,
      buses: new Map(),
      ownsBuses: true,
    };
    this.streaming = true;
    this.streamDecodeController = new AbortController();
    const decodeSignal = this.streamDecodeController.signal;
    this.streamGraphs = [];
    this.streamFrom = this.cursor;
    this.startedAt = null;
    const enqueue = async () => {
      if (generation !== this.generation) return;
      const from = this.streamFrom;
      const end = Math.min(from + 8, this.loop?.end ?? this.end);
      if (end <= from) return;
      const selection = playbackWindow(this.liveProject, from, end);
      // Private maps prevent a cancelled asynchronous read from corrupting the
      // source cache belonging to a later seek or playback operation.
      const loader = { context: this.context, buffers: new Map() };
      await ArrangementEngine.prototype.prepare.call(loader, selection, true, {
        start: from,
        end,
        budget: 128 * 1024 * 1024,
        signal: decodeSignal,
      });
      if (generation !== this.generation) return;
      const now = this.context.rawContext.currentTime;
      if (this.startedAt == null) {
        this.startedAt = now + 0.15;
        this.streamAt = this.startedAt;
      }
      if (now > this.streamAt - 0.015)
        throw new Error(
          'Audio streaming missed its deadline. Playback stopped; your project is unchanged.'
        );
      const part = scheduleArrangement(
        this.context,
        selection,
        loader.buffers,
        from,
        this.streamAt,
        master.input,
        {
          liveMix: true,
          referenceOutput: master.referenceOutput,
          masterStems: this.masterStems,
          realtimeMidi: true,
          voiceBudget: this.voiceBudget,
          trackBuses: this.graph.buses,
          windowDuration: end - from,
          sourceOffsets: loader.bufferOffsets,
          sourceKeys: loader.clipSourceKeys,
        }
      );
      part.startsAt = this.streamAt;
      part.endsAt = this.streamAt + end - from;
      part.from = from;
      this.streamGraphs.push(part);
      this.streamAt = part.endsAt;
      this.streamFrom = this.loop && end >= this.loop.end ? this.loop.start : end;
      this.graph.controls = this.streamGraphs.flatMap((item) => item.controls);
    };
    try {
      await enqueue();
      if (generation !== this.generation) return false;
      this.playing = true;
      this.startMidiClock();
      const pump = () => {
        if (generation !== this.generation || !this.playing) return;
        const now = this.context.rawContext.currentTime;
        this.streamGraphs = this.streamGraphs.filter((part) => {
          if (part.endsAt > now) return true;
          releaseGraph(part);
          return false;
        });
        this.graph.controls = this.streamGraphs.flatMap((part) => part.controls);
        if (
          !this.streamPending &&
          this.streamAt < now + 4 &&
          (this.loop || this.streamFrom < this.end)
        ) {
          this.streamPending = true;
          void enqueue()
            .catch((error) => {
              if (generation === this.generation) {
                this.pause();
                this.error = error.message;
              }
            })
            .finally(() => {
              if (generation === this.generation) this.streamPending = false;
            });
        }
      };
      this.streamPending = false;
      this.streamTimer = setInterval(pump, 50);
      return true;
    } catch (error) {
      if (generation === this.generation) this.pause();
      throw error;
    }
  }
  startMidiClock() {
    const pump = () => {
      const now = this.context.rawContext.currentTime;
      const parts = this.streaming ? this.streamGraphs : this.loop ? this.loopGraphs : [this.graph];
      for (const part of parts || [])
        for (const entry of part?.entries || []) entry.midi?.pump(now);
    };
    pump();
    this.midiTimer = setInterval(() => {
      try {
        pump();
      } catch (error) {
        this.pause();
        this.error = error.message;
      }
    }, 25);
  }
  async revise(project) {
    if (!this.playing) return false;
    if (this.streaming)
      return this.play(project, this.position(), this.masterSettings || {}, this.loop);
    const buses = this.graph?.buses || new Map();
    if (
      project.tracks.some(
        (track) =>
          !buses.get(track.id)?.mutable &&
          rackTopology(track.effects) !== (buses.get(track.id)?.topology || '[]')
      ) ||
      [...buses.keys()].some((id) => !project.tracks.some((track) => track.id === id))
    ) {
      return this.play(project, this.position(), this.masterSettings || {}, this.loop);
    }
    const generation = this.generation,
      revision = (this.revision || 0) + 1;
    this.revision = revision;
    await this.prepare(project);
    if (!this.playing || generation !== this.generation || revision !== this.revision) return false;
    const now = this.context.rawContext.currentTime,
      at = now + 0.03;
    const plans = [];
    try {
      const regions = this.loop
        ? this.loopGraphs
            .filter((part) => part.endsAt > at)
            .map((part) => ({
              graph: part,
              project: arrangementRange(project, part.from, this.loop.end),
              cursor: Math.max(0, at - part.startsAt),
              when: Math.max(at, part.startsAt),
            }))
        : [
            {
              graph: this.graph,
              project,
              cursor: this.cursor + Math.max(0, at - this.startedAt),
              when: at,
            },
          ];
      for (const region of regions) {
        const wanted = new Map(
          region.project.tracks
            .filter((track) => !track.offline)
            .flatMap((track) =>
              track.clips
                .filter((clip) => !clip.disabled && clip.start + clip.duration > region.cursor)
                .map((clip) => [clip.id, clipSoundKey(track, clip)])
            )
        );
        const keep = (region.graph.entries || []).filter(
          (entry) => wanted.get(entry.id) === entry.signature
        );
        const kept = new Set(keep.map((entry) => entry.id));
        const subset = {
          ...region.project,
          tracks: region.project.tracks.map((track) => ({
            ...track,
            clips: track.clips.filter((clip) => !kept.has(clip.id)),
          })),
        };
        const replacement = scheduleArrangement(
          this.context,
          subset,
          this.buffers,
          region.cursor,
          region.when,
          this.graph.master.input,
          {
            liveMix: true,
            editFade: true,
            referenceOutput: this.graph.master.referenceOutput,
            masterStems: this.masterStems,
            realtimeMidi: true,
            voiceBudget: this.voiceBudget,
            trackBuses: region.graph.buses,
          }
        );
        plans.push({
          ...region,
          keep,
          replacement,
          remove: (region.graph.entries || []).filter((entry) => !kept.has(entry.id)),
        });
      }
    } catch (error) {
      for (const plan of plans) releaseGraph(plan.replacement);
      throw error;
    }
    // All replacements have been validated before altering the sounding graph.
    for (const plan of plans) {
      for (const entry of plan.remove) {
        // Stop the old note queue now; its sounding voices fade with this entry's gate.
        // cancellation/disconnection is delayed with the retired graph below.
        if (entry.midi) entry.midi.pump = () => {};
        entry.gate.cancelScheduledValues(at);
        entry.gate.setValueAtTime(1, at);
        entry.gate.linearRampToValueAtTime(0, at + 0.008);
        for (const source of entry.sources) {
          try {
            source.stop(at + 0.008);
          } catch {
            /* Ended. */
          }
        }
        const retired = { graph: entry };
        this.retired ??= [];
        this.retired.push(retired);
        retired.timer = setTimeout(() => {
          releaseGraph(entry);
          this.retired = this.retired.filter((item) => item !== retired);
        }, 100);
      }
      plan.graph.entries = [...plan.keep, ...plan.replacement.entries];
      plan.graph.nodes = [
        ...(plan.graph === this.graph ? this.graph.master.nodes : []),
        ...plan.graph.entries.flatMap((entry) => entry.nodes),
      ];
      plan.graph.sources = plan.graph.entries.flatMap((entry) => entry.sources);
      plan.graph.controls = plan.graph.entries.flatMap((entry) => entry.controls);
    }
    if (this.loop) this.graph.controls = this.loopGraphs.flatMap((part) => part.controls);
    else
      this.end = arrangementDuration(project) + rackTail(this.masterSettings?.processing?.effects);
    this.updateMix(project);
    return true;
  }
  queueLoops() {
    const now = this.context.rawContext.currentTime;
    this.loopGraphs = this.loopGraphs.filter((graph) => {
      if (graph.endsAt > now) return true;
      releaseGraph(graph);
      return false;
    });
    if (this.nextLoopAt < now - 0.05)
      throw new Error(
        'Loop scheduling fell behind the audio clock. Playback stopped; keep the studio tab active.'
      );
    while (this.nextLoopAt < now + 1.5) {
      const from = this.nextLoopCursor;
      const section = arrangementRange(this.liveProject, from, this.loop.end);
      const graph = scheduleArrangement(
        this.context,
        section,
        this.buffers,
        0,
        this.nextLoopAt,
        this.graph.master.input,
        {
          liveMix: true,
          referenceOutput: this.graph.master.referenceOutput,
          masterStems: this.masterStems,
          realtimeMidi: true,
          voiceBudget: this.voiceBudget,
          trackBuses: this.graph.buses,
        }
      );
      graph.endsAt = this.nextLoopAt + this.loop.end - from;
      graph.startsAt = this.nextLoopAt;
      graph.from = from;
      this.loopGraphs.push(graph);
      this.nextLoopAt = graph.endsAt;
      this.nextLoopCursor = this.loop.start;
    }
    this.graph.controls = this.loopGraphs.flatMap((part) => part.controls);
  }
  noteOn(pitch, velocity = 0.7, instrument = 'triangle', settings = {}, voiceContext = {}) {
    const raw = this.context.rawContext,
      at = raw.currentTime;
    const gain = raw.createGain(),
      pan = raw.createStereoPanner();
    const track = voiceContext?.track;
    const solo = voiceContext?.project?.tracks.some((row) => row.solo);
    gain.gain.value = track
      ? track.muted || track.offline || (solo && !track.solo)
        ? 0
        : linearGain(track.gain) *
          linearGain(voiceContext.clip?.gain) *
          masterStemGain(settings.processing?.stems, track.stemRole)
      : 1;
    pan.pan.value = track?.pan || 0;
    this.voiceMaster ??= this.playbackMaster(settings);
    this.voiceMaster.update(settings);
    const master = this.voiceMaster;
    gain.connect(pan);
    let keyboardRack;
    if (track) {
      this.keyboardRacks ??= new Map();
      keyboardRack = this.keyboardRacks.get(track.id);
      if (!keyboardRack) {
        keyboardRack = createMutableEffectRack(raw, track.effects);
        Tone.connect(keyboardRack.output, master.input);
        this.keyboardRacks.set(track.id, keyboardRack);
      }
      keyboardRack.update(track.effects);
      keyboardRack.output.gain.value =
        gain.gain.value / Math.max(0.000001, linearGain(voiceContext.clip?.gain));
      gain.gain.value = linearGain(voiceContext.clip?.gain);
      pan.connect(keyboardRack.input);
    } else Tone.connect(pan, master.input);
    const voice = instrumentVoice(
      raw,
      gain,
      { ...voiceContext?.clip, instrument },
      { pitch, velocity },
      at,
      300,
      0,
      this.buffers
    );
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      gain.gain.cancelScheduledValues(raw.currentTime);
      gain.gain.setTargetAtTime(0, raw.currentTime, 0.01);
      for (const source of voice.sources) {
        try {
          source.stop(raw.currentTime + 0.05);
        } catch {
          /* Ended sample. */
        }
      }
    };
    this.voices ??= new Set();
    if (this.voices.size >= 64) {
      const oldest = this.voices.values().next().value;
      oldest();
      this.voices.delete(oldest);
    }
    this.voices.add(stop);
    const cleanup = () => {
      releaseGraph(voice);
      gain.disconnect();
      pan.disconnect();
      this.voices.delete(stop);
    };
    if (voice.sources.length) voice.sources[0].onended = cleanup;
    else cleanup();
    return stop;
  }
  async audition(note, clip, track, project, settings = {}) {
    const generation = this.generation;
    const preview = {
      ...project,
      tracks: project.tracks.map((row) => ({
        ...row,
        clips: row.id === track.id ? [{ ...clip, start: 0, notes: [note] }] : [],
      })),
    };
    // Audition never decodes unrelated audio tracks or evicts playing assets.
    await this.prepare(preview, false);
    if (generation !== this.generation) return;
    this.voiceMaster ??= this.playbackMaster(settings);
    this.voiceMaster.update(settings);
    this.auditions ??= new Set();
    if (this.auditions.size >= 16) this.auditions.values().next().value();
    const graph = scheduleArrangement(
      this.context,
      preview,
      this.buffers,
      note.time,
      this.context.rawContext.currentTime + 0.01,
      this.voiceMaster.input,
      { masterStems: settings.processing?.stems }
    );
    const cleanup = () => {
      clearTimeout(timer);
      releaseGraph(graph);
      this.auditions.delete(cleanup);
    };
    const timer = setTimeout(
      cleanup,
      (Math.min(note.duration, clip.duration - note.time) + rackTail(track.effects)) * 1000 + 100
    );
    this.auditions.add(cleanup);
  }
  setMasterSettings(settings) {
    this.masterSettings = settings;
    this.masterStems = settings.processing?.stems;
    this.graph?.master?.update(settings);
    this.voiceMaster?.update(settings);
    if (this.liveProject && !this.loop)
      this.end = arrangementDuration(this.liveProject) + rackTail(settings.processing?.effects);
    if (this.liveProject) this.updateMix(this.liveProject);
  }
  getReduction() {
    return this.graph?.master?.reduction?.() || 0;
  }
  updateMix(project) {
    const end =
      this.playing && !this.loop
        ? arrangementDuration(project) + rackTail(this.masterSettings?.processing?.effects)
        : this.end;
    const solo = project.tracks.some((track) => track.solo);
    const now = this.context.rawContext.currentTime;
    for (const [id, rack] of [...(this.graph?.buses || []), ...(this.keyboardRacks || [])]) {
      const track = project.tracks.find((row) => row.id === id);
      if (track && (rack.mutable || rack.topology === rackTopology(track.effects)))
        rack.update(track.effects || [], now);
      // A scheduled endpoint must not ramp a muted bus back up later.
      rack.output.gain.cancelScheduledValues(now);
      rack.output.gain.setTargetAtTime(
        track && !track.muted && !track.offline && (!solo || track.solo)
          ? linearGain(track.gain) * masterStemGain(this.masterStems, track.stemRole)
          : 0,
        now,
        0.01
      );
      if (track && this.playing && this.graph?.buses?.has(id)) {
        for (const bindings of Object.values(rack.automationBindings || {}))
          for (const { param } of bindings) param.cancelScheduledValues(now);
        rack.output.gain.cancelScheduledValues(now);
        rack.trackPan?.pan.cancelScheduledValues(now);
        automateTrack(
          rack,
          track,
          this.position(),
          Math.max(0.001, (this.loop?.end ?? end) - this.position()),
          now,
          !track.muted && !track.offline && (!solo || track.solo)
            ? masterStemGain(this.masterStems, track.stemRole)
            : 0
        );
        if (this.loop)
          for (const part of (this.streaming ? this.streamGraphs : this.loopGraphs) || []) {
            if (part.startsAt <= now) continue;
            automateTrack(
              rack,
              track,
              part.from,
              this.loop.end - part.from,
              part.startsAt,
              !track.muted && !track.offline && (!solo || track.solo)
                ? masterStemGain(this.masterStems, track.stemRole)
                : 0
            );
          }
      }
    }
    for (const control of this.graph?.controls || []) {
      const track = project.tracks.find((row) => row.id === control.trackId);
      const gain =
        track && (control.rack || (!track.offline && !track.muted && (!solo || track.solo)))
          ? (control.rack
              ? 1
              : linearGain(track.gain) * masterStemGain(this.masterStems, track.stemRole)) *
            linearGain(control.clipGain) *
            (control.mixGain ?? 1)
          : 0;
      control.gain.setTargetAtTime(gain, now, 0.01);
      if (track && !control.automatedPan)
        control.pan.setTargetAtTime(track.automation?.pan?.length ? 0 : track.pan, now, 0.01);
    }
    // Failed insert validation must not leak rejected edits into future streamed windows.
    this.liveProject = project;
    this.end = end;
  }
  async render(
    project,
    settings = {},
    trackId = null,
    sampleRate = 48000,
    duration = arrangementDuration(project) + (trackId ? 0 : rackTail(settings.processing?.effects))
  ) {
    if (!duration || !arrangementDuration(project)) throw new Error('Add a clip before exporting.');
    // Offline rendering needs contiguous PCM. Fail clearly before allocating a
    // multi-gigabyte buffer rather than risking the user's unsaved session.
    if (duration * sampleRate * 8 > 512 * 1024 * 1024)
      throw new Error(
        'This mix exceeds the 512 MB offline render budget. Export a shorter arrangement.'
      );
    await this.prepare(project);
    const offline = new Tone.OfflineContext(2, duration + 0.1, sampleRate);
    let graph;
    try {
      const selection = trackId
        ? { ...project, tracks: project.tracks.filter((track) => track.id === trackId) }
        : project;
      const master = masterGraph(offline, settings, offline.rawContext.destination, !!trackId);
      graph = { nodes: master.nodes, sources: [] };
      const scheduled = scheduleArrangement(offline, selection, this.buffers, 0, 0, master.input, {
        referenceOutput: master.referenceOutput || offline.rawContext.destination,
        masterStems: trackId ? undefined : settings.processing?.stems,
      });
      graph = {
        ...scheduled,
        nodes: [...scheduled.nodes, ...master.nodes],
        sources: scheduled.sources,
      };
      return (await offline.render()).get();
    } finally {
      releaseGraph(graph);
      offline.dispose();
    }
  }
  async renderSection(project, settings, trackId, firstFrame, frameCount, sampleRate = 48000) {
    // Pre-roll exceeds the longest master release by >40x. Retain original clip
    // coordinates so note phase, fades and automation are not restarted at joins.
    const preFrames = Math.min(
      firstFrame,
      Math.ceil(
        Math.max(
          12,
          ...project.tracks.map(
            (track) =>
              rackTail(track.effects, track.automation) +
              (trackId ? 0 : rackTail(settings.processing?.effects)) +
              2
          )
        )
      ) * sampleRate
    );
    const from = (firstFrame - preFrames) / sampleRate;
    const duration = (frameCount + preFrames) / sampleRate;
    const end = from + duration;
    const solo = project.tracks.some((track) => track.solo);
    const selection = {
      ...project,
      tracks: project.tracks
        .filter(
          (track) =>
            !track.offline &&
            !track.muted &&
            (!solo || track.solo) &&
            (!trackId || track.id === trackId)
        )
        .map((track) => ({
          ...track,
          clips: track.clips.filter(
            (clip) =>
              !clip.disabled &&
              clip.start < end &&
              clip.start + clip.duration > from &&
              (clip.kind !== 'midi' ||
                clip.notes.some(
                  (note) =>
                    clip.start + note.time < end &&
                    clip.start + Math.min(clip.duration, note.time + note.duration) > from
                ))
          ),
        })),
    };
    await this.prepare(selection, true, { start: from, end });
    if (!selection.tracks.some((track) => track.clips.length))
      return [new Float32Array(frameCount), new Float32Array(frameCount)];
    const offline = new Tone.OfflineContext(2, duration, sampleRate);
    let graph;
    try {
      const master = masterGraph(offline, settings, offline.rawContext.destination, !!trackId);
      graph = { nodes: master.nodes, sources: [] };
      const scheduled = scheduleArrangement(
        offline,
        selection,
        this.buffers,
        from,
        0,
        master.input,
        {
          referenceOutput: master.referenceOutput || offline.rawContext.destination,
          masterStems: trackId ? undefined : settings.processing?.stems,
          windowDuration: duration,
          sourceOffsets: this.bufferOffsets,
          sourceKeys: this.clipSourceKeys,
        }
      );
      graph = {
        ...scheduled,
        nodes: [...scheduled.nodes, ...master.nodes],
        sources: scheduled.sources,
      };
      // All events above use the native audio timeline. This bounded context
      // needs no wall-clock waits (background tabs throttle timer-based yields).
      const buffer = (await offline.render(false)).get();
      return [0, 1].map((channel) =>
        buffer.getChannelData(channel).slice(preFrames, preFrames + frameCount)
      );
    } finally {
      releaseGraph(graph);
      offline.dispose();
    }
  }
  async export(
    project,
    settings,
    stems = false,
    onProgress = () => {},
    cancelled = () => false,
    range = null
  ) {
    if (this.playing) throw new Error('Pause arrangement playback before exporting.');
    // Keep absolute source coordinates and pre-range signal history. Cropping
    // clips first resets delay/reverb, automation and oscillator phase.
    const snapshot = structuredClone(project);
    if (
      range &&
      (!Number.isFinite(range.start) ||
        !Number.isFinite(range.end) ||
        range.start < 0 ||
        range.end <= range.start ||
        range.end > 86400)
    )
      throw new Error('Choose an export range with an end after its start.');
    validateArrangement(snapshot);
    if (!arrangementDuration(snapshot)) throw new Error('Add a clip before exporting.');
    const duration = range
      ? range.end - range.start
      : arrangementDuration(snapshot) + (stems ? 0 : rackTail(settings?.processing?.effects));
    if (!Number.isFinite(duration) || duration <= 0)
      throw new Error('Add a clip before exporting.');
    const rangeFirst = range ? Math.round(range.start * 48000) : 0;
    const frames = range ? Math.round(range.end * 48000) - rangeFirst : exportFrames(duration),
      header = wavHeader(frames);
    const solo = snapshot.tracks.some((track) => track.solo);
    const tracks = stems
      ? snapshot.tracks.filter(
          (track) => track.clips.length && !track.offline && !track.muted && (!solo || track.solo)
        )
      : [null];
    if (!tracks.length) throw new Error('No audible tracks to export.');
    const expected = (frames * 6 + header.length + 512) * tracks.length + 4096;
    const check = () => {
      if (cancelled()) throw new Error('Export cancelled.');
    };
    check();
    onProgress('Preparing temporary disk space for export…');
    const sink = await createExportSink(expected, stems ? 'zip' : 'wav');
    const zip = stems ? new StreamZip(sink) : null;
    this.buffers.clear();
    try {
      for (const [index, track] of tracks.entries()) {
        check();
        if (zip) {
          await zip.begin(
            `${String(index + 1).padStart(2, '0')}-${track.name.replace(/[^a-z0-9_-]/gi, '-').slice(0, 80)}.wav`,
            frames * 6 + header.length
          );
          await zip.data(header);
        } else await sink.write(header);
        for (let first = 0; first < frames; first += 30 * 48000) {
          check();
          const count = Math.min(30 * 48000, frames - first);
          onProgress(
            `Rendering ${track ? track.name : 'mix'} · ${Math.floor(((index * frames + first) / (frames * tracks.length)) * 100)}% · ${(first / 48000 / 60).toFixed(1)} / ${(frames / 48000 / 60).toFixed(1)} min`
          );
          check();
          const channels = await this.renderSection(
            snapshot,
            settings,
            track?.id || null,
            rangeFirst + first,
            count
          );
          check();
          const encoded = await packageAudio(
            { type: 'pcm', channels, crc: zip?.entry.crc },
            cancelled
          );
          check();
          if (zip) await zip.data(encoded.bytes, encoded.crc);
          else await sink.write(encoded.bytes);
        }
        if (zip) await zip.end();
      }
      if (zip) {
        const readme = new TextEncoder().encode(
          'StemDeck: aligned 48 kHz / 24-bit PCM stereo track stems. Post track gain, pan, fades and clip automation; PRE master processing. No per-track normalization or AI separation. ZIP64 supports large archives; WAV files larger than 4 GiB use RF64. Keep the export cache until your download has completed.'
        );
        await zip.begin('README.txt', readme.length);
        await zip.data(readme);
        await zip.end();
        await zip.finish();
      }
      check();
      const file = await sink.finish();
      onProgress('Export complete · download ready. Clear its temporary cache after saving.');
      return file;
    } catch (error) {
      await sink.abort();
      if (error?.name === 'QuotaExceededError')
        throw new Error(
          'Browser disk space ran out. Partial export removed; your project and source audio are unchanged.'
        );
      throw error;
    } finally {
      this.buffers.clear();
    }
  }
  dispose() {
    this.stop();
    for (const cleanup of this.auditions || []) cleanup();
    for (const stop of this.voices || []) stop();
    releaseGraph(this.voiceMaster);
    for (const rack of this.keyboardRacks?.values() || []) rack.dispose();
    this.keyboardRacks?.clear();
    this.voiceMaster = null;
    this.buffers.clear();
  }
}
