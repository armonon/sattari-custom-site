// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callWith } from './helpers/invoke.js';
import { blobData, blobState, readBlob, resetBlobs, seedBlob } from './helpers/blobsFake.js';

vi.mock('@netlify/blobs', async () => (await import('./helpers/blobsFake.js')).blobsModule);

const handler = callWith((await import('../../netlify/functions/staff-inquiries.js')).default);
const { createSession } = await import('../../server/staffAuth.js');
const { INQUIRY_STORAGE_LIMITS, pruneInquiries, saveInquiry } =
  await import('../../server/inquiryStore.js');

const OLDER = 'inq_1790000000000_aaaaaaaa';
const NEWER = 'inq_1790000500000_bbbbbbbb';

function call(method, { body, token = createSession('Armon'), query } = {}) {
  return handler({
    httpMethod: method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body ? JSON.stringify(body) : '',
    queryStringParameters: query || {},
  });
}

beforeEach(() => {
  resetBlobs();
  process.env.STAFF_SESSION_SECRET = 'secret';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  seedBlob('service-inquiries', `inquiries/${OLDER}.json`, {
    id: OLDER,
    name: 'Emailed Customer',
    email: 'a@example.com',
    details: 'Snare repair',
    emailSent: true,
    recordedAt: '2026-09-21T12:00:00.000Z',
  });
  seedBlob('service-inquiries', `inquiries/${NEWER}.json`, {
    id: NEWER,
    name: '<img src=x onerror=alert(1)>',
    email: 'b@example.com',
    details: 'Lessons',
    emailSent: false,
    emailError: 'provider',
    recordedAt: '2026-09-21T12:08:20.000Z',
  });
  seedBlob('service-inquiries', 'budget/email', { hour: 1, hourCount: 1, day: 1, dayCount: 1 });
});

describe('staff-inquiries', () => {
  it('requires a staff session', async () => {
    expect((await call('GET', { token: null })).statusCode).toBe(401);
    expect(
      (await call('POST', { token: null, body: { id: NEWER, action: 'handled' } })).statusCode
    ).toBe(401);
    expect(readBlob('service-inquiries', `inquiries/${NEWER}.json`).handledAt).toBeUndefined();
  });

  it('lists inquiries newest first, including ones whose email failed', async () => {
    const response = await call('GET');
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(body.total).toBe(2);
    expect(body.inquiries.map((item) => item.id)).toEqual([NEWER, OLDER]);
    expect(body.inquiries[0]).toMatchObject({ emailSent: false, emailError: 'provider' });
  });

  it('respects the page size', async () => {
    const body = JSON.parse((await call('GET', { query: { limit: '1' } })).body);
    expect(body.inquiries.map((item) => item.id)).toEqual([NEWER]);
    expect(body.total).toBe(2);
  });

  it('marks an inquiry handled and reopens it', async () => {
    const handled = await call('POST', { body: { id: NEWER, action: 'handled' } });
    expect(handled.statusCode).toBe(200);
    expect(readBlob('service-inquiries', `inquiries/${NEWER}.json`)).toMatchObject({
      handledBy: 'Armon',
      handledAt: expect.any(String),
      emailSent: false,
    });

    await call('POST', { body: { id: NEWER, action: 'reopen' } });
    expect(readBlob('service-inquiries', `inquiries/${NEWER}.json`).handledAt).toBeUndefined();
  });

  it('rejects unknown actions and malformed or missing ids', async () => {
    expect((await call('POST', { body: { id: NEWER, action: 'delete' } })).statusCode).toBe(400);
    expect(
      (await call('POST', { body: { id: '../budget/email', action: 'handled' } })).statusCode
    ).toBe(400);
    expect(
      (await call('POST', { body: { id: 'inq_1790000900000_cccccccc', action: 'handled' } }))
        .statusCode
    ).toBe(404);
    expect((await call('PUT')).statusCode).toBe(405);
  });

  it('reports storage trouble without echoing internal errors', async () => {
    blobState.failReads = true;
    const response = await call('GET');
    expect(response.statusCode).toBe(401);

    blobState.failReads = false;
    const token = createSession('Armon');
    blobState.failWritesFor = (store, key) => key.startsWith('inquiries/');
    const write = await call('POST', { token, body: { id: NEWER, action: 'handled' } });
    expect(write.statusCode).toBe(503);
    expect(write.body).not.toContain('Storage unavailable');
  });
});

