/**
 * Comprehensive Automated Test Suite for VOLTIX Platform Fee Management System
 * 
 * Target Environment: Isolated Test Database (e-commerce-test)
 * Run: node server/src/test-platform-fee.mjs
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
import { PlatformFeeSettings } from './models/PlatformFeeSettings.js';
import { Product } from './models/Product.js';
import { Order } from './models/Order.js';
import { Promotion } from './models/Promotion.js';
import {
  calculatePlatformFee,
  validatePlatformFeeInput,
} from './utils/platformFeeCalculator.js';

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
  console.log('\n==========================================================');
  console.log('🧪 VOLTIX Platform Fee Management Test Suite');
  console.log('==========================================================\n');

  try {
    await connectDB('e-commerce-test');

    // 1. Verify Database Isolation
    const currentDb = mongoose.connection.name;
    console.log(`Active Mongoose Database: ${currentDb}`);
    assert(currentDb === 'e-commerce-test', 'Database Isolation', `Expected e-commerce-test, got ${currentDb}`);

    // Clean up test collections in e-commerce-test
    await PlatformFeeSettings.deleteMany({});
    await Order.deleteMany({});
    await Product.deleteMany({});
    await Promotion.deleteMany({});

    console.log('\n--- 1. Calculation Engine & Arithmetic Unit Tests ---');

    // Test 1: Disabled fee results in 0
    const feeDisabled = calculatePlatformFee(2000, { enabled: false, feeType: 'fixed', feeValue: 50 });
    assert(feeDisabled === 0, 'Disabled fee returns ₹0 regardless of feeValue or subtotal');

    // Test 2: Fixed amount fee calculation
    const feeFixed = calculatePlatformFee(1500, { enabled: true, feeType: 'fixed', feeValue: 15 });
    assert(feeFixed === 15, 'Fixed platform fee of ₹15 applied on ₹1500 subtotal = ₹15');

    // Test 3: Fixed fee on 0 subtotal returns 0
    const feeFixedZero = calculatePlatformFee(0, { enabled: true, feeType: 'fixed', feeValue: 15 });
    assert(feeFixedZero === 0, 'Fixed fee on ₹0 subtotal returns ₹0');

    // Test 4: Percentage fee calculation (2% on ₹1,000 = ₹20)
    const feePct = calculatePlatformFee(1000, { enabled: true, feeType: 'percentage', feeValue: 2 });
    assert(feePct === 20, '2% platform fee on ₹1,000 = ₹20');

    // Test 5: Percentage fee with Maximum Fee Cap (2% on ₹4,000 = ₹80, capped at ₹50 = ₹50)
    const feePctCapped = calculatePlatformFee(4000, {
      enabled: true,
      feeType: 'percentage',
      feeValue: 2,
      maxFee: 50,
    });
    assert(feePctCapped === 50, '2% on ₹4,000 (uncapped ₹80) capped at maxFee ₹50 = ₹50');

    // Test 6: Percentage fee with Minimum Fee Floor (2% on ₹200 = ₹4, floor ₹10 = ₹10)
    const feePctFloor = calculatePlatformFee(200, {
      enabled: true,
      feeType: 'percentage',
      feeValue: 2,
      minFee: 10,
    });
    assert(feePctFloor === 10, '2% on ₹200 (unfloored ₹4) elevated to minFee ₹10 = ₹10');

    // Test 7: Decimal rounding to 2 places (2.5% on ₹1,234.50 = 30.8625 -> ₹30.86)
    const feeRounding = calculatePlatformFee(1234.5, { enabled: true, feeType: 'percentage', feeValue: 2.5 });
    assert(feeRounding === 30.86, 'Decimal rounding accurately preserved to 2 decimal places (₹30.86)');

    console.log('\n--- 2. Configuration Validation Tests ---');

    // Test 8: Reject negative fee value
    const valNegative = validatePlatformFeeInput({ enabled: true, feeType: 'fixed', feeValue: -10 });
    assert(!valNegative.valid && valNegative.errors.some((e) => e.includes('non-negative')), 'Negative feeValue rejected');

    // Test 9: Reject percentage > 100%
    const valOver100 = validatePlatformFeeInput({ enabled: true, feeType: 'percentage', feeValue: 105 });
    assert(!valOver100.valid && valOver100.errors.some((e) => e.includes('100%')), 'Percentage fee > 100% rejected');

    // Test 10: Reject minFee > maxFee
    const valMinGtMax = validatePlatformFeeInput({
      enabled: true,
      feeType: 'percentage',
      feeValue: 5,
      minFee: 100,
      maxFee: 50,
    });
    assert(!valMinGtMax.valid && valMinGtMax.errors.some((e) => e.includes('cannot exceed')), 'minFee > maxFee rejected');

    // Test 11: Valid percentage with min and max accepted
    const valValid = validatePlatformFeeInput({
      enabled: true,
      feeType: 'percentage',
      feeValue: 2,
      minFee: 5,
      maxFee: 50,
    });
    assert(valValid.valid === true, 'Valid configuration with minFee and maxFee accepted');

    console.log('\n--- 3. Interaction with Subtotal & Promo Code Discounts ---');

    // Seed test product
    const prod = await Product.create({
      name: 'VOLTIX Wireless Headphones',
      slug: 'voltix-wireless-headphones-test',
      price: 2000,
      category: 'audio',
      categoryLabel: 'Audio',
      rating: 4.8,
      reviewCount: 20,
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    });

    // Seed test promotion: Flat ₹500 off
    const promo = await Promotion.create({
      name: 'Mega Voucher',
      code: 'MEGA500',
      discountType: 'fixed',
      discountValue: 500,
      isActive: true,
      appliesTo: 'all',
    });

    const catalogPrice = prod.price; // 2000
    const promoDiscount = promo.discountValue; // 500
    // Eligible merchandise subtotal after discount
    const eligibleSubtotal = Math.max(0, catalogPrice - promoDiscount); // 1500

    // Test 12: Percentage platform fee calculated strictly against net eligible subtotal (2% on ₹1,500 = ₹30, NOT 2% on ₹2,000)
    const feeOnDiscounted = calculatePlatformFee(eligibleSubtotal, {
      enabled: true,
      feeType: 'percentage',
      feeValue: 2,
    });
    assert(feeOnDiscounted === 30, 'Fee calculated strictly on net eligible subtotal after discount (2% of ₹1500 = ₹30)');

    // Test 13: Order grand total composition includes fee exactly once
    const shippingFee = 0;
    const finalOrderTotal = eligibleSubtotal + shippingFee + feeOnDiscounted; // 1500 + 0 + 30 = 1530
    assert(finalOrderTotal === 1530, 'Grand total = eligibleSubtotal + shipping + platformFee (1500 + 0 + 30 = 1530)');

    console.log('\n--- 4. Mongoose Order Snapshot & Immutability Tests ---');

    // Save platform fee configuration in test database
    const savedSettings = await PlatformFeeSettings.create({
      enabled: true,
      feeType: 'percentage',
      feeValue: 2,
      minFee: 10,
      maxFee: 50,
    });

    // Create order with immutable platform fee snapshot
    const testOrder = await Order.create({
      orderNumber: 'VO-FEE-TEST-001',
      customer: new mongoose.Types.ObjectId(),
      items: [
        {
          product: prod._id,
          name: prod.name,
          slug: prod.slug,
          imageUrl: prod.imageUrl,
          price: catalogPrice,
          originalPrice: catalogPrice,
          discount: 0,
          quantity: 1,
          subtotal: catalogPrice,
        },
      ],
      subtotalBeforeDiscount: catalogPrice,
      subtotal: eligibleSubtotal,
      discount: promoDiscount,
      promoCode: promo.code,
      promotion: promo._id,
      shippingFee: 0,
      platformFee: feeOnDiscounted,
      platformFeeType: savedSettings.feeType,
      platformFeeValue: savedSettings.feeValue,
      platformFeeEnabledAtPurchase: true,
      total: finalOrderTotal,
      currency: 'INR',
      deliveryAddress: {
        fullName: 'Test Customer',
        phone: '9876543210',
        street: '456 Test Boulevard',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
      },
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
    });

    assert(testOrder._id != null, 'Order with platform fee snapshot saved to database');
    assert(testOrder.platformFee === 30, 'Order snapshot platformFee equals ₹30');
    assert(testOrder.platformFeeType === 'percentage', 'Order snapshot platformFeeType intact');
    assert(testOrder.platformFeeValue === 2, 'Order snapshot platformFeeValue intact');
    assert(testOrder.platformFeeEnabledAtPurchase === true, 'Order snapshot platformFeeEnabledAtPurchase intact');
    assert(testOrder.total === 1530, 'Order snapshot total intact (₹1530)');

    // Test 14: Historical Immutability Test
    // Admin changes settings to fixed ₹100 or disabled
    await PlatformFeeSettings.updateOne({}, { enabled: false, feeType: 'fixed', feeValue: 100 });

    // Fetch previously saved order from DB
    const fetchedOrder = await Order.findById(testOrder._id);
    assert(fetchedOrder.platformFee === 30, 'Historical order platformFee unchanged after admin updates settings');
    assert(fetchedOrder.total === 1530, 'Historical order total unchanged after admin updates settings');
    assert(fetchedOrder.platformFeeEnabledAtPurchase === true, 'Historical order purchase-time snapshot intact');

    console.log('\n--- 5. Dynamic Toggle Switch & State Persistence Tests ---');

    // Test 15: Clean singleton retrieval
    let currentSettings = await PlatformFeeSettings.getOrCreate();
    assert(currentSettings.enabled === false, 'Settings initially retrieved with disabled state');

    // Test 16: Toggle to ENABLED and persist
    currentSettings.enabled = true;
    currentSettings.feeType = 'fixed';
    currentSettings.feeValue = 25;
    await currentSettings.save();

    const enabledSettings = await PlatformFeeSettings.findById(currentSettings._id);
    assert(enabledSettings.enabled === true, 'Toggle to ENABLED persisted successfully in MongoDB');
    assert(enabledSettings.feeValue === 25, 'Fee value of ₹25 persisted in MongoDB');

    // Test 17: Fee calculation when enabled
    const feeWhenEnabled = calculatePlatformFee(1000, enabledSettings);
    assert(feeWhenEnabled === 25, 'When enabled, configured platform fee (₹25) is returned');

    // Test 18: Toggle to DISABLED and persist
    enabledSettings.enabled = false;
    await enabledSettings.save();

    const disabledSettings = await PlatformFeeSettings.findById(currentSettings._id);
    assert(disabledSettings.enabled === false, 'Toggle to DISABLED persisted successfully in MongoDB');

    // Test 19: Fee calculation when disabled
    const feeWhenDisabled = calculatePlatformFee(1000, disabledSettings);
    assert(feeWhenDisabled === 0, 'When disabled, platform fee returns exactly ₹0.00');

    // Test 20: Re-enable and test percentage toggle
    disabledSettings.enabled = true;
    disabledSettings.feeType = 'percentage';
    disabledSettings.feeValue = 1.5;
    disabledSettings.minFee = 15;
    disabledSettings.maxFee = 100;
    await disabledSettings.save();

    const percentageSettings = await PlatformFeeSettings.findById(currentSettings._id);
    assert(percentageSettings.enabled === true && percentageSettings.feeType === 'percentage', 'Percentage fee settings toggle enabled & persisted');
    const feePctCalculated = calculatePlatformFee(2000, percentageSettings); // 1.5% of 2000 = 30
    assert(feePctCalculated === 30, 'When percentage enabled, 1.5% of ₹2,000 = ₹30');

    console.log('\n==========================================================');
    console.log(`🎉 ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('==========================================================\n');
  } catch (err) {
    console.error('\n❌ Test Suite encountered an error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

runTests();

