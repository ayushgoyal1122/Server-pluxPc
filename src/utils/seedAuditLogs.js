import { AuditLog } from '../models/AuditLog.js';
import { Admin } from '../models/Admin.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';

export async function seedInitialAuditLogs(force = false) {
  try {
    const existingCount = await AuditLog.countDocuments();
    if (existingCount > 15 && !force) {
      return;
    }

    const admin = (await Admin.findOne({ isDeleted: { $ne: true } })) || {
      _id: '672000000000000000000001',
      name: 'PLUXPC Administrator',
      email: 'admin@pluxpc.com',
      role: 'admin',
    };

    const users = await User.find({ isDeleted: { $ne: true } }).limit(5).lean();
    const products = await Product.find({ isDeleted: { $ne: true } }).limit(10).lean();
    const orders = await Order.find().limit(10).lean();

    const sampleLogs = [];
    const now = new Date();

    // Helper for timestamps relative to now
    const minutesAgo = (mins) => new Date(now.getTime() - mins * 60 * 1000);
    const hoursAgo = (hrs) => new Date(now.getTime() - hrs * 3600 * 1000);
    const daysAgo = (days, hrs = 0) => new Date(now.getTime() - (days * 24 + hrs) * 3600 * 1000);

    // 1. Today's Admin Activities
    sampleLogs.push({
      actorId: admin._id.toString(),
      actorType: 'admin',
      actorRole: 'admin',
      actorName: admin.name,
      actorEmail: admin.email,
      action: 'LOGIN',
      actionLabel: 'Login',
      module: 'AUTHENTICATION',
      moduleLabel: 'Authentication',
      entityType: 'Admin',
      entityId: admin._id.toString(),
      entityTitle: admin.name,
      description: `Administrator ${admin.name} successfully authenticated from secure dashboard terminal.`,
      result: 'success',
      requestMethod: 'POST',
      requestPath: '/api/admin/auth/login',
      ipAddress: '192.168.1.104',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
      changedFields: ['lastLogin', 'sessionToken'],
      createdAt: minutesAgo(12),
      metadata: { sessionDuration: '24h', authMethod: 'JWT Bearer' },
    });

    sampleLogs.push({
      actorId: admin._id.toString(),
      actorType: 'admin',
      actorRole: 'admin',
      actorName: admin.name,
      actorEmail: admin.email,
      action: 'CONFIG_UPDATE',
      actionLabel: 'Update',
      module: 'PLATFORM_FEE',
      moduleLabel: 'Platform Fee',
      entityType: 'PlatformFeeSettings',
      entityId: 'global_fee_settings',
      entityTitle: 'Global Platform Fee Policy',
      description: 'Admin modified platform fee configuration parameters and enabled dynamic fee rules.',
      result: 'success',
      requestMethod: 'PUT',
      requestPath: '/api/admin/settings/platform-fee',
      ipAddress: '192.168.1.104',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
      changedFields: ['feeType', 'feeValue', 'minFee', 'maxFee'],
      createdAt: minutesAgo(35),
      metadata: { feeType: 'percentage', feeValue: 2.5, minFee: 15, maxFee: 150 },
    });

    if (products.length > 0) {
      const prod = products[0];
      sampleLogs.push({
        actorId: admin._id.toString(),
        actorType: 'admin',
        actorRole: 'admin',
        actorName: admin.name,
        actorEmail: admin.email,
        action: 'UPDATE',
        actionLabel: 'Update',
        module: 'PRODUCTS',
        moduleLabel: 'Products',
        entityType: 'Product',
        entityId: prod._id.toString(),
        entityTitle: prod.name,
        description: `Admin updated catalog pricing and inventory specifications for product "${prod.name}".`,
        result: 'success',
        requestMethod: 'PATCH',
        requestPath: `/api/admin/products/${prod._id}`,
        ipAddress: '192.168.1.104',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
        changedFields: ['price', 'stockQuantity', 'inStock'],
        createdAt: minutesAgo(58),
        metadata: { productName: prod.name, stockQuantity: prod.stockQuantity || 45, inStock: true },
      });
    }

    if (orders.length > 0) {
      const ord = orders[0];
      sampleLogs.push({
        actorId: admin._id.toString(),
        actorType: 'admin',
        actorRole: 'admin',
        actorName: admin.name,
        actorEmail: admin.email,
        action: 'STATUS_CHANGE',
        actionLabel: 'Status Change',
        module: 'ORDERS',
        moduleLabel: 'Orders',
        entityType: 'Order',
        entityId: ord._id.toString(),
        entityTitle: ord.orderNumber || 'Order #PLX-1002',
        description: `Admin updated fulfillment lifecycle of order ${ord.orderNumber || '#PLX-1002'} to "Shipped".`,
        result: 'success',
        requestMethod: 'PATCH',
        requestPath: `/api/admin/orders/${ord._id}/status`,
        ipAddress: '192.168.1.104',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
        changedFields: ['orderStatus', 'courierName', 'trackingNumber'],
        createdAt: hoursAgo(2),
        metadata: { previousStatus: 'processing', newStatus: 'shipped', courier: 'BlueDart Express' },
      });
    }

    // Failed login security attempt
    sampleLogs.push({
      actorId: null,
      actorType: 'anonymous',
      actorRole: 'unauthenticated',
      actorName: 'Unrecognized Actor',
      actorEmail: 'guest-attempt@mail-scanner.com',
      action: 'FAILED_LOGIN',
      actionLabel: 'Failed Login',
      module: 'AUTHENTICATION',
      moduleLabel: 'Authentication',
      entityType: 'Session',
      entityId: '',
      entityTitle: 'Admin Portal Login',
      description: 'Unauthorized administrative login attempt detected with invalid security credentials.',
      result: 'failure',
      failureReason: 'Invalid authentication credentials provided',
      requestMethod: 'POST',
      requestPath: '/api/admin/auth/login',
      ipAddress: '45.133.1.20',
      userAgent: 'Python-urllib/3.10',
      changedFields: [],
      createdAt: hoursAgo(3),
      metadata: { targetRoute: '/admin/login', blockedByRateLimit: false },
    });

    // Customer Activity
    if (users.length > 0) {
      const u1 = users[0];
      sampleLogs.push({
        actorId: u1._id.toString(),
        actorType: 'customer',
        actorRole: 'customer',
        actorName: u1.name,
        actorEmail: u1.email,
        action: 'LOGIN',
        actionLabel: 'Login',
        module: 'AUTHENTICATION',
        moduleLabel: 'Authentication',
        entityType: 'User',
        entityId: u1._id.toString(),
        entityTitle: u1.name,
        description: `Customer ${u1.name} signed into storefront via responsive web client.`,
        result: 'success',
        requestMethod: 'POST',
        requestPath: '/api/auth/login',
        ipAddress: '103.212.144.18',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        changedFields: ['lastLogin'],
        createdAt: hoursAgo(4),
        metadata: { platform: 'Mobile Safari', customerId: u1._id.toString() },
      });

      sampleLogs.push({
        actorId: u1._id.toString(),
        actorType: 'customer',
        actorRole: 'customer',
        actorName: u1.name,
        actorEmail: u1.email,
        action: 'PURCHASE',
        actionLabel: 'Purchase',
        module: 'ORDERS',
        moduleLabel: 'Orders',
        entityType: 'Order',
        entityId: orders[0]?._id?.toString() || '672000000000000000000099',
        entityTitle: orders[0]?.orderNumber || 'Order #PLX-1004',
        description: `Customer ${u1.name} placed a checkout order with verified online payment.`,
        result: 'success',
        requestMethod: 'POST',
        requestPath: '/api/orders',
        ipAddress: '103.212.144.18',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
        changedFields: ['paymentStatus', 'orderStatus'],
        createdAt: hoursAgo(5),
        metadata: { itemsCount: 2, currency: 'INR' },
      });
    }

    // Historical admin events across past days
    sampleLogs.push({
      actorId: admin._id.toString(),
      actorType: 'admin',
      actorRole: 'admin',
      actorName: admin.name,
      actorEmail: admin.email,
      action: 'CREATE',
      actionLabel: 'Create',
      module: 'PROMOTIONS',
      moduleLabel: 'Promotions',
      entityType: 'Promotion',
      entityId: 'promo_diwali25',
      entityTitle: 'FESTIVE25 Promo Code',
      description: 'Admin published promotional discount campaign code "FESTIVE25" with 25% off.',
      result: 'success',
      requestMethod: 'POST',
      requestPath: '/api/admin/promotions',
      ipAddress: '192.168.1.104',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
      changedFields: ['code', 'discountType', 'discountValue', 'isActive'],
      createdAt: daysAgo(1, 4),
      metadata: { promoCode: 'FESTIVE25', discountType: 'percentage', discountValue: 25 },
    });

    sampleLogs.push({
      actorId: admin._id.toString(),
      actorType: 'admin',
      actorRole: 'admin',
      actorName: admin.name,
      actorEmail: admin.email,
      action: 'CREATE',
      actionLabel: 'Create',
      module: 'CATEGORIES',
      moduleLabel: 'Categories',
      entityType: 'Category',
      entityId: 'cat_wireless_audio',
      entityTitle: 'Wireless Audio Collection',
      description: 'Admin registered catalog taxonomy category "Wireless Audio" with curated banner imagery.',
      result: 'success',
      requestMethod: 'POST',
      requestPath: '/api/admin/categories',
      ipAddress: '192.168.1.104',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
      changedFields: ['name', 'slug', 'imageUrl'],
      createdAt: daysAgo(2, 6),
      metadata: { categoryName: 'Wireless Audio', slug: 'wireless-audio' },
    });

    sampleLogs.push({
      actorId: admin._id.toString(),
      actorType: 'admin',
      actorRole: 'admin',
      actorName: admin.name,
      actorEmail: admin.email,
      action: 'UPDATE',
      actionLabel: 'Update',
      module: 'CUSTOMERS',
      moduleLabel: 'Customers',
      entityType: 'User',
      entityId: users[1]?._id?.toString() || '672000000000000000000002',
      entityTitle: users[1]?.name || 'Liam YD User',
      description: `Admin updated customer verification tier and profile status for "${users[1]?.name || 'Liam YD User'}".`,
      result: 'success',
      requestMethod: 'PATCH',
      requestPath: `/api/admin/users/${users[1]?._id || 'sample'}/status`,
      ipAddress: '192.168.1.104',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
      changedFields: ['verificationStatus', 'updatedAt'],
      createdAt: daysAgo(3, 2),
      metadata: { status: 'Active', verified: true },
    });

    sampleLogs.push({
      actorId: admin._id.toString(),
      actorType: 'admin',
      actorRole: 'admin',
      actorName: admin.name,
      actorEmail: admin.email,
      action: 'DELETE',
      actionLabel: 'Delete',
      module: 'PRODUCTS',
      moduleLabel: 'Products',
      entityType: 'Product',
      entityId: 'prod_archived_legacy_01',
      entityTitle: 'Legacy Headset Prototype v1',
      description: 'Admin archived deprecated SKU catalog item "Legacy Headset Prototype v1".',
      result: 'success',
      requestMethod: 'DELETE',
      requestPath: '/api/admin/products/prod_archived_legacy_01',
      ipAddress: '192.168.1.104',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
      changedFields: ['isDeleted', 'deletedAt', 'deletedReason'],
      createdAt: daysAgo(4, 8),
      metadata: { reason: 'Discontinued product line replacement' },
    });

    await AuditLog.insertMany(sampleLogs);
    console.log(`[AuditLog Seeder]: Successfully initialized ${sampleLogs.length} audit entries.`);
  } catch (err) {
    console.error('[AuditLog Seeder Error]:', err.message);
  }
}

