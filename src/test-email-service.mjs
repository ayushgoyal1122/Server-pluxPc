import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import {
  generateCustomerEmailHtml,
  generateAdminEmailHtml,
  sendOrderConfirmationToCustomer,
  sendNewOrderAlertToAdmin,
  triggerOrderEmails,
  processPendingOrderEmails,
  recoverStaleProcessingEmails,
  getClientUrl,
  getAdminClientUrl,
  getTransporter,
  resetTransporter,
} from './services/emailService.js';

console.log('=== Starting PLUXPC Email Service Test Suite ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: HTML Escaping & Customer Template Verification
// ─────────────────────────────────────────────────────────────────────────────
console.log('Test 1: Customer Email Template Generation & Escaping...');
const mockOrder = {
  _id: '65f1234567890abcdef12345',
  orderNumber: 'VO-123456-7890',
  createdAt: new Date('2026-11-03T10:00:00Z'),
  paymentMethod: 'razorpay',
  paymentStatus: 'paid',
  subtotalBeforeDiscount: 3999,
  subtotal: 3499,
  discount: 500,
  promoCode: 'FESTIVE500',
  platformFee: 20,
  shippingFee: 0,
  total: 3519,
  deliveryAddress: {
    fullName: 'Jane <script>alert("xss")</script> Doe',
    street: '123 Tech Park & Blvd',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    country: 'India',
    phone: '9876543210',
  },
  items: [
    {
      name: 'VOLTIX ANC Headset "Pro"',
      quantity: 1,
      price: 3499,
      subtotal: 3499,
    },
  ],
};

const mockCustomer = {
  name: 'Jane <script>alert("xss")</script> Doe',
  email: 'jane.doe@example.com',
  phone: '9876543210',
};

const customerHtml = generateCustomerEmailHtml(mockOrder, mockCustomer);

// Verify required fields exist in customer email
assert(customerHtml.includes('VO-123456-7890'), 'Order Number missing in customer email');
assert(customerHtml.includes('Jane &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; Doe'), 'XSS in customer name not properly escaped');
assert(!customerHtml.includes('<script>'), 'Unescaped script tag found in customer email');
assert(customerHtml.includes('VOLTIX ANC Headset &quot;Pro&quot;'), 'Product name escaping missing');
assert(customerHtml.includes('₹3,519.00'), 'Total amount missing or misformatted');
assert(customerHtml.includes('₹500.00'), 'Discount amount missing');
assert(customerHtml.includes('FESTIVE500'), 'Promo code missing');
assert(customerHtml.includes('Bengaluru'), 'City missing');
assert(customerHtml.includes('Karnataka'), 'State missing');
assert(customerHtml.includes('560001'), 'Postal code missing');
assert(customerHtml.includes('Razorpay'), 'Payment method missing');
assert(customerHtml.includes('Order Confirmed'), 'Confirmation badge missing');
console.log('✓ Customer HTML template passed all verification & escaping checks.');

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Admin Email Template Verification
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTest 2: Admin Email Template Generation...');
const adminHtml = generateAdminEmailHtml(mockOrder, mockCustomer);

assert(adminHtml.includes('VO-123456-7890'), 'Order Number missing in admin email');
assert(adminHtml.includes('jane.doe@example.com'), 'Customer email missing in admin email');
assert(adminHtml.includes('9876543210'), 'Customer phone missing in admin email');
assert(adminHtml.includes('VOLTIX ANC Headset &quot;Pro&quot;'), 'Product missing in admin email');
assert(adminHtml.includes('₹3,519.00'), 'Order total missing in admin email');
assert(adminHtml.includes('PAID'), 'Payment status missing in admin email');
console.log('✓ Admin HTML template passed all verification checks.');

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Dynamic URL Resolution (CLIENT_URL & ADMIN_CLIENT_URL)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTest 3: Dynamic URL Resolution Testing...');
const origClientEnv = process.env.CLIENT_URL;
const origAdminEnv = process.env.ADMIN_CLIENT_URL;

try {
  // Test comma-separated production origins
  process.env.CLIENT_URL = 'https://client-plux-pc.vercel.app, http://localhost:5173';
  process.env.ADMIN_CLIENT_URL = 'https://admin-plux-pc.vercel.app/, http://localhost:5174';

  assert.strictEqual(getClientUrl(), 'https://client-plux-pc.vercel.app');
  assert.strictEqual(getAdminClientUrl(), 'https://admin-plux-pc.vercel.app');

  const dynCustomerHtml = generateCustomerEmailHtml(mockOrder, mockCustomer);
  assert(dynCustomerHtml.includes('https://client-plux-pc.vercel.app/orders/65f1234567890abcdef12345/track'), 'Customer tracking URL did not use CLIENT_URL');

  const dynAdminHtml = generateAdminEmailHtml(mockOrder, mockCustomer);
  assert(dynAdminHtml.includes('https://admin-plux-pc.vercel.app/admin/orders'), 'Admin action URL did not use ADMIN_CLIENT_URL');

  // Test fallback when env var is empty
  delete process.env.CLIENT_URL;
  delete process.env.ADMIN_CLIENT_URL;
  assert.strictEqual(getClientUrl(), 'http://localhost:5173');
  assert.strictEqual(getAdminClientUrl(), 'http://localhost:5174');

  console.log('✓ Dynamic URL resolution passed for both production origins and local fallbacks.');
} finally {
  if (origClientEnv !== undefined) process.env.CLIENT_URL = origClientEnv;
  if (origAdminEnv !== undefined) process.env.ADMIN_CLIENT_URL = origAdminEnv;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Transporter Configuration Check
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTest 4: Transporter Configuration Check...');
resetTransporter();
const transporter = getTransporter();
assert(transporter !== null, 'Transporter should initialize when SMTP credentials are present in env');
console.log('✓ Transporter initialized successfully without revealing credentials.');

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Concurrency Protection (Idempotency) & Dedicated Timestamps
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTest 5: Concurrency Protection & Dedicated StartedAt Timestamp Testing...');

const mockOrdersDb = new Map();

// Mock Order Mongoose model
const MockOrderModel = {
  updateMany: async (filter, update) => {
    let modifiedCount = 0;
    for (const [id, doc] of mockOrdersDb.entries()) {
      let match = true;
      if (filter.paymentStatus && doc.paymentStatus !== filter.paymentStatus) match = false;
      if (filter.customerEmailStatus && doc.customerEmailStatus !== filter.customerEmailStatus) match = false;
      if (filter.adminEmailStatus && doc.adminEmailStatus !== filter.adminEmailStatus) match = false;
      if (filter.customerEmailStartedAt?.$lt && !(doc.customerEmailStartedAt < filter.customerEmailStartedAt.$lt)) match = false;
      if (filter.adminEmailStartedAt?.$lt && !(doc.adminEmailStartedAt < filter.adminEmailStartedAt.$lt)) match = false;

      if (match) {
        if (update.$set) Object.assign(doc, update.$set);
        if (update.$unset) {
          for (const k of Object.keys(update.$unset)) delete doc[k];
        }
        if (update.$inc) {
          for (const [k, v] of Object.entries(update.$inc)) doc[k] = (doc[k] || 0) + v;
        }
        modifiedCount++;
      }
    }
    return { modifiedCount };
  },
  findOneAndUpdate: async (filter, update) => {
    const id = filter._id;
    const doc = mockOrdersDb.get(id);
    if (!doc) return null;

    if (filter.paymentStatus && doc.paymentStatus !== filter.paymentStatus) {
      return null;
    }

    const checkField = (field, filterVal) => {
      const val = doc[field];
      if (filterVal.$ne !== undefined && val === filterVal.$ne) return false;
      if (filterVal.$in !== undefined && !filterVal.$in.includes(val)) return false;
      if (filterVal.$exists !== undefined && (val !== undefined) !== filterVal.$exists) return false;
      return true;
    };

    if (filter.customerEmailStatus && !checkField('customerEmailStatus', filter.customerEmailStatus)) {
      return null;
    }
    if (filter.adminEmailStatus && !checkField('adminEmailStatus', filter.adminEmailStatus)) {
      return null;
    }

    if (filter.$or) {
      let orMatch = false;
      for (const cond of filter.$or) {
        let condMatch = true;
        for (const [k, v] of Object.entries(cond)) {
          if (v && typeof v === 'object') {
            if (v.$in !== undefined && !v.$in.includes(doc[k])) condMatch = false;
            if (v.$exists !== undefined && (doc[k] !== undefined) !== v.$exists) condMatch = false;
            if (v.$ne !== undefined && doc[k] === v.$ne) condMatch = false;
          } else if (v === null) {
            if (doc[k] !== null && doc[k] !== undefined) condMatch = false;
          } else {
            if (doc[k] !== v) condMatch = false;
          }
        }
        if (condMatch) {
          orMatch = true;
          break;
        }
      }
      if (!orMatch) return null;
    }

    if (update.$set) Object.assign(doc, update.$set);
    if (update.$unset) {
      for (const k of Object.keys(update.$unset)) delete doc[k];
    }
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        doc[k] = (doc[k] || 0) + v;
      }
    }
    return doc;
  },
  findByIdAndUpdate: async (id, update) => {
    const doc = mockOrdersDb.get(id);
    if (!doc) return null;
    if (update.$set) Object.assign(doc, update.$set);
    if (update.$unset) {
      for (const k of Object.keys(update.$unset)) delete doc[k];
    }
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        doc[k] = (doc[k] || 0) + v;
      }
    }
    return doc;
  },
  find: (filter) => {
    const matchesCond = (doc, cond) => {
      for (const [k, v] of Object.entries(cond)) {
        if (k === '$or') {
          if (!v.some((subCond) => matchesCond(doc, subCond))) return false;
        } else if (k === '$and') {
          if (!v.every((subCond) => matchesCond(doc, subCond))) return false;
        } else if (v && typeof v === 'object') {
          if (v.$lt !== undefined && !(doc[k] < v.$lt)) return false;
          if (v.$in !== undefined && !v.$in.includes(doc[k])) return false;
          if (v.$ne !== undefined && doc[k] === v.$ne) return false;
          if (v.$exists !== undefined && (doc[k] !== undefined) !== v.$exists) return false;
        } else if (v === null) {
          if (doc[k] !== null && doc[k] !== undefined) return false;
        } else {
          if (doc[k] !== v) return false;
        }
      }
      return true;
    };

    const results = [];
    for (const doc of mockOrdersDb.values()) {
      if (matchesCond(doc, filter)) {
        results.push({ ...doc, customer: mockCustomer });
      }
    }
    return {
      sort: () => ({
        limit: () => ({
          populate: async () => results,
        }),
      }),
    };
  },
  findById: async (id) => {
    const doc = mockOrdersDb.get(id);
    return {
      ...doc,
      populate: async () => ({ ...doc, customer: mockCustomer }),
    };
  },
};

