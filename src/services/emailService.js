import nodemailer from 'nodemailer';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';

// Safe HTML character escaping to prevent HTML injection in emails
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Currency formatter for Indian Rupees
function formatPrice(amt) {
  const num = Number(amt) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Basic RFC 5322 compliant email regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resolves the storefront URL for customer links.
 * Extracts the first URL if comma-separated origins are configured.
 * Preserves localhost fallback for local development.
 */
export function getClientUrl() {
  const raw = (process.env.CLIENT_URL || '').trim();
  if (raw) {
    const first = raw.split(',')[0].trim().replace(/\/+$/, '');
    if (first) return first;
  }
  return 'http://localhost:5173';
}

/**
 * Resolves the admin panel URL for warehouse/admin notifications.
 * Extracts the first URL if comma-separated origins are configured.
 * Preserves localhost fallback for local development.
 */
export function getAdminClientUrl() {
  const raw = (process.env.ADMIN_CLIENT_URL || '').trim();
  if (raw) {
    const first = raw.split(',')[0].trim().replace(/\/+$/, '');
    if (first) return first;
  }
  return 'http://localhost:5174';
}

/**
 * Validates and retrieves SMTP configuration safely from process.env.
 * Never logs or reveals the password.
 */
function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const fromEmail = (process.env.MAIL_FROM || user || 'support.youngdecade@gmail.com').trim();
  const adminEmail = (process.env.ADMIN_NOTIFICATION_EMAIL || 'dev@youngdecade.com').trim();

  const isConfigured = Boolean(host && user && pass);

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    adminEmail,
    isConfigured,
  };
}

// Singleton transporter instance
let cachedTransporter = null;

/**
 * Creates or retrieves the Nodemailer transporter instance.
 * Allows passing an optional mock transporter for tests.
 */
export function getTransporter(overrideTransporter = null) {
  if (overrideTransporter) {
    return overrideTransporter;
  }

  if (cachedTransporter) {
    return cachedTransporter;
  }

  const config = getSmtpConfig();

  if (!config.isConfigured) {
    console.warn('[EmailService] SMTP credentials are not fully configured. Email notifications are currently disabled.');
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: config.host !== 'smtp.ethereal.email',
    },
  });

  return cachedTransporter;
}

/**
 * Resets cached transporter (useful in tests or when env changes)
 */
export function resetTransporter() {
  cachedTransporter = null;
}

/**
 * Generate Customer Order Confirmation HTML Template
 */
