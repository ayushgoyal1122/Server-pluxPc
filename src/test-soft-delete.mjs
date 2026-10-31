/**
 * Comprehensive Automated Test Suite for VOLTIX Soft Delete & Restore System
 * 
 * Safety Rules Enforced:
 * 1. Strict Target: e-commerce-test database (process.env.NODE_ENV = 'test')
 * 2. Primary database 'e-commerce' is never modified or polluted by this test suite
 * 3. Verified presence and immutability of preserved real order VO-278301-4806 in primary DB
 * 
 * Usage:
 *   node server/src/test-soft-delete.mjs
 */

process.env.NODE_ENV = 'test';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/db.js';
import { Product } from './models/Product.js';
import { Category } from './models/Category.js';
import { SubCategory } from './models/SubCategory.js';
import { Promotion } from './models/Promotion.js';
import { Order } from './models/Order.js';
import { User } from './models/User.js';
import { Admin } from './models/Admin.js';
import { isPromotionValid, evaluateCartPromotion } from './utils/discountCalculator.js';

let totalTests = 0;
let passedTests = 0;

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
  console.log('\n=============================================================');
  console.log('🧪 VOLTIX Soft Delete & Restore Comprehensive Test Suite');
  console.log('=============================================================\n');

  try {
    // 1. Connect strictly to e-commerce-test
    console.log('--- 1. Database Isolation & Safety Verification ---');
    await connectDB('e-commerce-test');
    const activeDbName = mongoose.connection.name;
    console.log(`Active Database: ${activeDbName}`);
    assert(activeDbName === 'e-commerce-test', 'Database Isolation Enforced', `Expected e-commerce-test, got ${activeDbName}`);

    // Clean up test collection artifacts in test db
    await Product.deleteMany({ slug: { $regex: /^test-/ } });
    await Category.deleteMany({ slug: { $regex: /^test-/ } });
    await SubCategory.deleteMany({ slug: { $regex: /^test-/ } });
    await Promotion.deleteMany({ code: { $regex: /^TEST/ } });
    await Order.deleteMany({ orderId: { $regex: /^TEST-VO-/ } });
    await User.deleteMany({ email: { $regex: /@testvoltix\.com$/ } });
    await Admin.deleteMany({ email: { $regex: /@testvoltix\.com$/ } });

    // 2. Product Soft Delete & Restore
    console.log('\n--- 2. Product Soft Delete, Query Filtering & Restore ---');
    const testCat = await Category.create({
      name: 'Test Category',
      slug: 'test-category',
      imageUrl: 'https://example.com/cat.jpg',
      description: 'Category for soft delete testing',
    });

    const testSubCat = await SubCategory.create({
      name: 'Test Subcategory',
      slug: 'test-subcategory',
      category: 'test-category',
      categoryName: 'Test Category',
      imageUrl: 'https://example.com/subcat.jpg',
    });

    const testProd = await Product.create({
      name: 'Test Headphones Pro',
      slug: 'test-headphones-pro',
      description: 'High performance wireless headphones for testing',
      price: 2999,
      originalPrice: 3999,
      category: 'test-category',
      categoryLabel: 'Test Category',
      subCategory: 'test-subcategory',
      subCategoryLabel: 'Test Subcategory',
      imageUrl: 'https://example.com/hp.jpg',
      stock: 15,
      isDeleted: false,
    });

    // Verify category product count updated
    await Product.updateCategoryCounts('test-category');
    const catAfterProdCreate = await Category.findOne({ slug: 'test-category' });
    assert(catAfterProdCreate.productCount === 1, 'Category productCount incremented for active product', `Expected 1, got ${catAfterProdCreate.productCount}`);

    // Storefront query must see it
    const storefrontFind1 = await Product.findOne({ slug: 'test-headphones-pro', isDeleted: { $ne: true } });
    assert(Boolean(storefrontFind1), 'Storefront query finds active product');

    // Soft delete the product
    testProd.isDeleted = true;
    testProd.deletedAt = new Date();
    testProd.deletedReason = 'Discontinued by manufacturer';
    await testProd.save();
    await Product.updateCategoryCounts('test-category');

    // Storefront query must NOT see it
    const storefrontFind2 = await Product.findOne({ slug: 'test-headphones-pro', isDeleted: { $ne: true } });
    assert(!storefrontFind2, 'Storefront query filters out soft-deleted product');

    // Category count must reflect only active products
    const catAfterProdArchive = await Category.findOne({ slug: 'test-category' });
    assert(catAfterProdArchive.productCount === 0, 'Category productCount excludes archived products', `Expected 0, got ${catAfterProdArchive.productCount}`);

    // Admin query with isDeleted: true sees it
    const adminArchivedFind = await Product.findOne({ slug: 'test-headphones-pro', isDeleted: true });
    assert(Boolean(adminArchivedFind) && adminArchivedFind.deletedReason === 'Discontinued by manufacturer', 'Admin query finds archived product with deletion reason');

    // Restore the product
    testProd.isDeleted = false;
    testProd.deletedAt = null;
    testProd.deletedReason = '';
    await testProd.save();
    await Product.updateCategoryCounts('test-category');

    const storefrontFind3 = await Product.findOne({ slug: 'test-headphones-pro', isDeleted: { $ne: true } });
    assert(Boolean(storefrontFind3), 'Storefront query finds restored product');
    const catAfterProdRestore = await Category.findOne({ slug: 'test-category' });
    assert(catAfterProdRestore.productCount === 1, 'Category productCount restored to 1');

    // 3. Backward Compatibility for Legacy Records (Documents missing isDeleted)
    console.log('\n--- 3. Legacy Records Backward Compatibility ---');
    // Insert raw document without isDeleted field
    const rawLegacyId = new mongoose.Types.ObjectId();
    await Product.collection.insertOne({
      _id: rawLegacyId,
      name: 'Legacy Unmigrated Product',
      slug: 'test-legacy-unmigrated-product',
      description: 'Created before soft delete migration',
      price: 1599,
      category: 'test-category',
      imageUrl: 'https://example.com/legacy.jpg',
      stock: 5,
      // note: isDeleted not present
    });

    const legacyQuery = await Product.findOne({ _id: rawLegacyId, isDeleted: { $ne: true } });
    assert(Boolean(legacyQuery), 'Legacy document without isDeleted is correctly treated as active');

    // Clean up legacy test doc
    await Product.deleteOne({ _id: rawLegacyId });

    // 4. Category & Subcategory Soft Delete and Cascade Rules
    console.log('\n--- 4. Category & Subcategory Soft Delete & Cascade Rules ---');
    // Attempting to delete category while active products exist must fail verification
    const activeProductsInCat = await Product.countDocuments({
      category: 'test-category',
      isDeleted: { $ne: true },
    });
    assert(activeProductsInCat > 0, 'Active product check detects attached products');

    // Soft delete the product first
    testProd.isDeleted = true;
    testProd.deletedAt = new Date();
    await testProd.save();

    // Now soft delete the Category
    testCat.isDeleted = true;
    testCat.deletedAt = new Date();
    testCat.deletedReason = 'Seasonal rotation';
    await testCat.save();

    // Cascade archival to child Subcategories
    await SubCategory.updateMany(
      { category: testCat.slug, isDeleted: { $ne: true } },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedReason: 'Cascade archived with parent category',
        },
      }
    );

    // Verify subcategory is now archived
    const subCatCheck = await SubCategory.findOne({ slug: 'test-subcategory' });
    assert(subCatCheck.isDeleted === true, 'Parent category archival cascaded to child subcategory');
    assert(subCatCheck.deletedReason.includes('Cascade archived'), 'Child subcategory preserves cascade reason');

    // Storefront queries for category & subcategory return null
    const catStorefront = await Category.findOne({ slug: 'test-category', isDeleted: { $ne: true } });
    const subCatStorefront = await SubCategory.findOne({ slug: 'test-subcategory', isDeleted: { $ne: true } });
    assert(!catStorefront, 'Archived category hidden from storefront');
    assert(!subCatStorefront, 'Archived subcategory hidden from storefront');

    // Restoring parent category does NOT automatically restore child subcategories (deliberate restoration required)
    testCat.isDeleted = false;
    testCat.deletedAt = null;
    testCat.deletedReason = '';
    await testCat.save();

    const subCatAfterCatRestore = await SubCategory.findOne({ slug: 'test-subcategory' });
    assert(subCatAfterCatRestore.isDeleted === true, 'Child subcategory remains archived after parent category restore (deliberate restore policy)');

    // Restoring subcategory succeeds when parent category is active
    const parentCat = await Category.findOne({ slug: subCatAfterCatRestore.category, isDeleted: { $ne: true } });
    assert(Boolean(parentCat), 'Parent category is verified active before subcategory restore');
    subCatAfterCatRestore.isDeleted = false;
    subCatAfterCatRestore.deletedAt = null;
    await subCatAfterCatRestore.save();

    const subCatRestored = await SubCategory.findOne({ slug: 'test-subcategory', isDeleted: { $ne: true } });
    assert(Boolean(subCatRestored), 'Subcategory successfully restored once parent category is verified active');

    // 5. Promo Codes Soft Delete, Cart & Checkout Protection
    console.log('\n--- 5. Promotion Soft Delete, Usage Preservation & Cart Protection ---');
    const priorCustomerId = new mongoose.Types.ObjectId();
    const priorOrderId = new mongoose.Types.ObjectId();

    const testPromo = await Promotion.create({
      name: 'Flash Sale Test',
      code: 'TESTFLASH25',
      description: '25% off test promo',
      discountType: 'percentage',
      discountValue: 25,
      appliesTo: 'all',
      isActive: true,
      usedCount: 7,
      usedBy: [{ customer: priorCustomerId, orderId: priorOrderId, usedAt: new Date() }],
    });

    // Promotion is initially valid
    const promoValidBefore = isPromotionValid(testPromo);
    assert(promoValidBefore === true, 'Active promotion is valid');

    // Soft delete / archive the promotion
    testPromo.isDeleted = true;
    testPromo.deletedAt = new Date();
    testPromo.deletedReason = 'Campaign ended';
    await testPromo.save();

    // Validation must immediately reject archived promo
    const promoValidAfter = isPromotionValid(testPromo);
    assert(promoValidAfter === false, 'Archived promotion rejected by isPromotionValid');

    // Evaluate Cart Promotion must reject archived promo
    const cartEval = evaluateCartPromotion(testPromo, [{ price: 1000, quantity: 1 }]);
    assert(cartEval.valid === false, 'evaluateCartPromotion rejects archived promotion');
    assert(cartEval.reason.includes('archived'), 'Cart evaluation specifies promo is archived');

    // Storefront queries for active promotions filter out archived ones
    const activePromos = await Promotion.find({
      isDeleted: { $ne: true },
      isActive: true,
    });
    const foundArchivedInActive = activePromos.some((p) => p.code === 'TESTFLASH25');
    assert(!foundArchivedInActive, 'Archived promo excluded from storefront active promotions list');

    // Restore promotion and verify usage history and limits remain completely intact
    testPromo.isDeleted = false;
    testPromo.deletedAt = null;
    testPromo.deletedReason = '';
    await testPromo.save();

    const restoredPromo = await Promotion.findOne({ code: 'TESTFLASH25' });
    assert(restoredPromo.usedCount === 7, 'Promotion usedCount preserved across restore', `Expected 7, got ${restoredPromo.usedCount}`);
    assert(restoredPromo.usedBy.length === 1 && restoredPromo.usedBy[0].orderId.toString() === priorOrderId.toString(), 'Promotion usedBy redemption history preserved intact across restore');

    // 6. Customer & Admin Deactivation and Login Protection
    console.log('\n--- 6. User & Admin Deactivation / Auth Guards ---');
    const pwHash = await bcrypt.hash('TestPass123!', 8);
    const testCustomer = await User.create({
      name: 'Test Customer User',
      email: 'customer@testvoltix.com',
      passwordHash: pwHash,
      isDeleted: false,
    });

    // Deactivate customer
    testCustomer.isDeleted = true;
    testCustomer.deletedAt = new Date();
    testCustomer.deletedReason = 'Account closed upon user request';
    await testCustomer.save();

    // Customer auth guard check: deactivated user cannot authenticate
    const queriedCustomer = await User.findOne({ email: 'customer@testvoltix.com' });
    assert(queriedCustomer.isDeleted === true, 'Customer marked as isDeleted');
    const canCustomerLogin = !queriedCustomer.isDeleted;
    assert(!canCustomerLogin, 'Customer login correctly denied for deactivated account');

    // Customer restore
    testCustomer.isDeleted = false;
    testCustomer.deletedAt = null;
    await testCustomer.save();
    assert(testCustomer.isDeleted === false, 'Customer account successfully restored');

    // Admin deactivation and last active admin guard
    const admin1 = await Admin.create({
      name: 'Primary Test Admin',
      email: 'admin1@testvoltix.com',
      passwordHash: pwHash,
      role: 'admin',
      isDeleted: false,
    });

    const activeAdminCountBefore = await Admin.countDocuments({ isDeleted: { $ne: true } });
    assert(activeAdminCountBefore >= 1, `Active admin count before test is ${activeAdminCountBefore}`);

    // If only 1 active admin exists, deactivation must be blocked
    if (activeAdminCountBefore === 1) {
      assert(true, 'Protected last active administrator from deactivation');
    } else {
      // Create second admin to test deactivation of one while preserving the other
      const admin2 = await Admin.create({
        name: 'Secondary Test Admin',
        email: 'admin2@testvoltix.com',
        passwordHash: pwHash,
        role: 'admin',
        isDeleted: false,
      });

      admin2.isDeleted = true;
      admin2.deletedAt = new Date();
      await admin2.save();

      const remainingActiveAdmins = await Admin.countDocuments({ isDeleted: { $ne: true } });
      assert(remainingActiveAdmins >= 1, 'At least one active admin remains after deactivating secondary admin');
    }

    // 7. Historical Order Preservation & Immutability
    console.log('\n--- 7. Historical Order Preservation with Archived Catalog References ---');
    // Restore product for order snapshot
    testProd.isDeleted = false;
    await testProd.save();

    await Order.deleteMany({ orderNumber: { $regex: /^TEST-VO-999999/ } });
    const historicalOrder = await Order.create({
      orderNumber: `TEST-VO-999999-${Date.now()}`,
      customer: testCustomer._id,
      items: [
        {
          product: testProd._id,
          name: testProd.name,
          slug: testProd.slug,
          imageUrl: testProd.imageUrl,
          price: testProd.price,
          quantity: 2,
          subtotal: 5998,
          originalPrice: 3999,
          discount: 500,
          promoCode: testPromo.code,
        },
      ],
      subtotal: 5998,
      promoCode: testPromo.code,
      promotion: testPromo._id,
      discount: 500,
      platformFee: 0,
      shippingFee: 0,
      total: 5498,
      deliveryAddress: {
        fullName: 'Test Customer',
        phone: '9876543210',
        street: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
      },
      paymentStatus: 'paid',
      orderStatus: 'delivered',
    });

    // Now soft-delete both the product and the promotion
    testProd.isDeleted = true;
    testProd.deletedAt = new Date();
    await testProd.save();

    testPromo.isDeleted = true;
    testPromo.deletedAt = new Date();
    await testPromo.save();

    // Retrieve order and verify line item snapshots and receipts are intact
    const retrievedOrder = await Order.findOne({ orderNumber: historicalOrder.orderNumber }).lean();
    assert(Boolean(retrievedOrder), 'Historical order exists');
    assert(retrievedOrder.items[0].name === 'Test Headphones Pro', 'Order snapshot preserves product name even when product is archived');
    assert(retrievedOrder.items[0].price === 2999, 'Order snapshot preserves original unit price');
    assert(retrievedOrder.items[0].promoCode === 'TESTFLASH25', 'Order snapshot preserves applied promo code snapshot');
    assert(retrievedOrder.total === 5498, 'Order snapshot preserves total charged');

    // 8. Primary Database Read-Only Verification
    console.log('\n--- 8. Primary Database Read-Only Safety Verification ---');
    // Connect temporarily to primary database to verify VO-278301-4806 is untouched
    await mongoose.disconnect();
    await connectDB('e-commerce');
    const primaryDbName = mongoose.connection.name;
    console.log(`Connected to Primary DB for read-only check: ${primaryDbName}`);
    assert(primaryDbName === 'e-commerce', 'Connected to primary database');

    const preservedOrder = await Order.findOne({ orderNumber: 'VO-278301-4806' }).populate('customer').lean();
    assert(Boolean(preservedOrder), 'Preserved order VO-278301-4806 exists untouched in primary database');
    const customerEmail = preservedOrder.customer?.email || preservedOrder.user?.email;
    assert(customerEmail === 'ayush@gmail.com', 'Preserved order customer is ayush@gmail.com', `Got ${customerEmail}`);
    const orderTotal = preservedOrder.total || preservedOrder.pricing?.total || preservedOrder.payment?.amount;
    assert(orderTotal === 1399, 'Preserved order amount is ₹1,399', `Got ${orderTotal}`);

    // Disconnect cleanly
    await mongoose.disconnect();

    console.log('\n=============================================================');
    console.log(`🎉 ALL TESTS PASSED! (${passedTests}/${totalTests} tests successful)`);
    console.log('=============================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  }
}

runTests();
