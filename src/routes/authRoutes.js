import express from 'express';
import jwt from 'jsonwebtoken';
import { Admin } from '../models/Admin.js';
import { User } from '../models/User.js';
import { requireAdmin } from '../middleware/auth.js';
import { recordAuditLog } from '../services/auditService.js';

const router = express.Router();

// POST /api/admin/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) {
      await recordAuditLog({
        req,
        actor: { role: 'unauthenticated', type: 'anonymous', name: 'Unknown User', email },
        action: 'FAILED_LOGIN',
        actionLabel: 'Failed Login',
        module: 'AUTHENTICATION',
        moduleLabel: 'Authentication',
        entityType: 'Admin',
        entityTitle: email,
        description: `Failed administrator login attempt for email "${email}" (Account not found).`,
        result: 'failure',
        failureReason: 'Account does not exist',
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (admin.isDeleted) {
      await recordAuditLog({
        req,
        actor: { id: admin._id, role: 'admin', type: 'admin', name: admin.name, email: admin.email },
        action: 'FAILED_LOGIN',
        actionLabel: 'Failed Login',
        module: 'AUTHENTICATION',
        moduleLabel: 'Authentication',
        entityType: 'Admin',
        entityId: admin._id.toString(),
        entityTitle: admin.name,
        description: `Deactivated administrator account attempted to sign in: "${admin.email}".`,
        result: 'failure',
        failureReason: 'Account deactivated',
      });

      return res.status(403).json({
        success: false,
        message: 'Your administrator account has been deactivated.',
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      await recordAuditLog({
        req,
        actor: { id: admin._id, role: 'admin', type: 'admin', name: admin.name, email: admin.email },
        action: 'FAILED_LOGIN',
        actionLabel: 'Failed Login',
        module: 'AUTHENTICATION',
        moduleLabel: 'Authentication',
        entityType: 'Admin',
        entityId: admin._id.toString(),
        entityTitle: admin.name,
        description: `Failed login attempt for admin "${admin.name}" (${admin.email}) due to invalid password.`,
        result: 'failure',
        failureReason: 'Invalid password',
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    await recordAuditLog({
      req,
      actor: { id: admin._id, role: 'admin', type: 'admin', name: admin.name, email: admin.email },
      action: 'LOGIN',
      actionLabel: 'Login',
      module: 'AUTHENTICATION',
      moduleLabel: 'Authentication',
      entityType: 'Admin',
      entityId: admin._id.toString(),
      entityTitle: admin.name,
      description: `Administrator ${admin.name} successfully authenticated.`,
      result: 'success',
      changedFields: ['lastLogin'],
    });

    const secret = process.env.JWT_SECRET || 'voltix_super_secret_jwt_key_2026_secure';
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        name: admin.name,
      },
      secret,
      { expiresIn }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error('[Admin Login Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login',
    });
  }
});

// GET /api/admin/auth/me
router.get('/me', requireAdmin, async (req, res) => {
  res.json({
    success: true,
    admin: req.admin,
  });
});

// ── Admin Management Routes ──

// GET /api/admin/auth/admins
router.get('/admins', requireAdmin, async (req, res) => {
  try {
    const admins = await Admin.find().select('-passwordHash').sort({ createdAt: -1 }).lean();
    res.json({ success: true, count: admins.length, admins });
  } catch (err) {
    console.error('[Get Admins Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve administrators' });
  }
});

// PATCH /api/admin/auth/admins/:id/deactivate
router.patch('/admins/:id/deactivate', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const targetAdmin = await Admin.findById(id);
    if (!targetAdmin) {
      return res.status(404).json({ success: false, message: 'Administrator not found' });
    }

    // Guard: Prevent self-deactivation
    if (req.admin._id.toString() === targetAdmin._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own administrator account.',
      });
    }

    // Guard: Prevent deactivating the last active administrator
    const activeCount = await Admin.countDocuments({ isDeleted: { $ne: true } });
    if (activeCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate the only remaining active administrator account.',
      });
    }

    targetAdmin.isDeleted = true;
    targetAdmin.deletedAt = new Date();
    targetAdmin.deletedReason = req.body?.reason || 'Deactivated by administrator';
    await targetAdmin.save();

    res.json({
      success: true,
      message: `Administrator "${targetAdmin.name}" deactivated successfully`,
      admin: {
        id: targetAdmin._id,
        name: targetAdmin.name,
        email: targetAdmin.email,
        isDeleted: targetAdmin.isDeleted,
        deletedAt: targetAdmin.deletedAt,
      },
    });
  } catch (err) {
    console.error('[Deactivate Admin Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to deactivate administrator' });
  }
});

// PATCH /api/admin/auth/admins/:id/restore
router.patch('/admins/:id/restore', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const targetAdmin = await Admin.findById(id);
    if (!targetAdmin) {
      return res.status(404).json({ success: false, message: 'Administrator not found' });
    }

    targetAdmin.isDeleted = false;
    targetAdmin.deletedAt = null;
    targetAdmin.deletedReason = '';
    await targetAdmin.save();

    res.json({
      success: true,
      message: `Administrator "${targetAdmin.name}" restored successfully`,
      admin: {
        id: targetAdmin._id,
        name: targetAdmin.name,
        email: targetAdmin.email,
        isDeleted: targetAdmin.isDeleted,
      },
    });
  } catch (err) {
    console.error('[Restore Admin Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to restore administrator' });
  }
});

// ── Customer Management Routes ──

// GET /api/admin/auth/customers
router.get('/customers', requireAdmin, async (req, res) => {
  try {
    const { q, status } = req.query;
    const filter = {};

    if (status === 'active') {
      filter.isDeleted = { $ne: true };
    } else if (status === 'deactivated') {
      filter.isDeleted = true;
    }

    if (q) {
      filter.$or = [
        { name: { $regex: q.trim(), $options: 'i' } },
        { email: { $regex: q.trim(), $options: 'i' } },
      ];
    }

    const customers = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: customers.length, customers });
  } catch (err) {
    console.error('[Get Customers Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve customers' });
  }
});

// PATCH /api/admin/auth/customers/:id/deactivate
router.patch('/customers/:id/deactivate', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Customer account not found' });
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedReason = req.body?.reason || 'Deactivated by administrator';
    await user.save();

    res.json({
      success: true,
      message: `Customer "${user.name}" deactivated successfully`,
      customer: {
        id: user._id,
        name: user.name,
        email: user.email,
        isDeleted: user.isDeleted,
        deletedAt: user.deletedAt,
      },
    });
  } catch (err) {
    console.error('[Deactivate Customer Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to deactivate customer' });
  }
});

// PATCH /api/admin/auth/customers/:id/restore
router.patch('/customers/:id/restore', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Customer account not found' });
    }

    user.isDeleted = false;
    user.deletedAt = null;
    user.deletedReason = '';
    await user.save();

    res.json({
      success: true,
      message: `Customer "${user.name}" restored successfully`,
      customer: {
        id: user._id,
        name: user.name,
        email: user.email,
        isDeleted: user.isDeleted,
      },
    });
  } catch (err) {
    console.error('[Restore Customer Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to restore customer' });
  }
});

export default router;

