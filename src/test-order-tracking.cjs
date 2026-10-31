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
  console.log('=== VOLTIX ORDER TRACKING COMPREHENSIVE VERIFICATION ===\n');
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
  const testCustomer1 = {
    name: 'Tracking Shopper One',
    email: `tracking_shopper1_${timestamp}@example.com`,
    password: 'SecurePassword2026!'
  };

  const testCustomer2 = {
    name: 'Tracking Shopper Two',
    email: `tracking_shopper2_${timestamp}@example.com`,
    password: 'SecurePassword2026!'
  };

  const adminCredentials = {
    email: process.env.ADMIN_EMAIL || 'admin@voltix.com',
    password: process.env.ADMIN_PASSWORD || 'AdminVoltix2026!'
  };

  let token1 = '';
  let token2 = '';
  let adminToken = '';
  let productId = '';
  let createdOrderId = '';

  try {
    // 1. Customer 1 Registration
    console.log('1. Registering Customer 1...');
    const regRes1 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, testCustomer1);

    assert(regRes1.status === 201 && regRes1.body.success, 'Customer 1 registered successfully');
    token1 = regRes1.body.token;

    // 2. Customer 2 Registration
    console.log('\n2. Registering Customer 2...');
    const regRes2 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, testCustomer2);

    assert(regRes2.status === 201 && regRes2.body.success, 'Customer 2 registered successfully');
    token2 = regRes2.body.token;

    // 3. Admin Authentication
    console.log('\n3. Authenticating Admin...');
    const adminLoginRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, adminCredentials);

    if (adminLoginRes.status === 200 && adminLoginRes.body.token) {
      assert(true, 'Admin logged in successfully');
      adminToken = adminLoginRes.body.token;
    } else {
      console.log('   Admin login failed with default credentials, trying to create admin...');
      // Admin could be missing or different password; let's verify
      assert(false, `Admin login returned status ${adminLoginRes.status}: ${JSON.stringify(adminLoginRes.body)}`);
    }

    // 4. Fetch available product & add to cart for Customer 1
    console.log('\n4. Preparing Cart and Order for Customer 1...');
    const prodRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/products?limit=20',
      method: 'GET'
    });

    const products = prodRes.body.data || prodRes.body.products || [];
    const inStock = Array.isArray(products) ? products.find(p => (p.stockQuantity || p.stock || 0) > 0) : null;
    productId = inStock?.id || inStock?._id;
    assert(!!inStock && !!productId, `Found in-stock product: "${inStock?.name || 'N/A'}" (ID: ${productId})`);

    // Add to cart
    await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/cart/items',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      }
    }, { productId, quantity: 1 });

    // 5. Create Payment Order & Verify to simulate real Order creation
    console.log('\n5. Creating Razorpay Order & Simulating Verification...');
    const deliveryAddress = {
      fullName: 'Tracking Test User',
      phone: '9876543210',
      street: '123 Innovation Highway, Tech Park Phase 2',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560100',
      country: 'India'
    };

    const createOrderRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/payments/create-order',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      }
    }, { deliveryAddress });

    assert((createOrderRes.status === 200 || createOrderRes.status === 201) && createOrderRes.body.success, 'Created Razorpay payment order');
    const rzpOrderId = createOrderRes.body.razorpayOrderId || createOrderRes.body.orderId;
    const dbOrderId = createOrderRes.body.orderId;
    createdOrderId = dbOrderId;

    // Simulate Razorpay signature verification
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const paymentId = `pay_test_${timestamp}`;
    const generatedSig = crypto
      .createHmac('sha256', secret)
      .update(`${rzpOrderId}|${paymentId}`)
      .digest('hex');

    const verifyRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/payments/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      }
    }, {
      orderId: dbOrderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: generatedSig
    });

    assert(verifyRes.status === 200 && verifyRes.body.success, 'Payment verified and Order confirmed in DB');

    // 6. Verify Customer 1 My Orders
    console.log('\n6. Testing Customer My Orders (GET /api/orders/my-orders)...');
    const myOrdersRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/orders/my-orders',
      method: 'GET',
      headers: { Authorization: `Bearer ${token1}` }
    });

    assert(myOrdersRes.status === 200 && myOrdersRes.body.success, 'Customer 1 fetched my-orders successfully');
    assert(Array.isArray(myOrdersRes.body.orders) && myOrdersRes.body.orders.length > 0, 'Orders array contains placed orders');
    const myOrder = myOrdersRes.body.orders.find(o => o._id === createdOrderId);
    assert(!!myOrder, 'Created order exists in Customer 1 my-orders');
    assert(myOrder.orderStatus === 'confirmed', `Initial order status is confirmed (actual: ${myOrder?.orderStatus})`);
    assert(Array.isArray(myOrder.trackingHistory) && myOrder.trackingHistory.length >= 2, `Tracking history has initial events: length ${myOrder?.trackingHistory?.length}`);

    // 7. Testing Customer 1 Order Tracking Detail (GET /api/orders/:orderId)
    console.log('\n7. Testing Customer Single Order Tracking (GET /api/orders/:orderId)...');
    const singleOrderRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/orders/${createdOrderId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token1}` }
    });

    assert(singleOrderRes.status === 200 && singleOrderRes.body.success, 'Customer 1 fetched single order successfully');
    assert(singleOrderRes.body.order._id === createdOrderId, 'Returned order ID matches requested ID');
    assert(singleOrderRes.body.order.trackingHistory[0].status === 'placed', 'First tracking event is "placed"');
    assert(singleOrderRes.body.order.trackingHistory[1].status === 'confirmed', 'Second tracking event is "confirmed"');

    // 8. Ownership Protection: Customer 2 CANNOT access Customer 1's Order
    console.log('\n8. Testing Customer Ownership Isolation (Customer 2 attempting access)...');
    const forbiddenRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/orders/${createdOrderId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token2}` }
    });

    assert(forbiddenRes.status === 403, `Customer 2 blocked from Customer 1 order (status: ${forbiddenRes.status})`);

    // 9. Unauthenticated Protection
    console.log('\n9. Testing Unauthenticated Access Rejections...');
    const unauthOrdersRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/orders/my-orders',
      method: 'GET'
    });
    assert(unauthOrdersRes.status === 401, `Unauthenticated /my-orders rejected with 401 (status: ${unauthOrdersRes.status})`);

    const unauthSingleRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/orders/${createdOrderId}`,
      method: 'GET'
    });
    assert(unauthSingleRes.status === 401, `Unauthenticated /api/orders/:id rejected with 401 (status: ${unauthSingleRes.status})`);

    // 10. Customer Token on Admin Endpoints Isolation
    console.log('\n10. Testing Customer Token Isolation on Admin Endpoints...');
    const custOnAdminGet = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/orders',
      method: 'GET',
      headers: { Authorization: `Bearer ${token1}` }
    });
    assert(custOnAdminGet.status === 401 || custOnAdminGet.status === 403, `Customer token blocked on GET /api/admin/orders (status: ${custOnAdminGet.status})`);

    const custOnAdminPatch = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/orders/${createdOrderId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      }
    }, { status: 'shipped' });
    assert(custOnAdminPatch.status === 401 || custOnAdminPatch.status === 403, `Customer token blocked on PATCH /api/admin/orders/:id/status (status: ${custOnAdminPatch.status})`);

    // 11. Admin Orders Query (GET /api/admin/orders)
    console.log('\n11. Testing Admin Orders Query & Filtering...');
    const adminOrdersRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/orders?search=${encodeURIComponent(createdOrderId)}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert(adminOrdersRes.status === 200 && adminOrdersRes.body.success, 'Admin orders query successful');
    assert(adminOrdersRes.body.orders.length >= 1, `Found order via admin search query`);

    // 12. Admin Status Update: confirmed -> processing
    console.log('\n12. Testing Status Transition: confirmed -> processing...');
    const procRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/orders/${createdOrderId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, {
      status: 'processing',
      description: 'Items packed and quality checked at Bengaluru fulfillment centre',
      location: 'Bengaluru Fulfillment Hub'
    });

    assert(procRes.status === 200 && procRes.body.success, 'Order transitioned to processing');
    assert(procRes.body.order.orderStatus === 'processing', 'orderStatus is now "processing"');
    assert(procRes.body.order.trackingHistory.length === 3, 'Tracking history has 3 events');

    // 13. Admin Status Update: processing -> shipped (with courier details)
    console.log('\n13. Testing Status Transition: processing -> shipped with Courier Details...');
    const shipRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/orders/${createdOrderId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, {
      status: 'shipped',
      description: 'Handed over to Blue Dart courier',
      location: 'Bengaluru Logistics Yard',
      courierName: 'Blue Dart Express',
      trackingNumber: 'BLUEDART-889977',
      trackingUrl: 'https://www.bluedart.com/tracking/BLUEDART-889977'
    });

    assert(shipRes.status === 200 && shipRes.body.success, 'Order transitioned to shipped with courier info');
    assert(shipRes.body.order.orderStatus === 'shipped', 'orderStatus is now "shipped"');
    assert(shipRes.body.order.shipment?.courierName === 'Blue Dart Express', 'courierName correctly stored');
    assert(shipRes.body.order.shipment?.trackingNumber === 'BLUEDART-889977', 'trackingNumber correctly stored');
    assert(shipRes.body.order.shipment?.trackingUrl === 'https://www.bluedart.com/tracking/BLUEDART-889977', 'trackingUrl correctly stored');

    // 14. Validation: Disallow Invalid Status Transition (shipped -> placed)
    console.log('\n14. Testing Transition Validation (Rejecting backward transition: shipped -> placed)...');
    const invalidTransRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/orders/${createdOrderId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, { status: 'placed' });

    assert(invalidTransRes.status === 400 && !invalidTransRes.body.success, `Invalid backward transition rejected with 400 (status: ${invalidTransRes.status})`);

    // 15. Admin Status Update: shipped -> out_for_delivery
    console.log('\n15. Testing Status Transition: shipped -> out_for_delivery...');
    const ofdRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/orders/${createdOrderId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, {
      status: 'out_for_delivery',
      description: 'Courier agent has out-scanned parcel for final destination delivery',
      location: 'Bengaluru South Delivery Hub'
    });

    assert(ofdRes.status === 200 && ofdRes.body.success, 'Order transitioned to out_for_delivery');
    assert(ofdRes.body.order.orderStatus === 'out_for_delivery', 'orderStatus is now "out_for_delivery"');

    // 16. Admin Status Update: out_for_delivery -> delivered
    console.log('\n16. Testing Status Transition: out_for_delivery -> delivered...');
    const delivRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/orders/${createdOrderId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, {
      status: 'delivered',
      description: 'Shipment delivered and handed over to customer',
      location: 'Bengaluru 560100'
    });

    assert(delivRes.status === 200 && delivRes.body.success, 'Order transitioned to delivered');
    assert(delivRes.body.order.orderStatus === 'delivered', 'orderStatus is now "delivered"');
    assert(!!delivRes.body.order.shipment?.deliveredAt, 'shipment.deliveredAt timestamp is set');

    // 17. Terminal Status Validation: Cannot change from delivered -> processing
    console.log('\n17. Testing Terminal State Enforcement (Rejecting delivered -> processing)...');
    const termRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/orders/${createdOrderId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, { status: 'processing' });

    assert(termRes.status === 400 && !termRes.body.success, `Transition from terminal state "delivered" rejected with 400 (status: ${termRes.status})`);

    // 18. Verify Customer View Reflects All Updates
    console.log('\n18. Testing Customer 1 View of Updated Order (GET /api/orders/:orderId)...');
    const finalCustRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/orders/${createdOrderId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token1}` }
    });

    assert(finalCustRes.status === 200 && finalCustRes.body.success, 'Customer 1 fetched updated order');
    const finalOrder = finalCustRes.body.order;
    assert(finalOrder.orderStatus === 'delivered', `Customer sees final orderStatus as "delivered" (actual: ${finalOrder.orderStatus})`);
    assert(finalOrder.trackingHistory.length === 6, `Customer receives all 6 chronological tracking events (actual: ${finalOrder.trackingHistory.length})`);
    assert(finalOrder.shipment?.courierName === 'Blue Dart Express', 'Customer sees courier name');
    assert(finalOrder.shipment?.trackingNumber === 'BLUEDART-889977', 'Customer sees tracking number');
    assert(finalOrder.shipment?.trackingUrl === 'https://www.bluedart.com/tracking/BLUEDART-889977', 'Customer sees tracking URL');
    assert(finalOrder.paymentStatus === 'paid', 'paymentStatus remained safely "paid" across all transitions');

  } catch (err) {
    console.error('Unexpected error during test execution:', err);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
