// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blobData, blobState, readBlob, resetBlobs } from './helpers/blobsFake.js';

const sendMock = vi.fn();

vi.mock('@netlify/blobs', async () => (await import('./helpers/blobsFake.js')).blobsModule);

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return {
      emails: {
        send: sendMock,
      },
    };
  }),
}));

const { default: handler, config } = await import('../../netlify/functions/service-inquiry.js');
const { INQUIRY_EMAIL_LIMITS } = await import('../../server/inquiryStore.js');

function post(body, init = {}) {
  return handler(
    new Request('https://sattarimusic.com/api/service-inquiry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
      ...init,
    }),
    { ip: '203.0.113.7' }
  );
}

const valid = {
  service: 'repairs',
  name: 'Alex',
  email: 'alex@example.com',
  details: 'Need a repair.',
};

function storedInquiries() {
  return [...blobData('service-inquiries').keys()]
    .filter((key) => key.startsWith('inquiries/'))
    .map((key) => readBlob('service-inquiries', key));
}

describe('service-inquiry Netlify function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBlobs();
    process.env.RESEND_API_KEY = 'test_resend_key';
    process.env.SERVICE_INQUIRY_FROM = 'Sattari Music <services@example.com>';
    process.env.SERVICE_INQUIRY_TO = 'owner@example.com';
    delete process.env.ORDER_NOTIFICATION_FROM;
    delete process.env.ORDER_NOTIFICATION_EMAIL;
    sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('rejects non-POST requests', async () => {
    const response = await handler(new Request('https://sattarimusic.com/api/service-inquiry'), {});

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'Method not allowed.' });
  });

  it('declares an edge rate limit on both public URLs', () => {
    expect(config.path).toEqual(['/api/service-inquiry', '/.netlify/functions/service-inquiry']);
    expect(config.rateLimit).toMatchObject({ aggregateBy: ['ip', 'domain'] });
  });

  it('validates required fields before sending email', async () => {
    const response = await post({
      service: 'repairs',
      name: 'Alex',
      email: 'alex@example.com',
      details: '',
    });

    expect(response.status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('validates email shape before sending email', async () => {
    const response = await post({
      service: 'repairs',
      name: 'Alex',
      email: 'not-an-email',
      details: 'Snare repair timing.',
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/valid email/i);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects malformed and oversized bodies', async () => {
    expect((await post('{')).status).toBe(400);
    expect((await post('[]')).status).toBe(400);
    expect((await post({ ...valid, details: 'x'.repeat(25000) })).status).toBe(413);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends a sanitized service inquiry email to the configured service recipient', async () => {
    const response = await post({
      service: 'repairs',
      name: ' Alex Customer ',
      email: 'alex@example.com',
      phone: '555-0100',
      details: 'Need a drum repair this week.',
      source: 'Repair landing page',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({ ok: true, id: 'email_123', emailSent: true, stored: true })
    );
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Sattari Music <services@example.com>',
        to: 'owner@example.com',
        replyTo: 'alex@example.com',
        subject: 'New Sattari service inquiry: Repairs',
        text: expect.stringContaining('Name: Alex Customer'),
      })
    );
    expect(storedInquiries()).toEqual([
      expect.objectContaining({ name: 'Alex Customer', emailSent: true, emailId: 'email_123' }),
    ]);
  });

  it('labels Audio Suite alpha signups so they are identifiable in the inbox', async () => {
    const response = await post({
      service: 'audio-alpha',
      name: 'Sam Tester',
      email: 'sam@example.com',
      details: 'DAW / host: Logic Pro\n\nMixing and vocals, M2 MacBook Pro.',
      source: 'Audio Suite alpha signup',
      'bot-field': '',
    });

    expect(response.status).toBe(200);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: 'sam@example.com',
        subject: 'New Sattari service inquiry: Audio Suite alpha access',
        text: expect.stringContaining('Logic Pro'),
      })
    );
  });

  it('falls back to order notification env vars when service-specific env vars are absent', async () => {
    delete process.env.SERVICE_INQUIRY_FROM;
    delete process.env.SERVICE_INQUIRY_TO;
    process.env.ORDER_NOTIFICATION_FROM = 'orders@example.com';
    process.env.ORDER_NOTIFICATION_EMAIL = 'fallback@example.com';

    const response = await post({
      service: 'lessons',
      name: 'Alex',
      email: 'alex@example.com',
      details: 'Looking for lessons.',
    });

    expect(response.status).toBe(200);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'orders@example.com',
        to: 'fallback@example.com',
      })
    );
  });

  it('stores the inquiry without calling Resend when email env is incomplete', async () => {
    delete process.env.RESEND_API_KEY;

    const response = await post(valid);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({ ok: true, emailSent: false, stored: true })
    );
    expect(sendMock).not.toHaveBeenCalled();
    const [key] = [...blobData('service-inquiries').keys()];
    expect(key).toMatch(/^inquiries\/inq_\d{13}_[a-f0-9]{8}\.json$/);
    expect(storedInquiries()).toEqual([
      expect.objectContaining({
        name: 'Alex',
        email: 'alex@example.com',
        emailSent: false,
        emailError: 'not-configured',
      }),
    ]);
  });
});