describe('paging and the needs-a-reply list', () => {
  const DAY = 86400000;
  const idAt = (ms, n = 0) => `inq_${ms}_${String(n).padStart(8, '0')}`;

  function seedMany(count, { start = 1790001000000, emailSent = true } = {}) {
    return Array.from({ length: count }, (_, n) => {
      const id = idAt(start + n * 1000, n);
      seedBlob('service-inquiries', `inquiries/${id}.json`, {
        id,
        name: `Customer ${n}`,
        emailSent,
      });
      return id;
    });
  }

  it('pages newest first with a cursor, past the first page', async () => {
    const ids = seedMany(5);
    const first = JSON.parse((await call('GET', { query: { limit: '3' } })).body);

    expect(first.inquiries.map((item) => item.id)).toEqual(ids.slice(2).reverse());
    expect(first.total).toBe(7);
    expect(first.nextBefore).toBe(ids[2]);

    const second = JSON.parse(
      (await call('GET', { query: { limit: '3', before: first.nextBefore } })).body
    );
    expect(second.inquiries.map((item) => item.id)).toEqual([ids[1], ids[0], NEWER]);
    const third = JSON.parse(
      (await call('GET', { query: { limit: '3', before: second.nextBefore } })).body
    );
    expect(third.inquiries.map((item) => item.id)).toEqual([OLDER]);
    expect(third.nextBefore).toBeNull();
  });

  it('lists only inquiries never emailed and not handled, however many others arrived', async () => {
    seedMany(120);

    // Stored before the markers existed: older inquiries are checked a batch
    // per page load, so the first load says it is still looking...
    const first = JSON.parse((await call('GET', { query: { filter: 'unsent' } })).body);
    expect(first).toMatchObject({ inquiries: [], indexing: true });
    expect(readBlob('service-inquiries', 'index/unsent-v1')).toMatchObject({
      before: expect.stringMatching(/^inq_/),
    });

    // ...and the next carries on where it stopped rather than starting over.
    const body = JSON.parse((await call('GET', { query: { filter: 'unsent' } })).body);
    expect(body.inquiries.map((item) => item.id)).toEqual([NEWER]);
    expect(body.unsentTotal).toBe(1);
    expect(body.indexing).toBe(false);

    await call('POST', { body: { id: NEWER, action: 'handled' } });
    expect(JSON.parse((await call('GET', { query: { filter: 'unsent' } })).body).inquiries).toEqual(
      []
    );

    await call('POST', { body: { id: NEWER, action: 'reopen' } });
    const reopened = JSON.parse((await call('GET', { query: { filter: 'unsent' } })).body);
    expect(reopened.inquiries.map((item) => item.id)).toEqual([NEWER]);
  });

  it('marks new unsent inquiries as they are stored', async () => {
    await call('GET');
    const id = idAt(1790009000000);
    await saveInquiry({}, { id, name: 'New', emailSent: false });
    await saveInquiry({}, { id: idAt(1790009001000), name: 'Emailed', emailSent: true });

    const body = JSON.parse((await call('GET', { query: { filter: 'unsent' } })).body);
    expect(body.inquiries.map((item) => item.id)).toEqual([id, NEWER]);
  });

  it('keeps a year, and no more than the ceiling', async () => {
    const now = 1790000000000 + 400 * DAY;
    const ids = seedMany(3, { start: now - 10 * DAY, emailSent: false });
    seedBlob('service-inquiries', `unsent/${OLDER}`, { id: OLDER });

    // OLDER and NEWER are more than a year old by now.
    expect(await pruneInquiries({}, { now })).toBe(2);
    expect(readBlob('service-inquiries', `inquiries/${OLDER}.json`)).toBeNull();
    expect(readBlob('service-inquiries', `unsent/${OLDER}`)).toBeNull();
    expect(readBlob('service-inquiries', `inquiries/${ids[0]}.json`)).not.toBeNull();

    const ceiling = INQUIRY_STORAGE_LIMITS.maxStored;
    INQUIRY_STORAGE_LIMITS.maxStored = 2;
    try {
      expect(await pruneInquiries({}, { now })).toBe(1);
    } finally {
      INQUIRY_STORAGE_LIMITS.maxStored = ceiling;
    }
    const left = [...blobData('service-inquiries').keys()].filter((key) =>
      key.startsWith('inquiries/')
    );
    expect(left).toEqual([`inquiries/${ids[1]}.json`, `inquiries/${ids[2]}.json`]);
  });

  it('prunes a bounded number at a time', async () => {
    const now = 1790000000000 + 400 * DAY;
    seedMany(5, { start: 1790000000000 });

    expect(await pruneInquiries({}, { now, maxDeletes: 3 })).toBe(3);
    expect(await pruneInquiries({}, { now, maxDeletes: 3 })).toBe(3);
    expect(await pruneInquiries({}, { now, maxDeletes: 3 })).toBe(1);
  });

  it('never prunes while a customer is sending an inquiry', async () => {
    const old = idAt(1600000000000);
    seedBlob('service-inquiries', `inquiries/${old}.json`, { id: old, emailSent: true });

    await saveInquiry({}, { id: idAt(Date.now()), name: 'New', emailSent: true });

    expect(readBlob('service-inquiries', `inquiries/${old}.json`)).not.toBeNull();
  });
});
