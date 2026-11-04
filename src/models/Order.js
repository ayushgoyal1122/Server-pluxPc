import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Product name snapshot is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Product slug is required'],
      trim: true,
    },
    imageUrl: {
      type: String,
      required: [true, 'Product image URL is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Unit price snapshot is required'],
      min: [0, 'Price must be non-negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    subtotal: {
      type: Number,
      required: [true, 'Item subtotal is required'],
      min: [0, 'Subtotal must be non-negative'],
    },
    originalPrice: {
      type: Number,
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Item discount cannot be negative'],
    },
    discountType: {
      type: String,
      default: null,
    },
    discountValue: {
      type: Number,
      default: 0,
    },
    promoCode: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const deliveryAddressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Recipient full name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true,
    },
    country: {
      type: String,
      default: 'India',
      trim: true,
    },
  },
  { _id: false }
);

const trackingEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: [true, 'Tracking event status is required'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    actor: {
      type: String,
      enum: ['system', 'customer', 'admin'],
      default: 'system',
    },
  },
  { _id: false }
);

const shipmentSchema = new mongoose.Schema(
  {
    courierName: {
      type: String,
      default: '',
      trim: true,
    },
    trackingNumber: {
      type: String,
      default: '',
      trim: true,
    },
    trackingUrl: {
      type: String,
      default: '',
      trim: true,
    },
    estimatedDeliveryDate: {
      type: Date,
    },
    shippedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      unique: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    items: {
      type: [orderItemSchema],
      required: [true, 'Order items are required'],
      validate: [(val) => val.length > 0, 'Order must contain at least one item'],
    },
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative'],
    },
    subtotalBeforeDiscount: {
      type: Number,
    },
    promoCode: {
      type: String,
      default: '',
      trim: true,
    },
    promotion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promotion',
      default: null,
    },
    shippingFee: {
      type: Number,
      default: 0,
      min: [0, 'Shipping fee cannot be negative'],
    },
    platformFee: {
      type: Number,
      default: 0,
      min: [0, 'Platform fee cannot be negative'],
    },
    platformFeeType: {
      type: String,
      enum: ['fixed', 'percentage', null],
      default: null,
    },
    platformFeeValue: {
      type: Number,
      default: 0,
    },
    platformFeeEnabledAtPurchase: {
      type: Boolean,
      default: false,
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    total: {
      type: Number,
      required: [true, 'Grand total is required'],
      min: [0, 'Grand total cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    deliveryAddress: {
      type: deliveryAddressSchema,
      required: [true, 'Delivery address is required'],
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    orderStatus: {
      type: String,
      enum: ['placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'placed',
      index: true,
    },
    trackingHistory: {
      type: [trackingEventSchema],
      default: [],
    },
    shipment: {
      type: shipmentSchema,
      default: () => ({}),
    },
    paymentMethod: {
      type: String,
      default: 'razorpay',
    },
    razorpayOrderId: {
      type: String,
      index: true,
      sparse: true,
    },
    razorpayPaymentId: {
      type: String,
      index: true,
      sparse: true,
    },
    razorpaySignature: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
    // Email Notification Tracking & Concurrency Protection
    customerEmailStatus: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    customerEmailStartedAt: {
      type: Date,
      index: true,
    },
    customerEmailSentAt: {
      type: Date,
    },
    customerEmailError: {
      type: String,
    },
    adminEmailStatus: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    adminEmailStartedAt: {
      type: Date,
      index: true,
    },
    adminEmailSentAt: {
      type: Date,
    },
    adminEmailError: {
      type: String,
    },
    emailRetryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Order = mongoose.model('Order', orderSchema);
