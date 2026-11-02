import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000';

async function runTests() {
  console.log('🧪 Starting Wishlist Integration Tests...');

  // 1. Verify unauthenticated access fails
  const unauthRes = await fetch(`${BASE_URL}/api/wishlist`);
  if (unauthRes.status === 401) {
    console.log('✅ Unauthenticated access correctly blocked (401)');
  } else {
    throw new Error(`Expected 401 for unauthenticated request, got ${unauthRes.status}`);
  }

  // 2. Customer login or registration to obtain token
  let token = null;
  const testCustomerEmail = 'wishlist-test@voltix.com';
  const testCustomerPassword = 'Password123!';

  // Try login first
  let loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testCustomerEmail, password: testCustomerPassword }),
  });
  let loginData = await loginRes.json();

  if (!loginData.success) {
    // Register if doesn't exist
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Wishlist Tester',
        email: testCustomerEmail,
        password: testCustomerPassword,
      }),
    });
    const regData = await regRes.json();
    if (!regData.success) {
      throw new Error(`Failed to create test customer: ${JSON.stringify(regData)}`);
    }
    token = regData.token;
    console.log('✅ Created test customer account');
  } else {
    token = loginData.token;
    console.log('✅ Logged into test customer account');
  }

  const authHeader = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 3. Clear existing wishlist for clean test run
  const clearRes = await fetch(`${BASE_URL}/api/wishlist`, {
    method: 'DELETE',
    headers: authHeader,
  });
  const clearData = await clearRes.json();
  if (!clearData.success || clearData.wishlist.count !== 0) {
    throw new Error(`Failed to clear wishlist: ${JSON.stringify(clearData)}`);
  }
  console.log('✅ Wishlist cleared successfully');

  // 4. Add items using custom id ('p1') and slug ('voltix-airdopes-161')
  const add1 = await fetch(`${BASE_URL}/api/wishlist/items`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ productId: 'p1' }),
  });
  const add1Data = await add1.json();
  if (!add1Data.success || add1Data.wishlist.count !== 1) {
    throw new Error(`Failed to add item p1: ${JSON.stringify(add1Data)}`);
  }
  console.log('✅ Added product p1 to wishlist');

  // 5. Duplicate test: adding p1 again should not duplicate
  const addDup = await fetch(`${BASE_URL}/api/wishlist/items`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ productId: 'p1' }),
  });
  const addDupData = await addDup.json();
  if (!addDupData.success || addDupData.wishlist.count !== 1) {
    throw new Error(`Duplicate prevention failed! Count is ${addDupData.wishlist?.count}`);
  }
  console.log('✅ Duplicate prevention verified (count remained 1)');

  // 6. Add second product by slug
  const add2 = await fetch(`${BASE_URL}/api/wishlist`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ productId: 'voltix-storm-call-3' }),
  });
  const add2Data = await add2.json();
  if (!add2Data.success || add2Data.wishlist.count !== 2) {
    throw new Error(`Failed to add product by slug: ${JSON.stringify(add2Data)}`);
  }
  console.log('✅ Added second product by slug to wishlist (count is 2)');

  // 7. GET /api/wishlist verification
  const getRes = await fetch(`${BASE_URL}/api/wishlist`, {
    headers: authHeader,
  });
  const getData = await getRes.json();
  if (!getData.success || getData.wishlist.count !== 2) {
    throw new Error(`GET /api/wishlist returned unexpected count: ${getData.wishlist?.count}`);
  }
  console.log(`✅ GET /api/wishlist verified with ${getData.wishlist.count} items`);

  // 8. Remove one item by productId
  const removeRes = await fetch(`${BASE_URL}/api/wishlist/items/p1`, {
    method: 'DELETE',
    headers: authHeader,
  });
  const removeData = await removeRes.json();
  if (!removeData.success || removeData.wishlist.count !== 1) {
    throw new Error(`Remove item failed: ${JSON.stringify(removeData)}`);
  }
  console.log('✅ Removed product p1 from wishlist (count is now 1)');

  // 9. Merge guest wishlist test
  const mergeRes = await fetch(`${BASE_URL}/api/wishlist/merge`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      items: [{ productId: 'p3' }, { productId: 'p4' }],
    }),
  });
  const mergeData = await mergeRes.json();
  if (!mergeData.success || mergeData.wishlist.count !== 3) {
    throw new Error(`Merge failed: count is ${mergeData.wishlist?.count}`);
  }
  console.log(`✅ Merge guest wishlist succeeded (count is now ${mergeData.wishlist.count})`);

  // 10. Clean up test user wishlist
  await fetch(`${BASE_URL}/api/wishlist`, {
    method: 'DELETE',
    headers: authHeader,
  });
  console.log('✅ Final test cleanup completed');

  // 11. Verify Customer Order VO-278301-4806 is intact
  const conn = await connectDB();
  const order = await conn.connection.db.collection('orders').findOne({ orderNumber: 'VO-278301-4806' });
  if (order) {
    console.log(`✅ Order VO-278301-4806 verified intact in MongoDB: Total ₹${order.total}, Payment: ${order.paymentStatus}`);
  } else {
    throw new Error('CRITICAL: Order VO-278301-4806 not found!');
  }
  await mongoose.disconnect();

  console.log('\n🎉 ALL WISHLIST TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
