import { useLayoutEffect, useState } from 'react';
import { validateArrangement } from '../../utils/arrangementModel';
import { useLatestRef } from './useStableCallback';

export const HISTORY_LIMIT = 60;
const NOTHING = Object.freeze({ undo: false, redo: false });

// JSON semantics (undefined members are absent) with a reference fast path, so
// comparing structurally shared projects only walks the edited branches.
export function sameContent(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return Object.is(a, b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a))
    return a.length === b.length && a.every((item, index) => sameContent(item, b[index]));
  const keys = (value) => Object.keys(value).filter((key) => value[key] !== undefined);
  const left = keys(a);
  return left.length === keys(b).length && left.every((key) => sameContent(a[key], b[key]));
}

/**
 * Undo history over immutable projects. Entries are the previous project
 * references, so an edit costs only what its structural-sharing update allocates.
 * Each entry remembers whether it only changed the live mix: replaying such an
 * entry updates mix parameters instead of rescheduling clips.
 *
 * `current` is a ref holding the latest project; `host` receives effects:
 * publish(project), sync(project, mixOnly), onError(error), onStatus({ undo, redo }).
 */
export class ArrangementHistory {
  constructor(current, host) {
    this.current = current;
    this.host = host;
    this.past = [];
    this.future = [];
    this.pending = null;
    this.adopted = null;
  }

  get project() {
    return this.current.current;
  }

  get status() {
    const undo =
      this.past.length > 0 || (!!this.pending && this.pending.before !== this.current.current);
    const redo = this.future.length > 0;
    return undo || redo ? { undo, redo } : NOTHING;
  }

  notify() {
    this.host.onStatus?.(this.status);
  }

  record(project, mix) {
    this.past.push({ project, mix });
    if (this.past.length > HISTORY_LIMIT) this.past.splice(0, this.past.length - HISTORY_LIMIT);
    this.future = [];
  }

  // Replaces the current project. A mix-only change is prepared before it is
  // committed so a failed preparation leaves the audible graph and project intact.
  replace(next, mixOnly, sync = true) {
    try {
      if (sync && mixOnly) this.host.sync(next, true);
    } catch (error) {
      this.host.onError(error);
      return false;
    }
    this.current.current = next;
    if (sync && !mixOnly) this.host.sync(next, false);
    this.host.publish(next);
    return true;
  }

  /**
   * Commits `next` as one undoable edit. With `live`, the change joins the open
   * transaction (opening one that snapshots the current project if needed)
   * instead of adding its own entry.
   */
  commit(next, { mixOnly = false, mix = false, live = false, validate = true, sync = true } = {}) {
    if (!live) this.end();
    const before = this.current.current;
    if (next === before) return false;
    if (validate)
      try {
        validateArrangement(next);
      } catch (error) {
        this.host.onError(error);
        return false;
      }
    if (!this.replace(next, mixOnly, sync)) return false;
    if (live) {
      this.pending ??= { before, mix: true };
      this.pending.mix &&= mix;
    } else this.record(before, mix);
    this.notify();
    return true;
  }

  /** Opens a transaction: later live commits become one entry. */
  begin() {
    this.pending ??= { before: this.current.current, mix: true };
  }

  /** Closes the open transaction with one entry, or none if nothing changed. */
  end() {
    const pending = this.pending;
    this.pending = null;
    if (!pending) return false;
    const changed = !sameContent(pending.before, this.current.current);
    if (changed) this.record(pending.before, pending.mix);
    this.notify();
    return changed;
  }

  /** Abandons the open transaction and restores its exact starting project. */
  cancel() {
    const pending = this.pending;
    this.pending = null;
    if (!pending) return false;
    if (pending.before !== this.current.current && !this.replace(pending.before, pending.mix))
      this.record(pending.before, pending.mix);
    this.notify();
    return true;
  }

  undo(redo = false) {
    this.end();
    const source = redo ? this.future : this.past,
      destination = redo ? this.past : this.future;
    const entry = source.pop();
    if (!entry) return false;
    const previous = this.current.current;
    if (!this.replace(entry.project, entry.mix)) {
      source.push(entry);
      return false;
    }
    destination.push({ project: previous, mix: entry.mix });
    this.notify();
    return true;
  }

  /** Forgets every entry and any open transaction without touching the project. */
  reset() {
    this.past = [];
    this.future = [];
    this.pending = null;
    this.notify();
  }

  /**
   * Accepts a project that was replaced outside the editor. Old snapshots
   * could erase whatever arrived with it, so the history starts over.
   */
  adopt(project) {
    if (project === this.current.current) return false;
    this.current.current = project;
    this.adopted = project;
    this.reset();
    return true;
  }

  /** True once for the project most recently adopted by `adopt`. */
  takeAdoption(project) {
    const adopted = this.adopted === project;
    this.adopted = null;
    return adopted;
  }
}

/**
 * Owns the editor's history over the project held in `current`. A project prop
 * that the editor did not produce is adopted in a layout effect (never during
 * render), before any event can edit on top of a stale project.
 */
export function useArrangementHistory(project, current, { onChange, sync, onError }) {
  const host = useLatestRef({ onChange, sync, onError });
  const [status, setStatus] = useState(NOTHING);
  const [history] = useState(
    () =>
      new ArrangementHistory(current, {
        publish: (next) => host.current.onChange(next),
        sync: (next, mixOnly) => host.current.sync(next, mixOnly),
        onError: (error) => host.current.onError(error),
        onStatus: (next) =>
          setStatus((previous) =>
            previous.undo === next.undo && previous.redo === next.redo ? previous : next
          ),
      })
  );
  useLayoutEffect(() => {
    history.adopt(project);
  }, [history, project]);
  return [history, status];
}
