import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: sendMock,
    },
  })),
}));

const { handler } = await import('../../netlify/functions/service-inquiry.js');

function post(body) {
  return handler({
    httpMethod: 'POST',
    body: JSON.stringify(body),
  });
}

describe('service-inquiry Netlify function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test_resend_key';
    process.env.SERVICE_INQUIRY_FROM = 'Sattari Music <services@example.com>';
    process.env.SERVICE_INQUIRY_TO = 'owner@example.com';
    delete process.env.ORDER_NOTIFICATION_FROM;
    delete process.env.ORDER_NOTIFICATION_EMAIL;
    sendMock.mockResolvedValue({ data: { id: 'email_123' } });
  });

  it('rejects non-POST requests', async () => {
    const response = await handler({ httpMethod: 'GET', body: '' });

    expect(response.statusCode).toBe(405);
    expect(JSON.parse(response.body)).toEqual({ error: 'Method not allowed.' });
  });

  it('validates required fields before sending email', async () => {
    const response = await post({
      service: 'repairs',
      name: 'Alex',
      email: 'alex@example.com',
      details: '',
    });

    expect(response.statusCode).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('validates email shape before sending email', async () => {
    const response = await post({
      service: 'repairs',
      name: 'Alex',
      email: 'not-an-email',
      details: 'Snare repair timing.',
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/valid email/i);
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

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true, id: 'email_123' });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Sattari Music <services@example.com>',
        to: 'owner@example.com',
        replyTo: 'alex@example.com',
        subject: 'New Sattari service inquiry: Repairs',
        text: expect.stringContaining('Name: Alex Customer'),
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

    expect(response.statusCode).toBe(200);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'orders@example.com',
        to: 'fallback@example.com',
      })
    );
  });

  it('returns a configuration error without calling Resend when email env is incomplete', async () => {
    delete process.env.RESEND_API_KEY;

    const response = await post({
      service: 'repairs',
      name: 'Alex',
      email: 'alex@example.com',
      details: 'Need a repair.',
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error).toMatch(/not configured/i);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
