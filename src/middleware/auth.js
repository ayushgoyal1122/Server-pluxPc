import jwt from 'jsonwebtoken';
import { Admin } from '../models/Admin.js';

export async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization required. Please provide a valid Bearer token.',
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'voltix_super_secret_jwt_key_2026_secure';

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please log in again.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization token.',
      });
    }

    // Verify admin role and active status in DB
    const admin = await Admin.findById(decoded.id).select('-passwordHash');
    if (!admin || admin.role !== 'admin' || admin.isDeleted) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Administrator account deactivated or not found.',
      });
    }

    req.admin = admin;
    next();
  } catch (err) {
    console.error('[Auth Middleware Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Authentication processing error',
    });
  }
}

