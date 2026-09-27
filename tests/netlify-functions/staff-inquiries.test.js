// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blobState, readBlob, resetBlobs, seedBlob } from './helpers/blobsFake.js';

vi.mock('@netlify/blobs', async () => (await import('./helpers/blobsFake.js')).blobsModule);

const { handler } = await import('../../netlify/functions/staff-inquiries.js');
const { createSession } = await import('../../server/staffAuth.js');

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
    expect(response.headers['Cache-Control']).toBe('no-store');
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
