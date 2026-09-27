import { createContext, createElement, useContext, useSyncExternalStore } from 'react';

export const METER_FLOOR_DB = -60;
export const PEAK_HOLD_MS = 1500;
export const PEAK_FALL_DB_PER_SECOND = 20;
// Display steps; smaller changes are not published, so a steady signal is not redrawn.
const STEP_DB = 0.5;

export const SILENT_METER = Object.freeze({
  peak: METER_FLOOR_DB,
  rms: METER_FLOOR_DB,
  clip: false,
  reduction: 0,
});

const decibels = (value) =>
  Number.isFinite(value) ? Math.min(0, Math.max(METER_FLOOR_DB, value)) : METER_FLOOR_DB;
const step = (db) => Math.round(db / STEP_DB) * STEP_DB;
const sameView = (a, b) =>
  a.peak === b.peak && a.rms === b.rms && a.clip === b.clip && a.reduction === b.reduction;

/** 0 at the meter floor, 1 at 0 dBFS. */
export const meterFraction = (db) => (decibels(db) - METER_FLOOR_DB) / -METER_FLOOR_DB;

/** Channel keys for engine.getChannelMeters(): deck:A, track:<id>, return:a, master. */
export function meterReadings(meters) {
  const groups = [
    ['deck', meters?.decks],
    ['track', meters?.tracks],
    ['return', meters?.returns],
  ];
  const readings = groups.flatMap(([kind, group]) =>
    Object.entries(group || {}).map(([id, reading]) => [`${kind}:${id}`, reading])
  );
  return meters?.master ? [...readings, ['master', meters.master]] : readings;
}

/**
 * Channel meter displays with ballistics: the peak jumps up at once, holds for
 * PEAK_HOLD_MS, then falls at PEAK_FALL_DB_PER_SECOND; RMS is shown as read;
 * a clip stays latched until clearClip. Each channel's view object changes
 * only when its display does, so one subscribed meter re-renders per change.
 */
export function createMeterStore() {
  const channels = new Map();
  const listeners = new Set();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getChannel: (key) => channels.get(key)?.view ?? SILENT_METER,
    publish(meters, time) {
      let changed = false;
      const readings = meterReadings(meters);
      // A channel that stopped reporting (a track bus after playback) falls silent.
      const reported = new Set(readings.map(([key]) => key));
      for (const key of channels.keys()) if (!reported.has(key)) readings.push([key, null]);
      for (const [key, reading] of readings) {
        const channel = channels.get(key) ?? {
          heldPeak: METER_FLOOR_DB,
          heldAt: -Infinity,
          clip: false,
          view: SILENT_METER,
        };
        const input = decibels(reading?.peakDb);
        const held = Math.max(0, time - channel.heldAt - PEAK_HOLD_MS);
        let peak = channel.heldPeak - (PEAK_FALL_DB_PER_SECOND * held) / 1000;
        if (input >= peak) {
          peak = input;
          channel.heldPeak = input;
          channel.heldAt = time;
        }
        channel.clip ||= reading?.clip === true || reading?.peakDb >= 0;
        const view = {
          peak: step(Math.max(METER_FLOOR_DB, peak)),
          rms: step(decibels(reading?.rmsDb)),
          clip: channel.clip,
          reduction: Math.round(Math.abs(Number(reading?.reductionDb) || 0) * 10) / 10,
        };
        if (!sameView(view, channel.view)) {
          channel.view = view;
          changed = true;
        }
        channels.set(key, channel);
      }
      if (changed) emit();
    },
    clearClip(key) {
      const channel = channels.get(key);
      if (!channel?.clip) return;
      channel.clip = false;
      channel.view = { ...channel.view, clip: false };
      emit();
    },
  };
}

const MeterContext = createContext(null);
const idleMeters = createMeterStore();

export function MeterProvider({ store, children }) {
  return createElement(MeterContext.Provider, { value: store }, children);
}

export function useMeterStore() {
  return useContext(MeterContext) || idleMeters;
}

const silent = () => SILENT_METER;

/** One channel's display; only the component calling this re-renders on meter frames. */
export function useChannelMeter(key) {
  const store = useMeterStore();
  return useSyncExternalStore(store.subscribe, () => store.getChannel(key), silent);
}
