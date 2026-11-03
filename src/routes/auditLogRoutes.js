import express from 'express';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Enforce admin authorization for all audit log endpoints
router.use(requireAdmin);

/**
 * GET /api/admin/audit-logs/stats
 * Aggregate dashboard metrics for Audit Logs header cards and tab pill counters.
 */
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalLogs,
      todayActivity,
      adminActions,
      customerActivity,
      failedActions,
      authCount,
      productsCount,
      ordersCount,
      settingsCount,
    ] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ createdAt: { $gte: startOfToday } }),
      AuditLog.countDocuments({ actorRole: 'admin' }),
      AuditLog.countDocuments({ actorRole: 'customer' }),
      AuditLog.countDocuments({ result: 'failure' }),
      AuditLog.countDocuments({ module: 'AUTHENTICATION' }),
      AuditLog.countDocuments({ module: { $in: ['PRODUCTS', 'CATEGORIES', 'SUBCATEGORIES'] } }),
      AuditLog.countDocuments({ module: { $in: ['ORDERS', 'PAYMENTS', 'EARNINGS'] } }),
      AuditLog.countDocuments({ module: { $in: ['PLATFORM_FEE', 'PROMOTIONS', 'SYSTEM'] } }),
    ]);

    res.json({
      success: true,
      stats: {
        totalLogs,
        todayActivity,
        adminActions,
        customerActivity,
        failedActions,
        tabs: {
          all: totalLogs,
          admin: adminActions,
          customer: customerActivity,
          auth: authCount,
          products: productsCount,
          orders: ordersCount,
          settings: settingsCount,
          failed: failedActions,
        },
      },
    });
  } catch (err) {
    console.error('[AuditLog Stats Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve audit log metrics' });
  }
});

/**
 * GET /api/admin/audit-logs
 * Filtered, searchable, paginated list of audit records.
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      q = '',
      module: selectedModule = '',
      action: selectedAction = '',
      role: selectedRole = '',
      startDate = '',
      endDate = '',
      tab = 'all',
    } = req.query;

    const filter = {};

    // Tab filter presets matching reference navigation pills
    if (tab === 'admin') {
      filter.actorRole = 'admin';
    } else if (tab === 'customer') {
      filter.actorRole = 'customer';
    } else if (tab === 'auth') {
      filter.module = 'AUTHENTICATION';
    } else if (tab === 'products') {
      filter.module = { $in: ['PRODUCTS', 'CATEGORIES', 'SUBCATEGORIES'] };
    } else if (tab === 'orders') {
      filter.module = { $in: ['ORDERS', 'PAYMENTS', 'EARNINGS'] };
    } else if (tab === 'settings') {
      filter.module = { $in: ['PLATFORM_FEE', 'PROMOTIONS', 'SYSTEM'] };
    } else if (tab === 'failed') {
      filter.result = 'failure';
    }

    // Role filter
    if (selectedRole && selectedRole !== 'all') {
      filter.actorRole = selectedRole.toLowerCase().trim();
    }

    // Module filter
    if (selectedModule && selectedModule !== 'all') {
      filter.module = selectedModule.toUpperCase().trim();
    }

    // Action filter
    if (selectedAction && selectedAction !== 'all') {
      filter.action = selectedAction.toUpperCase().trim();
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Keyword Search
    if (q && q.trim()) {
      const searchRegex = new RegExp(q.trim(), 'i');
      filter.$or = [
        { actorName: searchRegex },
        { actorEmail: searchRegex },
        { description: searchRegex },
        { entityTitle: searchRegex },
        { entityId: searchRegex },
        { ipAddress: searchRegex },
        { action: searchRegex },
        { module: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [logs, totalCount] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    // Format logs with safe client IDs and friendly dates
    const formattedLogs = logs.map((log) => ({
      id: log._id.toString(),
      actorId: log.actorId,
      actorType: log.actorType,
      actorRole: log.actorRole,
      actorName: log.actorName,
      actorEmail: log.actorEmail,
      action: log.action,
      actionLabel: log.actionLabel || log.action,
      module: log.module,
      moduleLabel: log.moduleLabel || log.module,
      entityType: log.entityType,
      entityId: log.entityId,
      entityTitle: log.entityTitle,
      description: log.description,
      result: log.result,
      failureReason: log.failureReason,
      changedFields: log.changedFields || [],
      requestMethod: log.requestMethod,
      requestPath: log.requestPath,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata || {},
      createdAt: log.createdAt,
    }));

    res.json({
      success: true,
      logs: formattedLogs,
      totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
    });
  } catch (err) {
    console.error('[AuditLog List Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve audit records' });
  }
});

/**
 * GET /api/admin/audit-logs/:id
 * Retrieve comprehensive details for a single audit entry.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid audit log identifier' });
    }

    const log = await AuditLog.findById(id).lean();
    if (!log) {
      return res.status(404).json({ success: false, message: 'Audit log record not found' });
    }

    log.id = log._id.toString();
    res.json({ success: true, log });
  } catch (err) {
    console.error('[AuditLog Details Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve audit log details' });
  }
});

export default router;

