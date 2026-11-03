import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { requireCustomer } from '../middleware/customerAuth.js';
import { recordAuditLog } from '../services/auditService.js';

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── POST /api/auth/register ──
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // 1. Required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    // 2. Validate email format
    const cleanEmail = email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    // 3. Password requirements
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // 4. Reject duplicate registrations
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.',
      });
    }

    // 5. Securely hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // 6. Save customer in MongoDB
    const newUser = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: 'customer',
      lastLogin: new Date(),
    });

    // 7. Issue customer JWT
    const secret = process.env.JWT_SECRET || 'voltix_super_secret_jwt_key_2026_secure';
    const expiresIn = '7d';

    const token = jwt.sign(
      {
        id: newUser._id.toString(),
        email: newUser.email,
        role: 'customer',
        name: newUser.name,
      },
      secret,
      { expiresIn }
    );

    await recordAuditLog({
      req,
      actor: { id: newUser._id, role: 'customer', type: 'customer', name: newUser.name, email: newUser.email },
      action: 'REGISTER',
      actionLabel: 'Register',
      module: 'AUTHENTICATION',
      moduleLabel: 'Authentication',
      entityType: 'User',
      entityId: newUser._id.toString(),
      entityTitle: newUser.name,
      description: `New customer account registered: ${newUser.name} (${newUser.email}).`,
      result: 'success',
      changedFields: ['name', 'email', 'role'],
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (err) {
    console.error('[Customer Register Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Registration processing error',
    });
  }
});

// ── POST /api/auth/login ──
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (user.isDeleted) {
      return res.status(403).json({
        success: false,
        message: 'Your customer account has been deactivated. Please contact support.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    user.lastLogin = new Date();
    await user.save();

    await recordAuditLog({
      req,
      actor: { id: user._id, role: 'customer', type: 'customer', name: user.name, email: user.email },
      action: 'LOGIN',
      actionLabel: 'Login',
      module: 'AUTHENTICATION',
      moduleLabel: 'Authentication',
      entityType: 'User',
      entityId: user._id.toString(),
      entityTitle: user.name,
      description: `Customer ${user.name} logged in.`,
      result: 'success',
      changedFields: ['lastLogin'],
    });

    const secret = process.env.JWT_SECRET || 'voltix_super_secret_jwt_key_2026_secure';
    const expiresIn = '7d';

    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: 'customer',
        name: user.name,
      },
      secret,
      { expiresIn }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('[Customer Login Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Authentication processing error',
    });
  }
});

// ── GET /api/auth/me ──
router.get('/me', requireCustomer, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id.toString(),
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (err) {
    console.error('[Customer Me Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile',
    });
  }
});

// ── POST /api/auth/logout ──
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// ── POST /api/auth/deactivate (Self Account Deactivation) ──
router.post('/deactivate', requireCustomer, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedReason = req.body?.reason || 'Account deactivated by customer';
    await user.save();

    res.json({
      success: true,
      message: 'Your account has been deactivated successfully. Historical order and payment records are preserved.',
    });
  } catch (err) {
    console.error('[Customer Deactivate Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to deactivate account' });
  }
});

export default router;

