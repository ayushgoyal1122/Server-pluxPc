const http = require('http');

function request(options, data = null) {
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
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== VOLTIX CUSTOMER AUTH & CART COMPREHENSIVE VERIFICATION ===\n');
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
    name: 'Voltix Shopper',
    email: `shopper_${timestamp}@example.com`,
    password: 'SecurePassword2026!'
  };

  const testCustomer2 = {
    name: 'Second Shopper',
    email: `shopper2_${timestamp}@example.com`,
    password: 'SecurePassword2026!'
  };

  try {
    // 1. Customer Registration
    console.log('1. Testing Customer Registration...');
    const regRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, testCustomer);

    assert(regRes.status === 201, `Registration returns 201 Created (Got: ${regRes.status})`);
    assert(regRes.body.success === true, 'Response contains success: true');
    assert(regRes.body.token && typeof regRes.body.token === 'string', 'Response contains valid JWT token');
    assert(regRes.body.user && regRes.body.user.email === testCustomer.email, 'User info matches registration');
    assert(regRes.body.user.role === 'customer', 'Role is strictly customer');
    assert(!regRes.body.user.password, 'Password hash is NEVER exposed');

    const customer1Token = regRes.body.token;

    // 2. Reject Duplicate Registration
    console.log('\n2. Testing Duplicate Email Registration Rejection...');
    const dupRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, testCustomer);
    assert(dupRes.status === 409, `Duplicate email registration rejected with 409 Conflict (Got: ${dupRes.status})`);

    // 3. Customer Login with Valid Credentials
    console.log('\n3. Testing Customer Login with Valid Credentials...');
    const loginRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: testCustomer.email, password: testCustomer.password });
    assert(loginRes.status === 200, `Login returns 200 OK (Got: ${loginRes.status})`);
    assert(loginRes.body.token && typeof loginRes.body.token === 'string', 'Login returns JWT');
    assert(loginRes.body.user && loginRes.body.user.role === 'customer', 'Logged in user is customer');

    // 4. Customer Login with Invalid Credentials
    console.log('\n4. Testing Customer Login with Invalid Credentials...');
    const badLoginRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: testCustomer.email, password: 'WrongPassword123' });
    assert(badLoginRes.status === 401, `Invalid password rejected with 401 Unauthorized (Got: ${badLoginRes.status})`);

    // 5. Session Restoration via /api/auth/me
    console.log('\n5. Testing Session Restoration (GET /api/auth/me)...');
    const meRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${customer1Token}` }
    });
    assert(meRes.status === 200, `Session restoration returns 200 OK (Got: ${meRes.status})`);
    assert(meRes.body.user && meRes.body.user.email === testCustomer.email, 'Profile matches logged in customer');

    // 6. Guest Cart Rejection
    console.log('\n6. Testing Guest Rejection from Protected Cart Endpoints...');
    const guestCartRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/cart',
      method: 'GET'
    });
    assert(guestCartRes.status === 401, `Guest access to GET /api/cart rejected with 401 Unauthorized (Got: ${guestCartRes.status})`);

    // 7. Get a real product from MongoDB catalog
    console.log('\n7. Fetching Real Product from Storefront Catalog...');
    const prodRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/products?limit=2',
      method: 'GET'
    });
    const productsList = prodRes.body.data || prodRes.body.products || [];
    assert(prodRes.status === 200 && productsList.length > 0, 'Fetched products from database');
    const testProduct1 = productsList[0];
    const testProduct2 = productsList[1];
    console.log(`   Product 1: "${testProduct1.name}" (ID: ${testProduct1.id}, Price: Rs. ${testProduct1.price}, Stock: ${testProduct1.stockQuantity})`);

    // 8. Add Product to Cart as Authenticated Customer
    console.log('\n8. Testing Add to Cart (POST /api/cart/items)...');
    const addRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/cart/items',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customer1Token}`
      }
    }, { productId: testProduct1.id, quantity: 2 });
    assert(addRes.status === 200, `Add to cart returns 200 OK (Got: ${addRes.status})`);
    assert(addRes.body.cart.itemCount === 2, `Cart item count is 2 (Got: ${addRes.body.cart.itemCount})`);
    assert(addRes.body.cart.items.length === 1, 'Cart items list contains 1 distinct SKU');
    assert(addRes.body.cart.items[0].product.name === testProduct1.name, 'Product name populated in cart');
    assert(addRes.body.cart.subtotal === testProduct1.price * 2, `Subtotal calculated with authoritative DB price: Rs. ${addRes.body.cart.subtotal}`);

    // 9. Update Quantity in Cart
    console.log('\n9. Testing Quantity Update (PATCH /api/cart/items/:productId)...');
    const updateRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/cart/items/${testProduct1.id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customer1Token}`
      }
    }, { quantity: 3 });
    assert(updateRes.status === 200, `Update quantity returns 200 OK (Got: ${updateRes.status})`);
    assert(updateRes.body.cart.itemCount === 3, `Cart itemCount is now 3 (Got: ${updateRes.body.cart.itemCount})`);
    assert(updateRes.body.cart.subtotal === testProduct1.price * 3, `Subtotal updated accurately: Rs. ${updateRes.body.cart.subtotal}`);

    // 10. Enforce Stock Limits
    console.log('\n10. Testing Stock Limit Enforcement...');
    const excessQtyRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/cart/items/${testProduct1.id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customer1Token}`
      }
    }, { quantity: (testProduct1.stockQuantity || 10) + 100 });
    assert(excessQtyRes.status === 400, `Excessive quantity rejected with 400 Bad Request (Got: ${excessQtyRes.status})`);

    // 11. Add Second Product
    console.log('\n11. Adding Second Product to Cart...');
    const add2Res = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/cart/items',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customer1Token}`
      }
    }, { productId: testProduct2.id, quantity: 1 });
    assert(add2Res.status === 200, `Second product added (Got: ${add2Res.status})`);
    assert(add2Res.body.cart.itemCount === 4, `Total item count is now 4 (Got: ${add2Res.body.cart.itemCount})`);
    assert(add2Res.body.cart.items.length === 2, `Cart has 2 distinct SKU lines`);

    // 12. Remove First Product from Cart
    console.log('\n12. Testing Item Removal (DELETE /api/cart/items/:productId)...');
    const deleteRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/cart/items/${testProduct1.id}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${customer1Token}` }
    });
    assert(deleteRes.status === 200, `Delete item returns 200 OK (Got: ${deleteRes.status})`);
    assert(deleteRes.body.cart.items.length === 1, 'Only second product remains in cart');
    assert(deleteRes.body.cart.items[0].product.id === testProduct2.id, 'Remaining product is testProduct2');

    // 13. Customer Data Isolation Test (Customer B cannot see Customer A's cart)
    console.log('\n13. Testing Customer Cart Isolation...');
    const reg2Res = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, testCustomer2);
    const customer2Token = reg2Res.body.token;

    const cust2Cart = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/cart',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${customer2Token}` }
    });
    assert(cust2Cart.status === 200, `Customer 2 cart returns 200 OK (Got: ${cust2Cart.status})`);
    assert(cust2Cart.body.cart.items.length === 0, 'Customer 2 cart is completely empty (isolated from Customer 1)');

    // 14. Strict Separation: Customer Token CANNOT access Admin Endpoints
    console.log('\n14. Testing Role Security: Customer Token on Admin Endpoints...');
    const custOnAdmin = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${customer1Token}` }
    });
    assert(custOnAdmin.status === 403, `Customer token on /api/admin/dashboard rejected with 403 Forbidden (Got: ${custOnAdmin.status})`);

    // 15. Strict Separation: Admin Token CANNOT access Customer Cart Endpoints
    console.log('\n15. Testing Role Security: Admin Token on Customer Cart Endpoints...');
    // Login as Admin
    const adminLoginRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@voltix.com', password: 'AdminVoltix2026!' });
    const adminToken = adminLoginRes.body.token;
    assert(adminLoginRes.status === 200 && !!adminToken, 'Admin logged in successfully to obtain admin token');

    const adminOnCart = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/cart',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(adminOnCart.status === 403, `Admin token on /api/cart rejected with 403 Forbidden (Got: ${adminOnCart.status})`);

    // 16. Admin Credentials CANNOT Login on Customer Auth Route
    console.log('\n16. Testing Cross-Login Prevention...');
    const adminOnCustAuth = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@voltix.com', password: 'AdminVoltix2026!' });
    assert(adminOnCustAuth.status === 401, `Admin credentials rejected by customer auth endpoint (Got: ${adminOnCustAuth.status})`);

    console.log(`\n======================================================`);
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
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
