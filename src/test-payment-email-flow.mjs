import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { triggerOrderEmails } from './services/emailService.js';
import { Order } from './models/Order.js';

console.log('=== Starting Payment-to-Email Flow & Non-Regression Test ===\n');

// Mock order data
const mockCustomer = {
  _id: 'cust_9999',
  name: 'Alex Johnson',
  email: 'alex.johnson@example.com',
  phone: '9876500000',
};

const mockOrder = {
  _id: 'ord_flow_test_001',
  orderNumber: 'VO-FLOW-001',
  paymentStatus: 'pending', // Starts pending!
  orderStatus: 'placed',
  total: 4999,
  subtotal: 4999,
  shippingFee: 0,
  customer: mockCustomer,
  deliveryAddress: {
    fullName: 'Alex Johnson',
    street: '45 Silicon Avenue',
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500081',
    phone: '9876500000',
  },
  items: [
    {
      name: 'VOLTIX True Wireless ANC Earbuds',
      quantity: 2,
      price: 2499.5,
      subtotal: 4999,
    },
  ],
  customerEmailStatus: 'pending',
  adminEmailStatus: 'pending',
  emailRetryCount: 0,
};

// In-memory test store
const store = new Map();
store.set(mockOrder._id, mockOrder);

// Hook into Order methods
const origFindById = Order.findById;
const origFindOneAndUpdate = Order.findOneAndUpdate;
const origFindByIdAndUpdate = Order.findByIdAndUpdate;

Order.findById = (id) => {
  const doc = store.get(String(id));
  return {
    ...doc,
    populate: async () => doc,
  };
};

Order.findOneAndUpdate = async (filter, update) => {
  const doc = store.get(String(filter._id));
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
  return doc;
};

Order.findByIdAndUpdate = async (id, update) => {
  const doc = store.get(String(id));
  if (!doc) return null;
  if (update.$set) Object.assign(doc, update.$set);
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) {
      doc[k] = (doc[k] || 0) + v;
    }
  }
  return doc;
};

const capturedEmails = [];
const mockTransporter = {
  sendMail: async (options) => {
    capturedEmails.push(options);
    return { messageId: `<flow-${Date.now()}@test.pluxpc>` };
  },
};

try {
  // Scenario 1: Order is still 'pending' (Awaiting Razorpay authorization)
  console.log('Scenario 1: Attempting email dispatch on a PENDING payment...');
  const resPending = await triggerOrderEmails(mockOrder._id, mockTransporter);
  assert.strictEqual(resPending.success, false, 'Should skip email for pending payment');
  assert(resPending.reason.includes('not verified as paid'), 'Must cite paymentStatus not paid');
  assert.strictEqual(capturedEmails.length, 0, 'Zero emails must be sent for pending order');
  console.log('✓ Pending orders correctly send 0 emails.');

  // Scenario 2: Order is 'failed' (Razorpay payment failed)
  console.log('\nScenario 2: Attempting email dispatch on a FAILED payment...');
  mockOrder.paymentStatus = 'failed';
  const resFailed = await triggerOrderEmails(mockOrder._id, mockTransporter);
  assert.strictEqual(resFailed.success, false, 'Should skip email for failed payment');
  assert.strictEqual(capturedEmails.length, 0, 'Zero emails must be sent for failed order');
  console.log('✓ Failed orders correctly send 0 emails.');

  // Scenario 3: Order successfully transitions to 'paid' (Payment verification succeeded)
  console.log('\nScenario 3: Attempting email dispatch on verified PAID order...');
  mockOrder.paymentStatus = 'paid';
  const resPaid = await triggerOrderEmails(mockOrder._id, mockTransporter);
  assert.strictEqual(resPaid.success, true, 'Email dispatch should succeed for paid order');
  assert.strictEqual(capturedEmails.length, 2, 'Exactly 2 emails should be sent (1 customer, 1 admin)');
  assert.strictEqual(capturedEmails[0].to, 'alex.johnson@example.com');
  assert.strictEqual(capturedEmails[1].to, 'dev@youngdecade.com');
  assert.strictEqual(mockOrder.customerEmailStatus, 'sent');
  assert.strictEqual(mockOrder.adminEmailStatus, 'sent');
  console.log('✓ Both customer confirmation and admin notification dispatched on verified payment.');

  // Scenario 4: Webhook or retry fires for already confirmed order
  console.log('\nScenario 4: Duplicate verification / webhook event received...');
  const resDuplicate = await triggerOrderEmails(mockOrder._id, mockTransporter);
  assert.strictEqual(capturedEmails.length, 2, 'No new emails sent (count remains 2)');
  assert.strictEqual(resDuplicate.customerEmail.success, false);
  assert.strictEqual(resDuplicate.adminEmail.success, false);
  console.log('✓ Duplicate events rejected gracefully without duplicate emails.');

  // Scenario 5: Customer email failed, Admin succeeded -> Retry only sends customer email
  console.log('\nScenario 5: Partial failure recovery (Customer email fails, Admin succeeds)...');
  const partialOrder = {
    _id: 'ord_partial_003',
    orderNumber: 'VO-PARTIAL-003',
    paymentStatus: 'paid',
    customer: mockCustomer,
    deliveryAddress: mockOrder.deliveryAddress,
    items: mockOrder.items,
    customerEmailStatus: 'pending',
    adminEmailStatus: 'pending',
    emailRetryCount: 0,
  };
  store.set(partialOrder._id, partialOrder);

  // Transporter that fails for customer email, succeeds for admin
  let callCount = 0;
  const partialTransporter = {
    sendMail: async (options) => {
      callCount++;
      if (options.to === 'alex.johnson@example.com') {
        throw new Error('Customer mailbox full');
      }
      return { messageId: `<admin-ok-${Date.now()}>` };
    },
  };

  const resPartial = await triggerOrderEmails(partialOrder._id, partialTransporter);
  assert.strictEqual(partialOrder.customerEmailStatus, 'failed');
  assert.strictEqual(partialOrder.adminEmailStatus, 'sent');
  console.log('✓ Partial failure isolated: Customer marked "failed", Admin marked "sent".');

  // Now retry with working transporter
  console.log('Retrying partial order with working transporter...');
  const beforeCount = capturedEmails.length;
  await triggerOrderEmails(partialOrder._id, mockTransporter);
  assert.strictEqual(partialOrder.customerEmailStatus, 'sent');
  assert.strictEqual(capturedEmails.length, beforeCount + 1, 'Only 1 email (the failed customer email) was resent');
  assert.strictEqual(capturedEmails[capturedEmails.length - 1].to, 'alex.johnson@example.com');
  console.log('✓ Retrying only resent the failed customer email without duplicating the admin email.');

} finally {
  Order.findById = origFindById;
  Order.findOneAndUpdate = origFindOneAndUpdate;
  Order.findByIdAndUpdate = origFindByIdAndUpdate;
}

console.log('\n=== ALL PAYMENT FLOW & REGRESSION TESTS PASSED! ===');