describe('when the email does not go out', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBlobs();
    process.env.RESEND_API_KEY = 'test_resend_key';
    process.env.SERVICE_INQUIRY_FROM = 'services@example.com';
    process.env.SERVICE_INQUIRY_TO = 'owner@example.com';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('records an API error from Resend as not sent, and still accepts the stored inquiry', async () => {
    // Resend reports failures in `error` instead of throwing.
    sendMock.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'Domain not verified' },
    });

    const response = await post(valid);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, emailSent: false, stored: true });
    expect(storedInquiries()).toEqual([
      expect.objectContaining({ emailSent: false, emailError: 'provider' }),
    ]);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('service-inquiry-email-failed')
    );
  });

  it('treats a response without an email id as not sent', async () => {
    sendMock.mockResolvedValue({ data: {}, error: null });
    const body = await (await post(valid)).json();
    expect(body.emailSent).toBe(false);
    expect(storedInquiries()[0].emailSent).toBe(false);
  });

  it('treats a thrown send as not sent', async () => {
    sendMock.mockRejectedValue(new Error('socket hang up'));
    const response = await post(valid);
    expect(response.status).toBe(200);
    expect((await response.json()).emailSent).toBe(false);
  });

  it('returns 500 when the email failed and the inquiry could not be stored', async () => {
    sendMock.mockResolvedValue({ data: null, error: { name: 'application_error' } });
    blobState.failWrites = true;

    const response = await post(valid);

    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatch(/try again/i);
  });

  it('still accepts an emailed inquiry that could not be stored, and says so', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_9' }, error: null });
    blobState.failWritesFor = (store, key) => key.startsWith('inquiries/');

    const response = await post(valid);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, emailSent: true, stored: false });
  });
});

describe('abuse resistance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBlobs();
    process.env.RESEND_API_KEY = 'test_resend_key';
    process.env.SERVICE_INQUIRY_FROM = 'services@example.com';
    process.env.SERVICE_INQUIRY_TO = 'owner@example.com';
    sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it.each(['bot-field', 'website'])(
    'silently drops a submission that fills the %s honeypot',
    async (field) => {
      const response = await post({ ...valid, [field]: 'https://spam.example' });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, emailSent: true, stored: true });
      expect(sendMock).not.toHaveBeenCalled();
      expect(blobData('service-inquiries').size).toBe(0);
    }
  );

  it('stops emailing past the hourly allowance but keeps the inquiries for staff', async () => {
    for (let i = 0; i < INQUIRY_EMAIL_LIMITS.perHour + 3; i += 1) {
      expect((await post(valid)).status).toBe(200);
    }

    expect(sendMock).toHaveBeenCalledTimes(INQUIRY_EMAIL_LIMITS.perHour);
    const stored = storedInquiries();
    expect(stored).toHaveLength(INQUIRY_EMAIL_LIMITS.perHour + 3);
    expect(stored.filter((item) => item.emailError === 'limit')).toHaveLength(3);
  });

  it('does not email when the allowance cannot be claimed, but keeps the inquiry', async () => {
    blobState.conflictWrites = true;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await post(valid);

    expect(sendMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ emailSent: false, stored: true });
    expect(storedInquiries()).toEqual([expect.objectContaining({ emailError: 'limit' })]);
    spy.mockRestore();
  });
});
