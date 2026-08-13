import { describe, expect, it } from 'vitest';
import {
  applyFulfillmentUpdate,
  countOpen,
  fulfillmentFor,
  isValidStatus,
  sanitizeFulfillmentDoc,
  sanitizeFulfillmentRecord,
} from './fulfillment.js';

const NOW = new Date('2026-08-13T12:00:00Z').getTime();

describe('isValidStatus', () => {
  it('accepts only known statuses', () => {
    expect(isValidStatus('packed')).toBe(true);
    expect(isValidStatus('shipped')).toBe(true);
    expect(isValidStatus('delivered')).toBe(false);
    expect(isValidStatus('')).toBe(false);
    expect(isValidStatus(undefined)).toBe(false);
  });
});

describe('applyFulfillmentUpdate', () => {
  it('rejects an unknown status rather than storing it', () => {
    const result = applyFulfillmentUpdate(null, { status: 'teleported' }, 'Armon', NOW);
    expect(result.ok).toBe(false);
  });

  it('records who changed it and when', () => {
    const { record } = applyFulfillmentUpdate(null, { status: 'packed' }, 'Armon', NOW);

    expect(record.status).toBe('packed');
    expect(record.staff).toBe('Armon');
    expect(record.updatedAt).toBe('2026-08-13T12:00:00.000Z');
    expect(record.history[0]).toMatchObject({ status: 'packed', staff: 'Armon' });
  });

  it('keeps history newest-first across several changes', () => {
    const first = applyFulfillmentUpdate(null, { status: 'packed' }, 'Armon', NOW).record;
    const second = applyFulfillmentUpdate(first, { status: 'shipped' }, 'Sam', NOW + 1000).record;

    expect(second.history).toHaveLength(2);
    expect(second.history[0].status).toBe('shipped');
    expect(second.history[1].status).toBe('packed');
  });

  it('carries tracking forward when a later change omits it', () => {
    // An order marked shipped and then corrected must not silently lose its
    // tracking number.
    const shipped = applyFulfillmentUpdate(
      null,
      { status: 'shipped', tracking: '1Z999', carrier: 'UPS' },
      'Armon',
      NOW
    ).record;
    const corrected = applyFulfillmentUpdate(shipped, { status: 'packed' }, 'Sam', NOW).record;

    expect(corrected.tracking).toBe('1Z999');
    expect(corrected.carrier).toBe('UPS');
  });

  it('allows tracking to be replaced explicitly', () => {
    const shipped = applyFulfillmentUpdate(
      null,
      { status: 'shipped', tracking: 'A' },
      'A',
      NOW
    ).record;
    const fixed = applyFulfillmentUpdate(
      shipped,
      { status: 'shipped', tracking: 'B' },
      'A',
      NOW
    ).record;
    expect(fixed.tracking).toBe('B');
  });

  it('permits out-of-order corrections', () => {
    // Shops hit these constantly: a shipped order comes back, a pickup turns
    // into a delivery. Blocking them teaches staff to work around the tool.
    const shipped = applyFulfillmentUpdate(null, { status: 'shipped' }, 'A', NOW).record;
    const back = applyFulfillmentUpdate(shipped, { status: 'new' }, 'A', NOW);

    expect(back.ok).toBe(true);
    expect(back.record.status).toBe('new');
    expect(back.record.history).toHaveLength(2);
  });

  it('caps history so one order cannot grow without bound', () => {
    let record = null;
    for (let i = 0; i < 40; i += 1) {
      record = applyFulfillmentUpdate(record, { status: 'packed' }, 'A', NOW + i).record;
    }
    expect(record.history.length).toBeLessThanOrEqual(20);
  });
});

describe('sanitize', () => {
  it('falls back to new for an unrecognised stored status', () => {
    expect(sanitizeFulfillmentRecord({ status: 'nonsense' }).status).toBe('new');
  });

  it('drops history entries with invalid statuses', () => {
    const record = sanitizeFulfillmentRecord({
      status: 'packed',
      history: [{ status: 'packed', staff: 'A' }, { status: 'junk' }, null],
    });
    expect(record.history).toHaveLength(1);
  });

  it('rejects non-object documents', () => {
    expect(sanitizeFulfillmentDoc(null)).toEqual({});
    expect(sanitizeFulfillmentDoc([1, 2])).toEqual({});
    expect(sanitizeFulfillmentRecord('x')).toBeNull();
  });
});

describe('fulfillmentFor', () => {
  it('reports new for an order that has never been touched', () => {
    // Orders placed before this feature existed still need a real state.
    expect(fulfillmentFor({}, 'cs_1').status).toBe('new');
    expect(fulfillmentFor(undefined, 'cs_1').status).toBe('new');
  });
});

describe('countOpen', () => {
  it('counts only orders still needing action', () => {
    const doc = {
      a: { status: 'new' },
      b: { status: 'packed' },
      c: { status: 'shipped' },
      d: { status: 'cancelled' },
    };
    const orders = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];

    // 'e' has no record, so it counts as new and therefore open.
    expect(countOpen(doc, orders)).toBe(3);
  });
});
