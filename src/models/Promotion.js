import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Promotion name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Promo code is required'],
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    discountType: {
      type: String,
      enum: {
        values: ['percentage', 'fixed'],
        message: 'Discount type must be either "percentage" or "fixed"',
      },
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0.01, 'Discount value must be greater than zero'],
      validate: {
        validator: function (val) {
          if (this.discountType === 'percentage') {
            return val > 0 && val <= 100;
          }
          return val > 0;
        },
        message: 'Percentage discount must be between 0.01% and 100%',
      },
    },
    appliesTo: {
      type: String,
      enum: ['all', 'specific'],
      default: 'specific',
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    endDate: {
      type: Date,
      default: null,
      index: true,
    },
    minPurchaseAmount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum purchase amount cannot be negative'],
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: [0, 'Maximum discount amount cannot be negative'],
    },
    maxUsageLimit: {
      type: Number,
      default: null,
      min: [1, 'Maximum usage limit must be at least 1'],
    },
    perCustomerLimit: {
      type: Number,
      default: 1,
      min: [1, 'Per-customer limit must be at least 1'],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    usedBy: [
      {
        customer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Order',
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    deletedReason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Virtual for checking if promotion is currently valid by dates & limits
promotionSchema.virtual('isCurrentlyValid').get(function () {
  const now = new Date();
  if (this.isDeleted) return false;
  if (!this.isActive) return false;
  if (this.startDate && new Date(this.startDate) > now) return false;
  if (this.endDate && new Date(this.endDate) < now) return false;
  if (this.maxUsageLimit && this.usedCount >= this.maxUsageLimit) return false;
  return true;
});

export const Promotion = mongoose.model('Promotion', promotionSchema);

