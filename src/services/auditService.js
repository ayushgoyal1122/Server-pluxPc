import { AuditLog } from '../models/AuditLog.js';

/**
 * Sensitive field patterns that must NEVER be persisted in audit logs.
 */
const SENSITIVE_KEY_REGEX = /password|hash|token|secret|jwt|auth|authorization|card|cvv|signature|cookie|session/i;

/**
 * Deep sanitization function that cleanses objects of sensitive security data.
 */
export function sanitizeAuditData(data, depth = 0) {
  if (!data || depth > 4) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item, depth + 1));
  }

  const clean = {};
  for (const [key, val] of Object.entries(data)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      clean[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      clean[key] = sanitizeAuditData(val, depth + 1);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Extracts client IP from Express request.
 */
export function getClientIp(req) {
  if (!req) return '127.0.0.1';
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

/**
 * Asynchronously records an audit log entry.
 * Guaranteed never to throw or disrupt the calling route handler.
 */
export async function recordAuditLog({
  req,
  actor,
  action,
  actionLabel,
  module,
  moduleLabel,
  entityType = '',
  entityId = '',
  entityTitle = '',
  description,
  result = 'success',
  failureReason = '',
  changedFields = [],
  metadata = {},
}) {
  try {
    // Resolve actor from explicit parameter or from Express request
    let resolvedActorId = actor?.id || actor?._id?.toString() || null;
    let resolvedActorRole = actor?.role || 'admin';
    let resolvedActorType = actor?.type || (resolvedActorRole === 'customer' ? 'customer' : 'admin');
    let resolvedActorName = actor?.name || 'Administrator';
    let resolvedActorEmail = actor?.email || '';

    if (!actor && req) {
      if (req.admin) {
        resolvedActorId = req.admin._id?.toString();
        resolvedActorRole = 'admin';
        resolvedActorType = 'admin';
        resolvedActorName = req.admin.name || 'PLUXPC Admin';
        resolvedActorEmail = req.admin.email || '';
      } else if (req.user) {
        resolvedActorId = req.user._id?.toString();
        resolvedActorRole = 'customer';
        resolvedActorType = 'customer';
        resolvedActorName = req.user.name || 'Customer';
        resolvedActorEmail = req.user.email || '';
      } else {
        resolvedActorRole = 'unauthenticated';
        resolvedActorType = 'anonymous';
        resolvedActorName = 'Guest User';
      }
    }

    const ipAddress = getClientIp(req);
    const userAgent = req?.headers ? (req.headers['user-agent'] || '') : '';
    const requestMethod = req?.method || 'POST';
    const requestPath = req?.originalUrl || req?.url || '';

    const sanitizedMeta = sanitizeAuditData(metadata);

    const logEntry = new AuditLog({
      actorId: resolvedActorId,
      actorType: resolvedActorType,
      actorRole: resolvedActorRole,
      actorName: resolvedActorName,
      actorEmail: resolvedActorEmail,
      action: action.toUpperCase(),
      actionLabel: actionLabel || formatActionLabel(action),
      module: module.toUpperCase(),
      moduleLabel: moduleLabel || formatModuleLabel(module),
      entityType,
      entityId: entityId ? String(entityId) : '',
      entityTitle,
      description: description || `${resolvedActorName} performed ${action} on ${module}`,
      result: result === 'failure' ? 'failure' : 'success',
      failureReason: failureReason || '',
      changedFields: Array.isArray(changedFields) ? changedFields : [],
      requestMethod,
      requestPath,
      ipAddress,
      userAgent: userAgent.slice(0, 255),
      metadata: sanitizedMeta,
    });

    await logEntry.save();
    return logEntry;
  } catch (err) {
    console.error('[AuditService Error]: Failed to persist audit log entry:', err.message);
    return null;
  }
}

function formatActionLabel(action) {
  if (!action) return 'Action';
  const mapping = {
    LOGIN: 'Login',
    LOGOUT: 'Logout',
    FAILED_LOGIN: 'Failed Login',
    CREATE: 'Create',
    UPDATE: 'Update',
    DELETE: 'Delete',
    RESTORE: 'Restore',
    STATUS_CHANGE: 'Status Change',
    CONFIG_UPDATE: 'Config Update',
    EXPORT: 'Export',
    PURCHASE: 'Purchase',
    REGISTER: 'Register',
  };
  return mapping[action.toUpperCase()] || action;
}

function formatModuleLabel(module) {
  if (!module) return 'System';
  const mapping = {
    AUTHENTICATION: 'Authentication',
    PRODUCTS: 'Products',
    CATEGORIES: 'Categories',
    SUBCATEGORIES: 'Sub Categories',
    ORDERS: 'Orders',
    PLATFORM_FEE: 'Platform Fee',
    PROMOTIONS: 'Promotions',
    CUSTOMERS: 'Customers',
    EARNINGS: 'Earnings',
    SYSTEM: 'System Settings',
  };
  return mapping[module.toUpperCase()] || module;
}

