import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}));

const { parseRecipients, sendOrderNotification } = await import(
  '../../server/orderNotifications.js'
);

const orderRecord = {
  id: 'cs_test_1',
  paymentStatus: 'paid',
  status: 'complete',
  amountTotal: 12500,
  currency: 'usd',
  customerName: 'A Customer',
  customerEmail: 'buyer@example.com',
  items: [{ description: 'Pirouz Series Cymbals', quantity: 1, amountTotal: 12500 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });
  process.env.RESEND_API_KEY = 're_test';
  process.env.ORDER_NOTIFICATION_FROM = 'orders@sattarimusic.com';
  process.env.ORDER_NOTIFICATION_EMAIL = 'armonnasiri@gmail.com,info@sattarimusic.com';
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.ORDER_NOTIFICATION_FROM;
  delete process.env.ORDER_NOTIFICATION_EMAIL;
});

describe('parseRecipients', () => {
  it('splits a comma-separated list', () => {
    expect(parseRecipients('a@b.com,c@d.com')).toEqual(['a@b.com', 'c@d.com']);
  });

  it('trims whitespace and tolerates semicolons', () => {
    expect(parseRecipients(' a@b.com ; c@d.com ')).toEqual(['a@b.com', 'c@d.com']);
  });

  it('drops duplicates case-insensitively', () => {
    expect(parseRecipients('a@b.com,A@B.com')).toEqual(['a@b.com']);
  });

  it('drops entries that are obviously not addresses', () => {
    expect(parseRecipients('a@b.com,,not-an-email,   ')).toEqual(['a@b.com']);
  });

  it('returns an empty list for junk input', () => {
    expect(parseRecipients('')).toEqual([]);
    expect(parseRecipients(undefined)).toEqual([]);
  });
});

describe('sendOrderNotification', () => {
  it('sends to every configured recipient', async () => {
    const result = await sendOrderNotification(orderRecord);

    expect(result.skipped).toBe(false);
    expect(result.recipients).toBe(2);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['armonnasiri@gmail.com', 'info@sattarimusic.com'],
        from: 'orders@sattarimusic.com',
      })
    );
  });

  it('includes the total and the items in the message', async () => {
    await sendOrderNotification(orderRecord);
    const payload = sendMock.mock.calls[0][0];

    expect(payload.subject).toContain('$125.00');
    expect(payload.text).toContain('Pirouz Series Cymbals');
    expect(payload.text).toContain('buyer@example.com');
  });

  it('skips cleanly when nothing is configured', async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendOrderNotification(orderRecord);

    expect(result.skipped).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('skips when the recipient list is present but empty', async () => {
    process.env.ORDER_NOTIFICATION_EMAIL = '  ,  ';
    const result = await sendOrderNotification(orderRecord);

    expect(result.skipped).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('throws when Resend reports an error in the body', async () => {
    // Resend returns failures in the payload rather than throwing, so a caller
    // that only catches exceptions would log a silent success.
    sendMock.mockResolvedValue({ data: null, error: { message: 'Domain not verified' } });

    await expect(sendOrderNotification(orderRecord)).rejects.toThrow('Domain not verified');
  });
});
