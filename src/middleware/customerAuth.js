import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export async function requireCustomer(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in as a customer.',
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
          message: 'Your session has expired. Please log in again.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid customer authorization token.',
      });
    }

    // Explicitly verify customer role (Reject admin tokens)
    if (decoded.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Customer authorization required.',
      });
    }

    // Verify customer exists in database and is not deactivated
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user || user.role !== 'customer' || user.isDeleted) {
      return res.status(401).json({
        success: false,
        message: 'Customer account not found or deactivated.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[Customer Auth Middleware Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Authentication processing error',
    });
  }
}

