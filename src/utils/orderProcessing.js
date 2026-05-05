function toDisplayValue(value) {
  return value ?? null;
}

export function formatOrderCurrency(amountTotal, currency = 'usd') {
  if (typeof amountTotal !== 'number') {
    return null;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'usd').toUpperCase(),
  }).format(amountTotal / 100);
}

export function getOrderStoreKey(sessionId) {
  return `orders/${sessionId}.json`;
}

export function createOrderRecord(session, lineItems = [], options = {}) {
  const customerDetails = session.customer_details || {};
  const shippingDetails = session.shipping_details || {};

  return {
    id: session.id,
    source: options.source || 'stripe-webhook',
    recordedAt: options.recordedAt || new Date().toISOString(),
    livemode: Boolean(session.livemode),
    status: toDisplayValue(session.status),
    paymentStatus: toDisplayValue(session.payment_status),
    customerEmail: toDisplayValue(customerDetails.email || session.customer_email),
    customerName: toDisplayValue(customerDetails.name),
    customerPhone: toDisplayValue(customerDetails.phone),
    amountTotal: typeof session.amount_total === 'number' ? session.amount_total : null,
    currency: toDisplayValue(session.currency),
    submittedAt:
      typeof session.created === 'number' ? new Date(session.created * 1000).toISOString() : null,
    checkoutUrl: toDisplayValue(session.url),
    shipping: shippingDetails.address
      ? {
          name: toDisplayValue(shippingDetails.name),
          address: {
            city: toDisplayValue(shippingDetails.address.city),
            country: toDisplayValue(shippingDetails.address.country),
            line1: toDisplayValue(shippingDetails.address.line1),
            line2: toDisplayValue(shippingDetails.address.line2),
            postalCode: toDisplayValue(shippingDetails.address.postal_code),
            state: toDisplayValue(shippingDetails.address.state),
          },
        }
      : null,
    items: lineItems.map((item) => ({
      description: item.description || item.price?.product?.name || 'Order item',
      quantity: item.quantity || 1,
      amountTotal: typeof item.amount_total === 'number' ? item.amount_total : null,
      currency: item.currency || session.currency || null,
    })),
  };
}

export function buildOrderNotificationText(orderRecord) {
  const lines = [
    'New Sattari Music order received.',
    '',
    `Order ID: ${orderRecord.id}`,
    `Payment status: ${orderRecord.paymentStatus || 'unknown'}`,
    `Checkout status: ${orderRecord.status || 'unknown'}`,
    `Total: ${formatOrderCurrency(orderRecord.amountTotal, orderRecord.currency) || 'Unavailable'}`,
    `Customer: ${orderRecord.customerName || 'Unknown customer'}`,
    `Email: ${orderRecord.customerEmail || 'No email supplied'}`,
    '',
    'Items:',
  ];

  if (!orderRecord.items.length) {
    lines.push('- No line items returned by Stripe');
  } else {
    for (const item of orderRecord.items) {
      const total = formatOrderCurrency(item.amountTotal, item.currency);
      lines.push(`- ${item.description} × ${item.quantity}${total ? ` — ${total}` : ''}`);
    }
  }

  if (orderRecord.shipping?.address) {
    const address = orderRecord.shipping.address;
    lines.push('', 'Shipping:');
    lines.push(orderRecord.shipping.name || 'No recipient name');
    lines.push(address.line1 || '');
    if (address.line2) lines.push(address.line2);
    lines.push(
      [address.city, address.state, address.postalCode].filter(Boolean).join(', ') ||
        'Address unavailable'
    );
    if (address.country) lines.push(address.country);
  }

  return lines.filter(Boolean).join('\n');
}

export function summarizeOrderRecord(orderRecord) {
  return {
    id: orderRecord.id,
    recordedAt: orderRecord.recordedAt,
    submittedAt: orderRecord.submittedAt,
    paymentStatus: orderRecord.paymentStatus,
    status: orderRecord.status,
    customerEmail: orderRecord.customerEmail,
    customerName: orderRecord.customerName,
    amountTotal: orderRecord.amountTotal,
    currency: orderRecord.currency,
    itemCount: Array.isArray(orderRecord.items)
      ? orderRecord.items.reduce((total, item) => total + (Number(item.quantity) || 0), 0)
      : 0,
  };
}