const sentEmails = [];
const mockTransporter = {
  sendMail: async (mailOptions) => {
    sentEmails.push(mailOptions);
    return { messageId: `<mock-${Date.now()}@pluxpc.local>` };
  },
};

// Seed test order into mock DB
const testOrderId = 'ord_test_concurrent_001';
mockOrdersDb.set(testOrderId, {
  _id: testOrderId,
  orderNumber: 'VO-TEST-001',
  paymentStatus: 'paid',
  paymentMethod: 'razorpay',
  total: 1999,
  customer: mockCustomer,
  deliveryAddress: mockOrder.deliveryAddress,
  items: mockOrder.items,
  customerEmailStatus: 'pending',
  adminEmailStatus: 'pending',
  emailRetryCount: 0,
});

import { Order } from './models/Order.js';
const origFindOneAndUpdate = Order.findOneAndUpdate;
const origFindByIdAndUpdate = Order.findByIdAndUpdate;
const origUpdateMany = Order.updateMany;
const origFind = Order.find;

Order.findOneAndUpdate = MockOrderModel.findOneAndUpdate;
Order.findByIdAndUpdate = MockOrderModel.findByIdAndUpdate;
Order.updateMany = MockOrderModel.updateMany;
Order.find = MockOrderModel.find;

try {
  // 5a: Send customer email
  const doc = mockOrdersDb.get(testOrderId);
  const sendRes1 = await sendOrderConfirmationToCustomer(doc, mockCustomer, mockTransporter);
  assert(sendRes1.success === true, 'First customer email send should succeed');
  assert(sentEmails.length === 1, 'Exactly 1 email should be captured');
  assert.strictEqual(sentEmails[0].to, 'jane.doe@example.com');
  assert(doc.customerEmailStatus === 'sent', 'Status should be updated to sent');
  console.log('✓ Initial customer email sent successfully.');

  // 5b: Duplicate call test (webhook triggers after verify)
  const sendResDuplicate = await sendOrderConfirmationToCustomer(doc, mockCustomer, mockTransporter);
  assert(sendResDuplicate.success === false, 'Duplicate customer email must be blocked');
  assert(sentEmails.length === 1, 'Duplicate email was NOT sent (correctly prevented)');
  console.log('✓ Duplicate customer email call correctly prevented by atomic locking.');

  // 5c: Admin email independent execution
  const sendAdminRes1 = await sendNewOrderAlertToAdmin(doc, mockCustomer, mockTransporter);
  assert(sendAdminRes1.success === true, 'Admin email send should succeed');
  assert(sentEmails.length === 2, 'Total sent emails should now be 2');
  assert.strictEqual(sentEmails[1].to, 'dev@youngdecade.com');
  assert(doc.adminEmailStatus === 'sent', 'Admin status should be updated to sent');
  console.log('✓ Admin notification sent independently.');

  // 5d: Duplicate admin call test
  const sendAdminDuplicate = await sendNewOrderAlertToAdmin(doc, mockCustomer, mockTransporter);
  assert(sendAdminDuplicate.success === false, 'Duplicate admin email must be blocked');
  assert(sentEmails.length === 2, 'No duplicate admin email was sent');
  console.log('✓ Duplicate admin email call correctly prevented.');

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 6: Stale Processing Lock Recovery (>15 min old)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nTest 6: Stale Processing Lock Recovery Testing...');

  const staleOrderId = 'ord_stale_crash_001';
  const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
  const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);

  // Order that crashed 20 minutes ago in 'processing'
  mockOrdersDb.set(staleOrderId, {
    _id: staleOrderId,
    orderNumber: 'VO-STALE-001',
    paymentStatus: 'paid',
    customerEmailStatus: 'processing',
    customerEmailStartedAt: twentyMinsAgo,
    adminEmailStatus: 'sent', // Admin already sent! Must NOT be touched!
    emailRetryCount: 0,
  });

  // Active in-flight order (started 2 minutes ago)
  const activeOrderId = 'ord_active_002';
  mockOrdersDb.set(activeOrderId, {
    _id: activeOrderId,
    orderNumber: 'VO-ACTIVE-002',
    paymentStatus: 'paid',
    customerEmailStatus: 'processing',
    customerEmailStartedAt: twoMinsAgo,
    adminEmailStatus: 'pending',
    emailRetryCount: 0,
  });

  const recoveryRes = await recoverStaleProcessingEmails(15 * 60 * 1000);
  assert.strictEqual(recoveryRes.customerRecovered, 1, 'Only the stale (>15m) customer attempt should be recovered');
  assert.strictEqual(recoveryRes.adminRecovered, 0, 'No admin attempt should be recovered');

  const staleDoc = mockOrdersDb.get(staleOrderId);
  assert.strictEqual(staleDoc.customerEmailStatus, 'failed', 'Stale customer email should be transitioned to failed');
  assert.strictEqual(staleDoc.adminEmailStatus, 'sent', 'Already sent admin status must be strictly preserved');
  assert.strictEqual(staleDoc.emailRetryCount, 1, 'Retry count should be incremented upon recovery');

  const activeDoc = mockOrdersDb.get(activeOrderId);
  assert.strictEqual(activeDoc.customerEmailStatus, 'processing', 'Active in-flight order (<15m) must remain processing');

  console.log('✓ Stale processing lock recovered safely without touching in-flight or sent statuses.');

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 7: Pending Paid Order Recovery by processPendingOrderEmails
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nTest 7: Pending Paid Order Recovery via processPendingOrderEmails...');

  const pendingPaidOrderId = 'ord_pending_paid_003';
  mockOrdersDb.set(pendingPaidOrderId, {
    _id: pendingPaidOrderId,
    orderNumber: 'VO-PENDING-PAID-003',
    paymentStatus: 'paid',
    customerEmailStatus: 'pending', // Was pending when server restarted
    adminEmailStatus: 'pending',
    deliveryAddress: mockOrder.deliveryAddress,
    items: mockOrder.items,
    total: 3500,
    emailRetryCount: 0,
  });

  const countBefore = sentEmails.length;
  const processRes = await processPendingOrderEmails(5, mockTransporter);
  assert(processRes.processed >= 1, 'Should process pending paid orders');

  const pendingDoc = mockOrdersDb.get(pendingPaidOrderId);
  assert.strictEqual(pendingDoc.customerEmailStatus, 'sent', 'Pending customer email should be sent');
  assert.strictEqual(pendingDoc.adminEmailStatus, 'sent', 'Pending admin email should be sent');
  console.log('✓ Pending paid orders recovered and fulfilled on background cycle.');

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 8: Backward-compatible Recovery for Legacy Paid Orders ($exists: false)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nTest 8: Backward-compatible Recovery of Orders with Missing Status Fields ($exists: false)...');

  // Case A: Exact replica of VO-939403-4451 (paid, but both email status fields are missing/undefined)
  const legacyPaidOrderId = 'ord_legacy_paid_4451';
  mockOrdersDb.set(legacyPaidOrderId, {
    _id: legacyPaidOrderId,
    orderNumber: 'VO-939403-4451',
    paymentStatus: 'paid',
    // customerEmailStatus is explicitly omitted / undefined ($exists: false)
    // adminEmailStatus is explicitly omitted / undefined ($exists: false)
    deliveryAddress: mockOrder.deliveryAddress,
    items: mockOrder.items,
    total: 1509,
    // emailRetryCount is omitted / undefined
  });

  // Case B: Partial legacy order (admin was already sent, customer was never written)
  const partialLegacyId = 'ord_legacy_partial_005';
  mockOrdersDb.set(partialLegacyId, {
    _id: partialLegacyId,
    orderNumber: 'VO-LEGACY-005',
    paymentStatus: 'paid',
    adminEmailStatus: 'sent', // Already sent! Must NEVER be resent!
    // customerEmailStatus is omitted / undefined
    deliveryAddress: mockOrder.deliveryAddress,
    items: mockOrder.items,
    total: 999,
  });

  // Case C: Unpaid order with missing status fields (must be completely ignored)
  const unpaidLegacyId = 'ord_legacy_unpaid_006';
  mockOrdersDb.set(unpaidLegacyId, {
    _id: unpaidLegacyId,
    orderNumber: 'VO-LEGACY-UNPAID',
    paymentStatus: 'pending', // Unpaid!
    deliveryAddress: mockOrder.deliveryAddress,
    items: mockOrder.items,
    total: 500,
  });

  const countBeforeLegacy = sentEmails.length;
  const legacyRecoveryRes = await processPendingOrderEmails(5, mockTransporter);

  const legacyDocA = mockOrdersDb.get(legacyPaidOrderId);
  assert.strictEqual(legacyDocA.customerEmailStatus, 'sent', 'Missing customer status on paid order must recover and transition to sent');
  assert.strictEqual(legacyDocA.adminEmailStatus, 'sent', 'Missing admin status on paid order must recover and transition to sent');

  const legacyDocB = mockOrdersDb.get(partialLegacyId);
  assert.strictEqual(legacyDocB.customerEmailStatus, 'sent', 'Missing customer status must be delivered');
  assert.strictEqual(legacyDocB.adminEmailStatus, 'sent', 'Already-sent admin status must remain sent');

  const unpaidDoc = mockOrdersDb.get(unpaidLegacyId);
  assert.strictEqual(unpaidDoc.customerEmailStatus, undefined, 'Unpaid order must never have email status set or sent');

  // Verify that a second recovery pass does NOT send duplicates
  const countAfterFirst = sentEmails.length;
  await processPendingOrderEmails(5, mockTransporter);
  assert.strictEqual(sentEmails.length, countAfterFirst, 'Second recovery cycle must send ZERO duplicate emails');

  console.log('✓ Backward-compatible recovery passed: missing status fields recovered, sent statuses preserved, unpaid orders ignored, duplicates blocked.');

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 9: Independent contactEmail Prioritization Testing
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nTest 9: Independent contactEmail Prioritization Testing...');

  const customContactOrderId = 'ord_custom_contact_009';
  const customContactDoc = {
    _id: customContactOrderId,
    orderNumber: 'VO-CUSTOM-009',
    paymentStatus: 'paid',
    contactEmail: 'ayush.internn@gmail.com', // Explicit independent order notification email
    deliveryAddress: mockOrder.deliveryAddress,
    items: mockOrder.items,
    total: 1509,
    customerEmailStatus: 'pending',
    adminEmailStatus: 'pending',
    emailRetryCount: 0,
  };
  mockOrdersDb.set(customContactOrderId, customContactDoc);

  // Registered account email is jane.doe@example.com (from mockCustomer)
  const custResCustom = await sendOrderConfirmationToCustomer(customContactDoc, mockCustomer, mockTransporter);
  assert(custResCustom.success === true, 'Customer send must succeed');
  const lastCustomerEmail = sentEmails[sentEmails.length - 1];
  assert.strictEqual(
    lastCustomerEmail.to,
    'ayush.internn@gmail.com',
    'Recipient MUST be order.contactEmail, overriding registered customer.email'
  );

  // Admin template should display contactEmail with registered account reference
  const adminHtml = generateAdminEmailHtml(customContactDoc, mockCustomer);
  assert(adminHtml.includes('ayush.internn@gmail.com'), 'Admin email must display contactEmail');
  assert(adminHtml.includes('jane.doe@example.com'), 'Admin email must reference registered account email');

  console.log('✓ contactEmail correctly prioritized over registered account email in both customer dispatch and admin notifications.');

} finally {
  Order.findOneAndUpdate = origFindOneAndUpdate;
  Order.findByIdAndUpdate = origFindByIdAndUpdate;
  Order.updateMany = origUpdateMany;
  Order.find = origFind;
}

console.log('\n=== ALL PRODUCTION READINESS EMAIL TESTS PASSED! ===');
