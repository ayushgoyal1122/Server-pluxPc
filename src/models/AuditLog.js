import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: String,
      default: null,
      index: true,
    },
    actorType: {
      type: String,
      enum: ['admin', 'customer', 'system', 'anonymous'],
      default: 'admin',
      index: true,
    },
    actorRole: {
      type: String,
      enum: ['admin', 'customer', 'system', 'unauthenticated'],
      default: 'admin',
      index: true,
    },
    actorName: {
      type: String,
      required: true,
      trim: true,
      default: 'System',
    },
    actorEmail: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
      // e.g. LOGIN, LOGOUT, FAILED_LOGIN, CREATE, UPDATE, DELETE, RESTORE, STATUS_CHANGE, CONFIG_UPDATE
    },
    actionLabel: {
      type: String,
      trim: true,
      default: '',
    },
    module: {
      type: String,
      required: true,
      trim: true,
      index: true,
      // e.g. AUTHENTICATION, PRODUCTS, CATEGORIES, SUBCATEGORIES, ORDERS, PLATFORM_FEE, PROMOTIONS, CUSTOMERS, SYSTEM
    },
    moduleLabel: {
      type: String,
      trim: true,
      default: '',
    },
    entityType: {
      type: String,
      trim: true,
      default: '',
    },
    entityId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    entityTitle: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    result: {
      type: String,
      enum: ['success', 'failure'],
      default: 'success',
      index: true,
    },
    failureReason: {
      type: String,
      trim: true,
      default: '',
    },
    changedFields: {
      type: [String],
      default: [],
    },
    requestMethod: {
      type: String,
      trim: true,
      default: 'GET',
    },
    requestPath: {
      type: String,
      trim: true,
      default: '',
    },
    ipAddress: {
      type: String,
      trim: true,
      default: '127.0.0.1',
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performant searching and filtering
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actorRole: 1, createdAt: -1 });
auditLogSchema.index({ result: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

