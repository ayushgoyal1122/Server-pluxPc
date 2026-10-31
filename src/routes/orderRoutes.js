import express from 'express';
import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { requireCustomer } from '../middleware/customerAuth.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();
export const adminOrderRouter = express.Router();

/**
 * Helper to generate default customer-facing description for a status
 */
function getDefaultDescription(status, shipment) {
  switch (status) {
    case 'placed':
      return 'Order placed. Awaiting payment authorization.';
    case 'confirmed':
      return 'Payment verified. Order confirmed and sent to warehouse.';
    case 'processing':
      return 'Your order is being picked and packed at the VOLTIX fulfillment center.';
    case 'shipped':
      return shipment?.courierName
        ? `Dispatched via ${shipment.courierName}. Tracking: ${shipment.trackingNumber || 'Available shortly'}`
        : 'Dispatched from fulfillment center. Handed over to delivery courier.';
    case 'out_for_delivery':
      return 'Your shipment is out for delivery with the local courier agent.';
    case 'delivered':
      return 'Order successfully delivered to destination address.';
    case 'cancelled':
      return 'Order cancelled. If payment was captured, refund is initiated.';
    default:
      return `Order status updated to ${status}.`;
  }
}

/**
 * Valid order status transitions map
 */
const ALLOWED_TRANSITIONS = {
  placed: ['confirmed', 'processing', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [], // Terminal state
  cancelled: [], // Terminal state
};

/**
 * Ensures order has trackingHistory and shipment objects, providing a trustworthy
 * fallback derived from order timestamps if trackingHistory is missing or empty.
 */
function ensureOrderTracking(order) {
  if (!order) return order;
  if (!Array.isArray(order.trackingHistory) || order.trackingHistory.length === 0) {
    const history = [
      {
        status: 'placed',
        timestamp: order.createdAt || new Date(),
        description: 'Order placed by customer.',
        location: '',
        actor: 'customer',
      },
    ];

    if (order.paymentStatus === 'paid' || order.paidAt) {
      history.push({
        status: 'confirmed',
        timestamp: order.paidAt || order.createdAt || new Date(),
        description: 'Payment authorized via Razorpay. Order confirmed.',
        location: '',
        actor: 'system',
      });
    }

    if (order.orderStatus === 'processing') {
      history.push({
        status: 'processing',
        timestamp: order.updatedAt || order.paidAt || order.createdAt || new Date(),
        description: 'Order received and processing in warehouse.',
        location: '',
        actor: 'system',
      });
    } else if (order.orderStatus === 'shipped' && order.shipment?.shippedAt) {
      history.push({
        status: 'shipped',
        timestamp: order.shipment.shippedAt,
        description: `Dispatched with ${order.shipment.courierName || 'courier'}.`,
        location: '',
        actor: 'admin',
      });
    } else if (order.orderStatus === 'out_for_delivery') {
      history.push({
        status: 'out_for_delivery',
        timestamp: order.updatedAt || new Date(),
        description: 'Out for delivery to recipient.',
        location: order.deliveryAddress?.city || '',
        actor: 'admin',
      });
    } else if (order.orderStatus === 'delivered' && order.shipment?.deliveredAt) {
      history.push({
        status: 'delivered',
        timestamp: order.shipment.deliveredAt,
        description: 'Package delivered to recipient.',
        location: order.deliveryAddress?.city || '',
        actor: 'admin',
      });
    } else if (order.orderStatus === 'cancelled') {
      history.push({
        status: 'cancelled',
        timestamp: order.updatedAt || order.createdAt || new Date(),
        description: 'Order cancelled.',
        location: '',
        actor: 'system',
      });
    }

    order.trackingHistory = history;
  }

  if (!order.shipment) {
    order.shipment = {
      courierName: '',
      trackingNumber: '',
      trackingUrl: '',
    };
  }

  return order;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER ORDER ROUTES (requireCustomer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/orders/my-orders
 * List authenticated customer's orders, newest first.
 */
router.get('/my-orders', requireCustomer, async (req, res) => {
  try {
    const rawOrders = await Order.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    const orders = rawOrders.map(ensureOrderTracking);

    res.json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (err) {
    console.error('[My Orders Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch your orders.' });
  }
});

/**
 * GET /api/orders/:orderId
 * Retrieve single order details for the authenticated customer.
 * Supports MongoDB ObjectId or orderNumber. Enforces customer ownership.
 */
router.get('/:orderId', requireCustomer, async (req, res) => {
  try {
    const { orderId } = req.params;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId).lean();
    } else {
      order = await Order.findOne({ orderNumber: orderId }).lean();
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Ownership check: Customer can only access their own orders
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied: Unauthorized.' });
    }

    order = ensureOrderTracking(order);

    res.json({
      success: true,
      order,
    });
  } catch (err) {
    console.error('[Get Order Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch order details.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ORDER MANAGEMENT ROUTES (requireAdmin)
// ─────────────────────────────────────────────────────────────────────────────

adminOrderRouter.use(requireAdmin);

/**
 * GET /api/admin/orders
 * List all orders with search, status filtering, and pagination.
 */
adminOrderRouter.get('/', async (req, res) => {
  try {
    const { q, status, paymentStatus, page = 1, limit = 20 } = req.query;

    const filter = {};

    // Filter by order fulfillment status
    if (status && status !== 'all') {
      filter.orderStatus = status;
    }

    // Filter by payment status
    if (paymentStatus && paymentStatus !== 'all') {
      filter.paymentStatus = paymentStatus;
    }

    // Search query by orderNumber, recipient name, or phone
    if (q && q.trim()) {
      const searchRegex = new RegExp(q.trim(), 'i');
      filter.$or = [
        { orderNumber: searchRegex },
        { 'deliveryAddress.fullName': searchRegex },
        { 'deliveryAddress.phone': searchRegex },
        { 'deliveryAddress.city': searchRegex },
        { razorpayPaymentId: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [rawOrders, totalCount] = await Promise.all([
      Order.find(filter)
        .populate('customer', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filter),
    ]);

    const orders = rawOrders.map(ensureOrderTracking);

    res.json({
      success: true,
      orders,
      totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (err) {
    console.error('[Admin Orders Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch orders list.' });
  }
});

/**
 * GET /api/admin/orders/:orderId
 * Retrieve specific order details for admin.
 */
adminOrderRouter.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId).populate('customer', 'name email').lean();
    } else {
      order = await Order.findOne({ orderNumber: orderId }).populate('customer', 'name email').lean();
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    order = ensureOrderTracking(order);

    res.json({
      success: true,
      order,
    });
  } catch (err) {
    console.error('[Admin Get Order Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch order details.' });
  }
});

/**
 * PATCH /api/admin/orders/:orderId/status
 * Update fulfillment status, tracking history, and courier shipment details.
 */
adminOrderRouter.patch('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const {
      status,
      description,
      location,
      courierName,
      trackingNumber,
      trackingUrl,
      estimatedDeliveryDate,
    } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Fulfillment status is required.' });
    }

    // Find order
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId);
    } else {
      order = await Order.findOne({ orderNumber: orderId });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const currentStatus = order.orderStatus;

    // Validate valid status enum
    const validStatuses = ['placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status "${status}". Allowed values: ${validStatuses.join(', ')}`,
      });
    }

    // Validate state transitions
    if (currentStatus !== status) {
      const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
      if (!allowedNext.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot transition order status from "${currentStatus}" to "${status}". Allowed: ${allowedNext.length > 0 ? allowedNext.join(', ') : 'none (terminal state)'}`,
        });
      }
    }

    // Validate tracking URL if provided
    if (trackingUrl && trackingUrl.trim()) {
      try {
        const parsed = new URL(trackingUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return res.status(400).json({
            success: false,
            message: 'Tracking URL must begin with http:// or https://',
          });
        }
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid tracking URL.',
        });
      }
    }

    // Update shipment details if provided
    if (!order.shipment) {
      order.shipment = {};
    }

    if (courierName !== undefined) order.shipment.courierName = courierName.trim();
    if (trackingNumber !== undefined) order.shipment.trackingNumber = trackingNumber.trim();
    if (trackingUrl !== undefined) order.shipment.trackingUrl = trackingUrl.trim();
    if (estimatedDeliveryDate !== undefined && estimatedDeliveryDate) {
      order.shipment.estimatedDeliveryDate = new Date(estimatedDeliveryDate);
    }

    if (status === 'shipped' && !order.shipment.shippedAt) {
      order.shipment.shippedAt = new Date();
    }
    if (status === 'delivered' && !order.shipment.deliveredAt) {
      order.shipment.deliveredAt = new Date();
    }

    // Handle cancellation: restore inventory if items were deducted
    if (status === 'cancelled' && currentStatus !== 'cancelled') {
      if (order.paymentStatus === 'paid') {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stockQuantity: item.quantity },
          });
        }
      }
    }

    // Update order status
    order.orderStatus = status;

    // Append to tracking history
    const eventDescription = description && description.trim()
      ? description.trim()
      : getDefaultDescription(status, order.shipment);

    order.trackingHistory.push({
      status,
      timestamp: new Date(),
      description: eventDescription,
      location: location ? location.trim() : '',
      actor: 'admin',
    });

    await order.save();

    res.json({
      success: true,
      message: `Order status updated to "${status}".`,
      order,
    });
  } catch (err) {
    console.error('[Update Order Status Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to update order status.' });
  }
});

export default router;