export function generateCustomerEmailHtml(order, customer) {
  const customerName = escapeHtml(customer?.name || order.deliveryAddress?.fullName || 'Valued Customer');
  const orderNumber = escapeHtml(order.orderNumber);
  const paymentMethodLabel = escapeHtml(
    order.paymentMethod
      ? order.paymentMethod === 'razorpay'
        ? 'Razorpay'
        : order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1)
      : 'Razorpay'
  );
  const orderDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const address = order.deliveryAddress || {};
  const formattedAddress = [
    escapeHtml(address.street),
    escapeHtml(address.city),
    escapeHtml(address.state),
    escapeHtml(address.postalCode),
    escapeHtml(address.country || 'India'),
  ].filter(Boolean).join(', ');

  const itemsHtml = (order.items || []).map((item) => {
    const itemName = escapeHtml(item.name);
    const itemQty = Number(item.quantity) || 1;
    const itemPrice = formatPrice(item.price);
    const itemTotal = formatPrice(item.subtotal || item.price * itemQty);

    return `
      <tr style="border-bottom: 1px solid #E5E7EB;">
        <td style="padding: 12px 8px; font-size: 13px; color: #111827; font-weight: 600;">
          ${itemName}
        </td>
        <td style="padding: 12px 8px; font-size: 13px; color: #4B5563; text-align: center;">
          ${itemQty}
        </td>
        <td style="padding: 12px 8px; font-size: 13px; color: #4B5563; text-align: right;">
          ${itemPrice}
        </td>
        <td style="padding: 12px 8px; font-size: 13px; color: #111827; font-weight: 700; text-align: right;">
          ${itemTotal}
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your PLUXPC Order Has Been Confirmed!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1F2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F9FAFB; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #111827; padding: 28px 32px; text-align: left; border-bottom: 3px solid #E31E24;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 24px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.5px;">PLUX<span style="color: #E31E24;">PC</span></span>
                  </td>
                  <td style="text-align: right;">
                    <span style="background-color: #E31E24; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">Order Confirmed</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Greeting -->
          <tr>
            <td style="padding: 32px 32px 20px 32px;">
              <h1 style="font-size: 20px; font-weight: 800; color: #111827; margin: 0 0 8px 0;">Hello ${customerName},</h1>
              <p style="font-size: 14px; line-height: 1.6; color: #4B5563; margin: 0 0 24px 0;">
                Thank you for your purchase! We have received your payment via <strong>${escapeHtml(order.paymentMethod || 'Razorpay').toUpperCase()}</strong> and your order is now confirmed for fulfillment.
              </p>

              <!-- Order Overview Card -->
              <table role="presentation" width="100%" style="background-color: #F9FAFB; border-radius: 12px; border: 1px solid #E5E7EB; padding: 16px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 12px; font-size: 12px; color: #6B7280; width: 40%;">Order Number:</td>
                  <td style="padding: 6px 12px; font-size: 13px; font-weight: 700; color: #111827; font-family: monospace;">${orderNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 12px; font-size: 12px; color: #6B7280;">Order Date:</td>
                  <td style="padding: 6px 12px; font-size: 13px; font-weight: 600; color: #111827;">${orderDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 12px; font-size: 12px; color: #6B7280;">Payment Method:</td>
                  <td style="padding: 6px 12px; font-size: 13px; font-weight: 600; color: #111827;">${paymentMethodLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 12px; font-size: 12px; color: #6B7280;">Payment Status:</td>
                  <td style="padding: 6px 12px; font-size: 13px; font-weight: 700; color: #059669; text-transform: uppercase;">${escapeHtml(order.paymentStatus || 'Paid')}</td>
                </tr>
              </table>

              <!-- Ordered Items Table -->
              <h2 style="font-size: 15px; font-weight: 700; color: #111827; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Ordered Products</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                  <tr style="background-color: #F3F4F6; border-bottom: 2px solid #E5E7EB;">
                    <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #4B5563; font-weight: 700; text-align: left;">Product</th>
                    <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #4B5563; font-weight: 700; text-align: center; width: 50px;">Qty</th>
                    <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #4B5563; font-weight: 700; text-align: right; width: 90px;">Price</th>
                    <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #4B5563; font-weight: 700; text-align: right; width: 90px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <!-- Order Summary Breakdown -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="width: 50%;"></td>
                  <td style="width: 50%;">
                    <table role="presentation" width="100%" style="font-size: 13px;">
                      <tr>
                        <td style="padding: 4px 0; color: #6B7280;">Subtotal:</td>
                        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #111827;">${formatPrice(order.subtotalBeforeDiscount || order.subtotal)}</td>
                      </tr>
                      ${order.discount > 0 ? `
                      <tr>
                        <td style="padding: 4px 0; color: #059669;">Promo Discount (${escapeHtml(order.promoCode || 'SAVINGS')}):</td>
                        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #059669;">-${formatPrice(order.discount)}</td>
                      </tr>
                      ` : ''}
                      ${order.platformFee > 0 ? `
                      <tr>
                        <td style="padding: 4px 0; color: #6B7280;">Platform Fee:</td>
                        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #111827;">${formatPrice(order.platformFee)}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 4px 0; color: #6B7280;">Shipping Charges:</td>
                        <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #059669;">${order.shippingFee === 0 ? 'FREE' : formatPrice(order.shippingFee)}</td>
                      </tr>
                      <tr style="border-top: 2px solid #E5E7EB;">
                        <td style="padding: 10px 0; font-size: 15px; font-weight: 800; color: #111827;">Final Amount:</td>
                        <td style="padding: 10px 0; text-align: right; font-size: 16px; font-weight: 900; color: #E31E24;">${formatPrice(order.total)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Delivery Address Card -->
              <h2 style="font-size: 15px; font-weight: 700; color: #111827; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Delivery Address</h2>
              <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; font-size: 13px; line-height: 1.5; color: #374151; margin-bottom: 24px;">
                <strong>${escapeHtml(address.fullName || customerName)}</strong><br>
                ${formattedAddress}<br>
                ${address.phone ? `Phone: ${escapeHtml(address.phone)}` : ''}
              </div>

              <!-- Tracking CTA Button -->
              <table role="presentation" width="100%" style="text-align: center; margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${getClientUrl()}/orders/${order._id}/track" style="display: inline-block; background-color: #E31E24; color: #FFFFFF; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 32px; border-radius: 10px; box-shadow: 0 2px 4px rgba(227, 30, 36, 0.2);">
                      Track Your Order Live
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F3F4F6; padding: 20px 32px; text-align: center; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; line-height: 1.5;">
              <p style="margin: 0 0 4px 0;">Need help with your order? Contact us at <a href="mailto:support.youngdecade@gmail.com" style="color: #E31E24; text-decoration: none; font-weight: 600;">support.youngdecade@gmail.com</a>.</p>
              <p style="margin: 0;">© ${new Date().getFullYear()} PLUXPC. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate Admin New Order Alert HTML Template
 */
export function generateAdminEmailHtml(order, customer) {
  const customerName = escapeHtml(customer?.name || order.deliveryAddress?.fullName || 'Customer');
  const customerEmail = escapeHtml(
    order.contactEmail && customer?.email && order.contactEmail.toLowerCase() !== customer.email.toLowerCase()
      ? `${order.contactEmail} (Account: ${customer.email})`
      : order.contactEmail || customer?.email || 'N/A'
  );
  const customerPhone = escapeHtml(order.deliveryAddress?.phone || customer?.phone || 'N/A');
  const orderNumber = escapeHtml(order.orderNumber);
  const orderDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const address = order.deliveryAddress || {};
  const formattedAddress = [
    escapeHtml(address.street),
    escapeHtml(address.city),
    escapeHtml(address.state),
    escapeHtml(address.postalCode),
    escapeHtml(address.country || 'India'),
  ].filter(Boolean).join(', ');

  const itemsHtml = (order.items || []).map((item) => {
    const itemName = escapeHtml(item.name);
    const itemQty = Number(item.quantity) || 1;
    const itemPrice = formatPrice(item.price);
    const itemTotal = formatPrice(item.subtotal || item.price * itemQty);

    return `
      <tr style="border-bottom: 1px solid #E5E7EB;">
        <td style="padding: 10px 8px; font-size: 13px; color: #111827; font-weight: 600;">${itemName}</td>
        <td style="padding: 10px 8px; font-size: 13px; color: #4B5563; text-align: center;">${itemQty}</td>
        <td style="padding: 10px 8px; font-size: 13px; color: #4B5563; text-align: right;">${itemPrice}</td>
        <td style="padding: 10px 8px; font-size: 13px; color: #111827; font-weight: 700; text-align: right;">${itemTotal}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Order Received - PLUXPC</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1F2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F9FAFB; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 620px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1E293B; padding: 24px 32px; border-bottom: 3px solid #E31E24;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 900; color: #FFFFFF;">PLUX<span style="color: #E31E24;">PC</span> <span style="font-size: 14px; font-weight: 500; color: #94A3B8;">| Admin Dispatch Alert</span></span>
                  </td>
                  <td style="text-align: right;">
                    <span style="background-color: #059669; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase;">Payment Captured</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 28px 32px;">
              <h1 style="font-size: 18px; font-weight: 800; color: #0F172A; margin: 0 0 16px 0;">
                🔔 New Order Received: <span style="color: #E31E24; font-family: monospace;">${orderNumber}</span>
              </h1>
              <p style="font-size: 13px; color: #475569; margin: 0 0 20px 0;">
                A new order has been successfully verified and paid on PLUXPC. Please review the shipment details below.
              </p>

              <!-- Customer & Order Meta -->
              <table role="presentation" width="100%" style="background-color: #F8FAFC; border-radius: 12px; border: 1px solid #E2E8F0; padding: 14px; margin-bottom: 20px; font-size: 13px;">
                <tr>
                  <td style="padding: 4px 8px; color: #64748B; width: 35%;">Order ID:</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #0F172A; font-family: monospace;">${orderNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px; color: #64748B;">Customer Name:</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #0F172A;">${customerName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px; color: #64748B;">Customer Email:</td>
                  <td style="padding: 4px 8px; color: #2563EB;"><a href="mailto:${customerEmail}" style="color: #2563EB; text-decoration: none;">${customerEmail}</a></td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px; color: #64748B;">Customer Phone:</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #0F172A;">${customerPhone}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px; color: #64748B;">Order Date & Time:</td>
                  <td style="padding: 4px 8px; color: #0F172A;">${orderDate}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px; color: #64748B;">Payment Status:</td>
                  <td style="padding: 4px 8px; font-weight: 700; color: #059669;">${escapeHtml(order.paymentStatus || 'Paid').toUpperCase()} (${escapeHtml(order.razorpayPaymentId || 'Prepaid')})</td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px; color: #64748B;">Total Amount:</td>
                  <td style="padding: 4px 8px; font-size: 15px; font-weight: 900; color: #E31E24;">${formatPrice(order.total)}</td>
                </tr>
              </table>

              <!-- Ordered Products Table -->
              <h2 style="font-size: 14px; font-weight: 700; color: #0F172A; margin: 0 0 10px 0; text-transform: uppercase;">Items to Pack</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background-color: #F1F5F9; border-bottom: 2px solid #CBD5E1;">
                    <th style="padding: 8px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: left;">SKU / Name</th>
                    <th style="padding: 8px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: center; width: 50px;">Qty</th>
                    <th style="padding: 8px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: right; width: 85px;">Price</th>
                    <th style="padding: 8px; font-size: 11px; text-transform: uppercase; color: #475569; text-align: right; width: 85px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <!-- Delivery Address -->
              <h2 style="font-size: 14px; font-weight: 700; color: #0F172A; margin: 0 0 10px 0; text-transform: uppercase;">Shipping Destination</h2>
              <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px; font-size: 13px; line-height: 1.5; color: #334155; margin-bottom: 24px;">
                <strong>Recipient:</strong> ${escapeHtml(address.fullName || customerName)}<br>
                <strong>Address:</strong> ${formattedAddress}<br>
                <strong>Phone:</strong> ${customerPhone}
              </div>

              <!-- Admin Action -->
              <table role="presentation" width="100%" style="text-align: center;">
                <tr>
                  <td align="center">
                    <a href="${getAdminClientUrl()}/admin/orders" style="display: inline-block; background-color: #1E293B; color: #FFFFFF; font-size: 13px; font-weight: 700; text-decoration: none; padding: 10px 24px; border-radius: 8px;">
                      Open Order in Admin Panel
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F1F5F9; padding: 16px 32px; text-align: center; font-size: 11px; color: #64748B;">
              Automated warehouse notification generated by PLUXPC E-Commerce Engine.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Sends order confirmation email to the customer.
 * Uses atomic concurrency lock to ensure exactly-once execution.
 */
export async function sendOrderConfirmationToCustomer(order, customer, overrideTransporter = null) {
  if (!order || !order._id) {
    return { success: false, reason: 'Invalid order object' };
  }

  // Strict verification: Only verified paid orders can trigger customer emails
  if (order.paymentStatus !== 'paid') {
    return { success: false, reason: 'Order payment is not verified as paid' };
  }

  // 1. Concurrency guard: Atomically lock the customer email status to 'processing'
  // Supports pending, failed, or legacy paid orders where status is missing ($exists: false or null).
  // Strictly blocks duplicate sends if already 'processing' or 'sent'.
  const claim = await Order.findOneAndUpdate(
    {
      _id: order._id,
      paymentStatus: 'paid',
      customerEmailStatus: { $ne: 'sent' },
      $or: [
        { customerEmailStatus: { $in: ['pending', 'failed'] } },
        { customerEmailStatus: { $exists: false } },
        { customerEmailStatus: null },
      ],
    },
    {
      $set: {
        customerEmailStatus: 'processing',
        customerEmailStartedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!claim) {
    // Already sent or currently being processed by concurrent thread
    return { success: false, reason: 'Customer email already sent or in-flight (duplicate prevented)' };
  }

  // 2. Resolve recipient email: prioritize order.contactEmail over registered customer.email
  const recipientEmail = (order.contactEmail || customer?.email || order.deliveryAddress?.email || '').trim().toLowerCase();
  if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail)) {
    const errorMsg = `Invalid or missing customer email address: "${recipientEmail}"`;
    await Order.findByIdAndUpdate(order._id, {
      $set: {
        customerEmailStatus: 'failed',
        customerEmailError: errorMsg,
      },
      $unset: { customerEmailStartedAt: 1 },
      $inc: { emailRetryCount: 1 },
    });
    console.warn(`[EmailService] Customer email aborted for order ${order.orderNumber}: ${errorMsg}`);
    return { success: false, reason: errorMsg };
  }

  // 3. Acquire transporter
  const transporter = getTransporter(overrideTransporter);
  if (!transporter) {
    const errorMsg = 'SMTP transporter not configured or disabled.';
    await Order.findByIdAndUpdate(order._id, {
      $set: {
        customerEmailStatus: 'failed',
        customerEmailError: errorMsg,
      },
      $unset: { customerEmailStartedAt: 1 },
      $inc: { emailRetryCount: 1 },
    });
    return { success: false, reason: errorMsg };
  }

  const config = getSmtpConfig();

  // 4. Dispatch Email
  try {
    const html = generateCustomerEmailHtml(order, customer);
    const mailOptions = {
      from: `"PLUXPC Support" <${config.fromEmail}>`,
      to: recipientEmail,
      subject: 'Your PLUXPC Order Has Been Confirmed!',
      html,
    };

    const info = await transporter.sendMail(mailOptions);

    // 5. Update Order record to 'sent'
    await Order.findByIdAndUpdate(order._id, {
      $set: {
        customerEmailStatus: 'sent',
        customerEmailSentAt: new Date(),
        customerEmailError: null,
      },
      $unset: { customerEmailStartedAt: 1 },
    });

    console.log(`[EmailService] Customer confirmation email sent successfully for order ${order.orderNumber} to ${recipientEmail} (MessageId: ${info?.messageId || 'ok'})`);
    return { success: true, messageId: info?.messageId };
  } catch (err) {
    const safeError = err.message || 'Unknown SMTP error during customer email delivery';
    console.error(`[EmailService] Failed to send customer confirmation email for order ${order.orderNumber}:`, safeError);

    await Order.findByIdAndUpdate(order._id, {
      $set: {
        customerEmailStatus: 'failed',
        customerEmailError: safeError,
      },
      $unset: { customerEmailStartedAt: 1 },
      $inc: { emailRetryCount: 1 },
    });

    return { success: false, error: safeError };
  }
}

/**
 * Sends new order alert email to the company / admin.
 * Uses atomic concurrency lock to ensure exactly-once execution.
 */
export async function sendNewOrderAlertToAdmin(order, customer, overrideTransporter = null) {
  if (!order || !order._id) {
    return { success: false, reason: 'Invalid order object' };
  }

  // Strict verification: Only verified paid orders can trigger admin alerts
  if (order.paymentStatus !== 'paid') {
    return { success: false, reason: 'Order payment is not verified as paid' };
  }

  // 1. Concurrency guard: Atomically lock the admin email status to 'processing'
  // Supports pending, failed, or legacy paid orders where status is missing ($exists: false or null).
  // Strictly blocks duplicate sends if already 'processing' or 'sent'.
  const claim = await Order.findOneAndUpdate(
    {
      _id: order._id,
      paymentStatus: 'paid',
      adminEmailStatus: { $ne: 'sent' },
      $or: [
        { adminEmailStatus: { $in: ['pending', 'failed'] } },
        { adminEmailStatus: { $exists: false } },
        { adminEmailStatus: null },
      ],
    },
    {
      $set: {
        adminEmailStatus: 'processing',
        adminEmailStartedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!claim) {
    return { success: false, reason: 'Admin email already sent or in-flight (duplicate prevented)' };
  }

  const config = getSmtpConfig();
  const recipientEmail = config.adminEmail.toLowerCase();

  if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail)) {
    const errorMsg = `Invalid admin recipient email configured: "${recipientEmail}"`;
    await Order.findByIdAndUpdate(order._id, {
      $set: {
        adminEmailStatus: 'failed',
        adminEmailError: errorMsg,
      },
      $unset: { adminEmailStartedAt: 1 },
      $inc: { emailRetryCount: 1 },
    });
    return { success: false, reason: errorMsg };
  }

  // 2. Acquire transporter
  const transporter = getTransporter(overrideTransporter);
  if (!transporter) {
    const errorMsg = 'SMTP transporter not configured or disabled.';
    await Order.findByIdAndUpdate(order._id, {
      $set: {
        adminEmailStatus: 'failed',
        adminEmailError: errorMsg,
      },
      $unset: { adminEmailStartedAt: 1 },
      $inc: { emailRetryCount: 1 },
    });
    return { success: false, reason: errorMsg };
  }

  // 3. Dispatch Email
  try {
    const html = generateAdminEmailHtml(order, customer);
    const mailOptions = {
      from: `"PLUXPC Orders Engine" <${config.fromEmail}>`,
      to: recipientEmail,
      subject: `New Order Received - PLUXPC (#${order.orderNumber})`,
      html,
    };

    const info = await transporter.sendMail(mailOptions);

    // 4. Update Order record to 'sent'
    await Order.findByIdAndUpdate(order._id, {
      $set: {
        adminEmailStatus: 'sent',
        adminEmailSentAt: new Date(),
        adminEmailError: null,
      },
      $unset: { adminEmailStartedAt: 1 },
    });

    console.log(`[EmailService] Admin new-order notification sent successfully for order ${order.orderNumber} to ${recipientEmail}`);
    return { success: true, messageId: info?.messageId };
  } catch (err) {
    const safeError = err.message || 'Unknown SMTP error during admin notification delivery';
    console.error(`[EmailService] Failed to send admin notification for order ${order.orderNumber}:`, safeError);

    await Order.findByIdAndUpdate(order._id, {
      $set: {
        adminEmailStatus: 'failed',
        adminEmailError: safeError,
      },
      $unset: { adminEmailStartedAt: 1 },
      $inc: { emailRetryCount: 1 },
    });

    return { success: false, error: safeError };
  }
}

/**
 * Master dispatcher for an order.
 * Triggers both Customer and Admin emails asynchronously with proper population.
 * Guaranteed never to throw or reject, so caller flow remains unaffected.
 */
export async function triggerOrderEmails(orderId, overrideTransporter = null) {
  try {
    const order = await Order.findById(orderId).populate('customer', 'name email phone');
    if (!order) {
      console.warn(`[EmailService] Order ${orderId} not found when attempting to dispatch emails.`);
      return { success: false, reason: 'Order not found' };
    }

    // Strict validation: Only send for verified 'paid' orders
    if (order.paymentStatus !== 'paid') {
      console.log(`[EmailService] Skipping emails for order ${order.orderNumber}: paymentStatus is "${order.paymentStatus}", not "paid".`);
      return { success: false, reason: 'Order payment is not verified as paid' };
    }

    const customer = order.customer || {};

    // Execute both concurrently with independent error handling
    const [custRes, adminRes] = await Promise.allSettled([
      sendOrderConfirmationToCustomer(order, customer, overrideTransporter),
      sendNewOrderAlertToAdmin(order, customer, overrideTransporter),
    ]);

    return {
      success: true,
      customerEmail: custRes.status === 'fulfilled' ? custRes.value : { success: false, error: custRes.reason?.message },
      adminEmail: adminRes.status === 'fulfilled' ? adminRes.value : { success: false, error: adminRes.reason?.message },
    };
  } catch (err) {
    console.error(`[EmailService] Unexpected error in triggerOrderEmails for order ${orderId}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Safely recovers email attempts that have remained in 'processing' for more than 15 minutes
 * due to a server crash or abrupt process termination.
 * Uses dedicated processing timestamps (customerEmailStartedAt / adminEmailStartedAt).
 * Operates via atomic MongoDB updates, keeps customer and admin recovery completely independent,
 * and strictly preserves any 'sent' channel statuses.
 */
export async function recoverStaleProcessingEmails(staleThresholdMs = 15 * 60 * 1000) {
  try {
    const cutoff = new Date(Date.now() - staleThresholdMs);

    // 1. Recover stale customer email attempts (> 15 minutes in 'processing')
    const customerStaleRes = await Order.updateMany(
      {
        paymentStatus: 'paid',
        customerEmailStatus: 'processing',
        customerEmailStartedAt: { $lt: cutoff },
      },
      {
        $set: {
          customerEmailStatus: 'failed',
          customerEmailError: 'Recovered from abandoned/crashed processing state (exceeded 15 min lock)',
        },
        $unset: { customerEmailStartedAt: 1 },
        $inc: { emailRetryCount: 1 },
      }
    );

    // 2. Recover stale admin email attempts (> 15 minutes in 'processing') independently
    const adminStaleRes = await Order.updateMany(
      {
        paymentStatus: 'paid',
        adminEmailStatus: 'processing',
        adminEmailStartedAt: { $lt: cutoff },
      },
      {
        $set: {
          adminEmailStatus: 'failed',
          adminEmailError: 'Recovered from abandoned/crashed processing state (exceeded 15 min lock)',
        },
        $unset: { adminEmailStartedAt: 1 },
        $inc: { emailRetryCount: 1 },
      }
    );

    const recoveredCount = (customerStaleRes?.modifiedCount || 0) + (adminStaleRes?.modifiedCount || 0);
    if (recoveredCount > 0) {
      console.log(`[EmailService] Recovered ${recoveredCount} stale email processing attempt(s) (>15 min old).`);
    }

    return {
      customerRecovered: customerStaleRes?.modifiedCount || 0,
      adminRecovered: adminStaleRes?.modifiedCount || 0,
    };
  } catch (err) {
    console.error('[EmailService] Error recovering stale email processing attempts:', err.message);
    return { customerRecovered: 0, adminRecovered: 0, error: err.message };
  }
}

/**
 * Background retry handler for pending and failed order emails.
 * 1. Safely recovers any stale processing locks (>15 min old) left by server crashes.
 * 2. Scans for paid orders where customer or admin email is pending or failed (with retry limit).
 * 3. Enforces bounded batch concurrency (limit 20) and independent channel retries.
 */
export async function processPendingOrderEmails(maxRetries = 5, overrideTransporter = null) {
  try {
    // 1. Safely recover any stale processing locks (>15 minutes) before running scan
    await recoverStaleProcessingEmails(15 * 60 * 1000);

    // 2. Query orders with paymentStatus: 'paid' needing customer or admin delivery
    // Covers 'pending', 'failed', and legacy/transition orders where status fields are missing ($exists: false or null)
    const pendingOrders = await Order.find({
      paymentStatus: 'paid',
      $or: [
        { emailRetryCount: { $lt: maxRetries } },
        { emailRetryCount: { $exists: false } },
        { emailRetryCount: null },
      ],
      $and: [
        {
          $or: [
            { customerEmailStatus: { $in: ['pending', 'failed'] } },
            { customerEmailStatus: { $exists: false } },
            { customerEmailStatus: null },
            { adminEmailStatus: { $in: ['pending', 'failed'] } },
            { adminEmailStatus: { $exists: false } },
            { adminEmailStatus: null },
          ],
        },
        {
          $or: [
            { customerEmailStatus: { $ne: 'sent' } },
            { adminEmailStatus: { $ne: 'sent' } },
          ],
        },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(20)
      .populate('customer', 'name email phone');

    if (pendingOrders.length === 0) {
      return { processed: 0 };
    }

    console.log(`[EmailService] Found ${pendingOrders.length} order(s) needing email notifications. Processing...`);

    let processedCount = 0;
    for (const order of pendingOrders) {
      const customer = order.customer || {};

      // Independent customer retry: only if pending, failed, or missing/null (and not sent or processing)
      const shouldSendCustomer =
        order.customerEmailStatus !== 'sent' &&
        order.customerEmailStatus !== 'processing' &&
        (!order.customerEmailStatus || ['pending', 'failed'].includes(order.customerEmailStatus));

      if (shouldSendCustomer) {
        await sendOrderConfirmationToCustomer(order, customer, overrideTransporter);
      }

      // Independent admin retry: only if pending, failed, or missing/null (and not sent or processing)
      const shouldSendAdmin =
        order.adminEmailStatus !== 'sent' &&
        order.adminEmailStatus !== 'processing' &&
        (!order.adminEmailStatus || ['pending', 'failed'].includes(order.adminEmailStatus));

      if (shouldSendAdmin) {
        await sendNewOrderAlertToAdmin(order, customer, overrideTransporter);
      }

      processedCount++;
    }

    return { processed: processedCount };
  } catch (err) {
    console.error('[EmailService] Error processing pending order emails:', err.message);
    return { processed: 0, error: err.message };
  }
}
