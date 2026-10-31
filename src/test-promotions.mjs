/**
 * Comprehensive Automated Test Suite for VOLTIX Promo Code & Discount Management System
 * 
 * Target Environment: Isolated Test Database (e-commerce-test)
 * Run: node server/src/test-promotions.mjs
 */

process.env.NODE_ENV = 'test';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import './models/Category.js';
import { Promotion } from './models/Promotion.js';
import { Product } from './models/Product.js';
import { Order } from './models/Order.js';
import { User } from './models/User.js';
import {
  calculateItemDiscount,
  isPromotionValid,
  getBestPromotionForProduct,
  evaluateCartPromotion,
} from './utils/discountCalculator.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}: ${details}`);
    throw new Error(`Test failed: ${testName} - ${details}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 VOLTIX Promo Code & Discount Management Test Suite');
  console.log('======================================================\n');

  try {
    await connectDB('e-commerce-test');

    // Verify database connection is isolated test db
    const currentDb = mongoose.connection.name;
    console.log(`Active Mongoose Database: ${currentDb}`);
    assert(currentDb === 'e-commerce-test', 'Database Isolation', `Expected e-commerce-test, got ${currentDb}`);

    // Clean up test collections in e-commerce-test
    await Promotion.deleteMany({});
    await Order.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({ email: 'testcustomer@voltix.com' });

    console.log('\n--- 1. Arithmetic Unit Tests (discountCalculator) ---');

    // Unit Test 1: Percentage calculation
    const calc1 = calculateItemDiscount(1000, 'percentage', 20);
    assert(calc1.discount === 200 && calc1.discountedPrice === 800, '20% off 1000 = 800');

    // Unit Test 2: Percentage with max cap
    const calc2 = calculateItemDiscount(10000, 'percentage', 20, 500);
    assert(calc2.discount === 500 && calc2.discountedPrice === 9500, '20% off 10000 capped at 500 = 9500');

    // Unit Test 3: Fixed amount calculation
    const calc3 = calculateItemDiscount(1200, 'fixed', 300);
    assert(calc3.discount === 300 && calc3.discountedPrice === 900, 'Flat ₹300 off 1200 = 900');

    // Unit Test 4: Fixed amount exceeding product price clamped to 0
    const calc4 = calculateItemDiscount(250, 'fixed', 300);
    assert(calc4.discount === 250 && calc4.discountedPrice === 0, 'Fixed ₹300 off 250 clamped to 0 (no negative prices)');

    console.log('\n--- 2. Promotion Validation & Cart Evaluation Tests ---');

    const now = new Date();
    const activePromo = {
      code: 'SUMMER20',
      name: 'Summer Sale',
      discountType: 'percentage',
      discountValue: 20,
      isActive: true,
      startDate: new Date(now.getTime() - 86400000), // yesterday
      endDate: new Date(now.getTime() + 86400000),   // tomorrow
      minPurchaseAmount: 500,
      maxUsageLimit: 10,
      usedCount: 2,
      perCustomerLimit: 1,
      usedBy: [{ customer: new mongoose.Types.ObjectId() }],
      appliesTo: 'all',
    };

    // Valid promo check with isPromotionValid
    assert(isPromotionValid(activePromo) === true, 'Active promo within dates and budget is valid');

    // Inactive promo
    assert(isPromotionValid({ ...activePromo, isActive: false }) === false, 'Inactive promo rejected');

    // Expired promo
    assert(isPromotionValid({ ...activePromo, endDate: new Date(now.getTime() - 1000) }) === false, 'Expired promo rejected');

    // Future promo
    assert(isPromotionValid({ ...activePromo, startDate: new Date(now.getTime() + 86400000) }) === false, 'Future scheduled promo rejected');

    // Seed 2 products in test database
    const prodA = await Product.create({
      name: 'Wireless Earbuds Pro',
      slug: 'wireless-earbuds-pro-test',
      price: 2000,
      category: 'audio',
      categoryLabel: 'Audio',
      rating: 4.8,
      reviewCount: 15,
      imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df',
    });

    const prodB = await Product.create({
      name: 'Gaming Mouse Test',
      slug: 'gaming-mouse-test',
      price: 1000,
      category: 'accessories',
      categoryLabel: 'Accessories',
      rating: 4.5,
      reviewCount: 8,
      imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46',
    });

    // Test Cart with prodA & prodB
    const sampleCart = [
      { product: { _id: prodA._id, price: 2000, name: prodA.name }, quantity: 1 },
      { product: { _id: prodB._id, price: 1000, name: prodB.name }, quantity: 1 },
    ];

    // Minimum purchase amount not met
    const minOrderRes = evaluateCartPromotion(
      { ...activePromo, minPurchaseAmount: 5000 },
      sampleCart
    );
    assert(minOrderRes.valid === false && minOrderRes.reason.includes('Minimum cart value'), 'Order below minPurchaseAmount rejected');

    // Per-customer limit reached
    const usedCustomerId = new mongoose.Types.ObjectId();
    const custLimitRes = evaluateCartPromotion(
      { ...activePromo, usedBy: [{ customer: usedCustomerId }] },
      sampleCart,
      usedCustomerId
    );
    assert(custLimitRes.valid === false && custLimitRes.reason.includes('maximum allowed times'), 'Customer usage limit enforced');

    // Global usage limit reached
    const globalLimitRes = evaluateCartPromotion(
      { ...activePromo, maxUsageLimit: 5, usedCount: 5 },
      sampleCart
    );
    assert(globalLimitRes.valid === false && globalLimitRes.reason.includes('maximum global redemption limit'), 'Global usage limit enforced');

    console.log('\n--- 3. Specific Product Targeting & Stacking Prevention ---');

    // Specific product promotion: only applies to prodA
    const specificPromo = {
      name: 'Audio Sale',
      code: 'AUDIO25',
      discountType: 'percentage',
      discountValue: 25,
      isActive: true,
      appliesTo: 'specific',
      products: [prodA._id],
      minPurchaseAmount: 0,
    };

    const evalResult = evaluateCartPromotion(specificPromo, sampleCart);
    assert(evalResult.valid === true, 'Cart evaluation succeeds for eligible items');
    assert(evalResult.discountAmount === 500, 'Only eligible product prodA receives 25% discount (25% of 2000 = 500)');
    assert(evalResult.finalTotal === 2500, 'Final total is 3000 - 500 = 2500');

    // Best promotion selection among multiple active promotions (highest monetary savings wins)
    const promo1 = {
      name: 'Flat ₹200 off',
      code: 'FLAT200',
      discountType: 'fixed',
      discountValue: 200,
      isActive: true,
      appliesTo: 'all',
    };
    const promo2 = {
      name: '20% off',
      code: 'PCT20',
      discountType: 'percentage',
      discountValue: 20, // on 2000 => 400 savings
      isActive: true,
      appliesTo: 'all',
    };
    const bestFound = getBestPromotionForProduct(prodA._id, prodA.price, [promo1, promo2]);
    assert(bestFound && bestFound.code === 'PCT20', 'Best promotion selected deterministically by highest savings');

    console.log('\n--- 4. Mongoose Schema Validation & Persistence Tests ---');

    // Test Promotion Mongoose schema
    const savedPromo = await Promotion.create({
      name: 'Black Friday 50',
      code: 'BF50',
      discountType: 'percentage',
      discountValue: 50,
      maxDiscountAmount: 1000,
      minPurchaseAmount: 500,
      isActive: true,
      appliesTo: 'all',
    });

    assert(savedPromo._id != null, 'Promotion created in test DB');
    assert(savedPromo.code === 'BF50', 'Promo code stored in uppercase');

    // Duplicate code test
    let duplicateRejected = false;
    try {
      await Promotion.create({
        name: 'Duplicate Promo',
        code: 'BF50',
        discountType: 'fixed',
        discountValue: 100,
      });
    } catch (err) {
      duplicateRejected = true;
    }
    assert(duplicateRejected, 'Duplicate promo code correctly rejected by unique index');

    // Order snapshot persistence test
    const testOrder = await Order.create({
      orderNumber: 'VO-TEST-0001',
      customer: new mongoose.Types.ObjectId(),
      items: [
        {
          product: prodA._id,
          name: prodA.name,
          slug: prodA.slug,
          imageUrl: prodA.imageUrl,
          price: 1500,
          originalPrice: 2000,
          discount: 500,
          discountType: 'percentage',
          discountValue: 25,
          promoCode: 'AUDIO25',
          quantity: 1,
          subtotal: 1500,
        },
      ],
      subtotal: 1500,
      subtotalBeforeDiscount: 2000,
      discount: 500,
      promoCode: 'AUDIO25',
      promotion: savedPromo._id,
      shippingFee: 0,
      total: 1500,
      currency: 'INR',
      deliveryAddress: {
        fullName: 'Test Customer',
        phone: '9876543210',
        street: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
      },
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
    });

    assert(testOrder._id != null, 'Order with promotion snapshot created');
    assert(testOrder.items[0].originalPrice === 2000, 'Original price snapshot intact');
    assert(testOrder.items[0].discount === 500, 'Item discount snapshot intact');
    assert(testOrder.promotion.equals(savedPromo._id), 'Order promotion reference intact');

    console.log('\n======================================================');
    console.log(`🎉 ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ Test Suite encountered an error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

runTests();
