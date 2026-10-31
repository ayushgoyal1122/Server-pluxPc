const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const http = require('http');
const crypto = require('crypto');

function request(options, data = null, rawHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      if (typeof data === 'string') {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== VOLTIX RAZORPAY INTEGRATION & CHECKOUT VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  const timestamp = Date.now();
  const testCustomer = {
    name: 'Razorpay Shopper',
    email: `rzp_shopper_${timestamp}@example.com`,
    password: 'SecurePassword2026!',
  };

  const testCustomer2 = {
    name: 'Competitor Shopper',
    email: `other_shopper_${timestamp}@example.com`,
    password: 'SecurePassword2026!',
  };

  const sampleAddress = {
    fullName: 'Razorpay Shopper',
    phone: '9876543210',
    street: '123 Electronic City, Phase 1',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560100',
  };

  try {
    // 1. Register test customer 1
    console.log('1. Registering customer...');
    const regRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      testCustomer
    );
    assert(regRes.status === 201 && regRes.body.token, 'Customer 1 registered with JWT');
    const cust1Token = regRes.body.token;

    // 2. Register test customer 2
    const reg2Res = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      testCustomer2
    );
    assert(reg2Res.status === 201 && reg2Res.body.token, 'Customer 2 registered with JWT');
    const cust2Token = reg2Res.body.token;

    // 3. Guest cannot initiate payment order (401 Unauthorized)
    console.log('\n2. Testing Guest Rejection from /api/payments/create-order...');
    const guestOrderRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/payments/create-order',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { deliveryAddress: sampleAddress }
    );
    assert(
      guestOrderRes.status === 401,
      `Guest checkout rejected with 401 Unauthorized (Got: ${guestOrderRes.status})`
    );

    // 4. Customer attempts checkout with empty cart (400 Bad Request)
    console.log('\n3. Testing Empty Cart Rejection...');
    const emptyOrderRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/payments/create-order',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
        },
      },
      { deliveryAddress: sampleAddress }
    );
    assert(
      emptyOrderRes.status === 400 && emptyOrderRes.body.message?.includes('empty'),
      `Empty cart checkout rejected with 400 (Got: ${emptyOrderRes.status})`
    );

    // 5. Fetch a product from database and add to cart
    console.log('\n4. Adding Real Product to Cart...');
    const prodRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/products?limit=1',
      method: 'GET',
    });
    const product = (prodRes.body.data || prodRes.body.products)[0];
    assert(!!product, `Fetched real product: "${product.name}" (Price: Rs. ${product.price}, Stock: ${product.stockQuantity})`);

    const addRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/cart/items',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
        },
      },
      { productId: product.id, quantity: 2 }
    );
    assert(addRes.status === 200, 'Product added to customer cart (Quantity: 2)');

    // 6. Test Public Config Endpoint (Key ID exposed, Secrets NEVER exposed)
    console.log('\n5. Testing /api/payments/config Endpoint...');
    const configRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/payments/config',
      method: 'GET',
    });
    assert(configRes.status === 200, 'Config endpoint returns 200 OK');
    assert(configRes.body.currency === 'INR', 'Currency is INR');
    assert(!configRes.body.keySecret && !configRes.body.webhookSecret, 'Key Secret and Webhook Secret are NEVER exposed');

    // 7. Create Payment Order as Authenticated Customer
    console.log('\n6. Creating Payment Order via POST /api/payments/create-order...');
    const createOrderRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/payments/create-order',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
        },
      },
      { deliveryAddress: sampleAddress }
    );
    assert(createOrderRes.status === 201, `Order created with 201 Created (Got: ${createOrderRes.status})`);
    assert(createOrderRes.body.success === true, 'Response success: true');
    assert(!!createOrderRes.body.orderId, 'Internal Order ID returned');
    assert(!!createOrderRes.body.orderNumber, `Order Number generated: ${createOrderRes.body.orderNumber}`);
    assert(!!createOrderRes.body.razorpayOrderId, `Razorpay Order ID created: ${createOrderRes.body.razorpayOrderId}`);
    const expectedPaise = Math.round(product.price * 2 * 100);
    assert(
      createOrderRes.body.amount === expectedPaise,
      `Calculated authoritative amount in paise: ${createOrderRes.body.amount} (Expected: ${expectedPaise})`
    );

    const internalOrderId = createOrderRes.body.orderId;
    const rzpOrderId = createOrderRes.body.razorpayOrderId;

    // 8. Test Invalid Signature Verification Rejection (400 Bad Request)
    console.log('\n7. Testing Invalid Payment Signature Rejection...');
    const badVerifyRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/payments/verify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
        },
      },
      {
        orderId: internalOrderId,
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: 'pay_fake_payment_123',
        razorpay_signature: 'invalid_tampered_signature_hex_value',
      }
    );
    assert(
      badVerifyRes.status === 400 && badVerifyRes.body.message?.includes('signature verification failed'),
      `Tampered signature rejected with 400 Bad Request (Got: ${badVerifyRes.status})`
    );

    // 9. Test Customer Ownership Enforcement (Customer 2 cannot verify Customer 1's order)
    console.log('\n8. Testing Order Ownership & Access Security...');
    const crossVerifyRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/payments/verify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust2Token}`,
        },
      },
      {
        orderId: internalOrderId,
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: 'pay_test_456',
        razorpay_signature: 'dummy_sig',
      }
    );
    assert(
      crossVerifyRes.status === 403,
      `Cross-customer order tampering rejected with 403 Forbidden (Got: ${crossVerifyRes.status})`
    );

    // 10. Test Valid Signature Verification using HMAC-SHA256
    console.log('\n9. Testing Valid HMAC-SHA256 Signature Verification...');
    const secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder';
    const fakePaymentId = `pay_rzptest_${Date.now()}`;
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${rzpOrderId}|${fakePaymentId}`)
      .digest('hex');

    const stockBefore = product.stockQuantity ?? 50;

    const validVerifyRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/payments/verify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
        },
      },
      {
        orderId: internalOrderId,
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: validSignature,
      }
    );
    assert(validVerifyRes.status === 200, `Valid signature verified with 200 OK (Got: ${validVerifyRes.status})`);
    assert(validVerifyRes.body.order.paymentStatus === 'paid', 'Order marked as paid');
    assert(validVerifyRes.body.order.razorpayPaymentId === fakePaymentId, 'Razorpay Payment ID recorded');

    // 11. Verify Cart was Cleared in MongoDB
    console.log('\n10. Verifying Shopping Cart Cleared in Database...');
    const cartAfterRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/cart',
      method: 'GET',
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    assert(
      cartAfterRes.body.cart.items.length === 0,
      'Customer cart was cleanly cleared after successful payment verification'
    );

    // 12. Test Idempotency (Duplicate verification does not double-decrement or fail)
    console.log('\n11. Testing Payment Verification Idempotency...');
    const dupVerifyRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/payments/verify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
        },
      },
      {
        orderId: internalOrderId,
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: validSignature,
      }
    );
    assert(
      dupVerifyRes.status === 200 && dupVerifyRes.body.message?.includes('already'),
      'Duplicate verification handled idempotently without re-processing'
    );

    // 13. Test Customer Orders Endpoint
    console.log('\n12. Testing GET /api/orders/my-orders...');
    const myOrdersRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/orders/my-orders',
      method: 'GET',
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    assert(myOrdersRes.status === 200 && myOrdersRes.body.orders.length > 0, 'Customer order history returns orders');
    assert(myOrdersRes.body.orders[0]._id === internalOrderId, 'Latest order matches verified order');

    // 14. Customer 2 cannot access Customer 1's order via GET /api/orders/:id
    console.log('\n13. Testing Order Privacy (Customer 2 cannot view Customer 1 order)...');
    const cust2ViewOrder = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/orders/${internalOrderId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${cust2Token}` },
    });
    assert(
      cust2ViewOrder.status === 403,
      `Customer 2 blocked from viewing Customer 1 order with 403 Forbidden (Got: ${cust2ViewOrder.status})`
    );

    // 15. Webhook Signature Verification
    console.log('\n14. Testing Razorpay Webhook Endpoint...');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_placeholder';
    const webhookPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_webhook_${Date.now()}`,
            order_id: rzpOrderId,
            amount: expectedPaise,
            status: 'captured',
          },
        },
      },
    });

    const validWebhookSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookPayload)
      .digest('hex');

    const webhookRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/payments/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': validWebhookSig,
        },
      },
      webhookPayload
    );
    assert(webhookRes.status === 200, `Webhook accepted with valid HMAC signature (Got: ${webhookRes.status})`);

    // Invalid webhook signature rejected
    const badWebhookRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/payments/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'invalid_signature_hex',
        },
      },
      webhookPayload
    );
    assert(badWebhookRes.status === 400, `Invalid webhook signature rejected with 400 (Got: ${badWebhookRes.status})`);

    // 16. Admin Authorization Isolation: Customer token on Admin Orders
    console.log('\n15. Testing Role Separation: Customer Token on Admin Orders...');
    const custOnAdminOrders = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/orders',
      method: 'GET',
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    assert(
      custOnAdminOrders.status === 403,
      `Customer token on /api/admin/orders rejected with 403 Forbidden (Got: ${custOnAdminOrders.status})`
    );

    // Admin login and access /api/admin/orders
    const adminLoginRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/admin/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: 'admin@voltix.com', password: 'AdminVoltix2026!' }
    );
    const adminToken = adminLoginRes.body.token;
    assert(adminLoginRes.status === 200 && !!adminToken, 'Admin logged in successfully');

    const adminOrdersRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/orders',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminOrdersRes.status === 200 && adminOrdersRes.body.orders.length > 0, 'Admin can view all orders');

    console.log(`\n======================================================`);
    console.log(`RAZORPAY INTEGRATION VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
    console.log(`======================================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runTests();

