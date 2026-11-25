/**
 * Server-side Meta WhatsApp Business Cloud API helper.
 * NEVER import this file in frontend JavaScript.
 *
 * Required Environment Variables:
 *   WHATSAPP_CLOUD_TOKEN      - Meta System User permanent access token
 *   WHATSAPP_PHONE_NUMBER_ID  - Meta WhatsApp Business Phone Number ID
 * Optional Environment Variables:
 *   WHATSAPP_TEMPLATE_NAME    - Approved template name (recommended for production)
 *   WHATSAPP_TEMPLATE_LANG    - Template language code (default: 'en')
 *   WHATSAPP_GRAPH_VERSION    - Graph API version (default: 'v21.0')
 */

'use strict';

function formatIndianWhatsAppNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

function buildOrderSummaryFields(order, items) {
  const customerName = order.customer_name || 'Customer';
  const orderNumber = order.order_number || String(order.id).slice(-8).toUpperCase();
  const itemSummary = (Array.isArray(items) && items.length > 0)
    ? items.map(i => `${i.product_name || i.name || 'Product'} x${i.quantity || 1}`).join(', ')
    : 'RC Order Items';
  const totalFormatted = `₹${Number(order.total || 0).toLocaleString('en-IN')}`;
  const addressParts = [
    order.address_line1,
    order.address_line2,
    order.city,
    order.state,
    order.pincode && order.pincode !== '000000' ? order.pincode : ''
  ].filter(Boolean);
  const deliveryAddress = addressParts.join(', ') || 'Provided at checkout';

  return { customerName, orderNumber, itemSummary, totalFormatted, deliveryAddress };
}

async function sendOrderConfirmationWhatsApp({ order, items }) {
  const token = process.env.WHATSAPP_CLOUD_TOKEN || '';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  if (!token || !phoneNumberId) {
    return { status: 'skipped_not_configured' };
  }

  const to = formatIndianWhatsAppNumber(order.customer_phone);
  if (!to || to.length < 10) {
    return { status: 'skipped_invalid_phone' };
  }

  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';
  const templateName = (process.env.WHATSAPP_TEMPLATE_NAME || '').trim();
  const templateLang = (process.env.WHATSAPP_TEMPLATE_LANG || 'en').trim();
  if (!templateName) {
    return { status: 'skipped_no_template' };
  }

  const {
    customerName,
    orderNumber,
    itemSummary,
    totalFormatted,
    deliveryAddress
  } = buildOrderSummaryFields(order, items);

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: customerName },
            { type: 'text', text: orderNumber },
            { type: 'text', text: itemSummary },
            { type: 'text', text: totalFormatted },
            { type: 'text', text: deliveryAddress }
          ]
        }
      ]
    }
  };

  const res = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = (data && data.error && data.error.message) || `Meta WhatsApp API error (${res.status})`;
    return { status: 'retry_needed', error: errMsg };
  }

  const messageId = Array.isArray(data.messages) && data.messages[0] ? data.messages[0].id : null;
  return { status: 'sent', messageId };
}

module.exports = {
  formatIndianWhatsAppNumber,
  buildOrderSummaryFields,
  sendOrderConfirmationWhatsApp
};
