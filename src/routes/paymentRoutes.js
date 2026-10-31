import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { Order } from '../models/Order.js';
import { Cart } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { Promotion } from '../models/Promotion.js';
import { PlatformFeeSettings } from '../models/PlatformFeeSettings.js';
import { requireCustomer } from '../middleware/customerAuth.js';
import {
  calculateItemDiscount,
  getBestPromotionForProduct,
  evaluateCartPromotion,
} from '../utils/discountCalculator.js';
import { calculatePlatformFee } from '../utils/platformFeeCalculator.js';

const router = express.Router();

function getKeyId() {
  return (process.env.RAZORPAY_KEY_ID || '').trim().replace(/^["']|["']$/g, '');
}

function getKeySecret() {
  return (process.env.RAZORPAY_KEY_SECRET || '').trim().replace(/^["']|["']$/g, '');
}

/**
 * Returns an instance of the Razorpay SDK if valid credentials are configured.
 */
function getRazorpayInstance() {
  const keyId = getKeyId();
  const keySecret = getKeySecret();

  if (!keyId || !keySecret || keyId === 'rzp_test_placeholder' || keySecret === 'rzp_secret_placeholder') {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

/**
 * Public endpoint to fetch the Razorpay Key ID for frontend Checkout.js.
 * Secret keys are NEVER exposed.
 */
router.get('/config', (req, res) => {
  const keyId = getKeyId();
  res.json({
    success: true,
    keyId: keyId === 'rzp_test_placeholder' ? '' : keyId,
    currency: 'INR',
  });
});

/**
 * POST /api/payments/create-order
 * Authenticated customer creates an internal Order and corresponding Razorpay Order.
 */
router.post('/create-order', requireCustomer, async (req, res) => {
  try {
    const { deliveryAddress, promoCode } = req.body;

    // Validate delivery address
    if (!deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address is required for checkout.',
      });
    }

    const { fullName, phone, street, city, state, postalCode } = deliveryAddress;
    if (!fullName || !phone || !street || !city || !state || !postalCode) {
      return res.status(400).json({
        success: false,
        message: 'All address fields (Full Name, Phone, Street, City, State, PIN) are required.',
      });
    }

    // Clean phone and postal code
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit mobile number.',
      });
    }

    // Fetch customer's actual cart from MongoDB
    const cart = await Cart.findOne({ user: req.user._id }).populate({
      path: 'items.product',
      select: 'name slug price imageUrl inStock stockQuantity isDeleted',
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty. Please add products before checking out.',
      });
    }

    // Fetch all currently active non-deleted promotions
    const now = new Date();
    const activePromotions = await Promotion.find({
      isActive: true,
      isDeleted: { $ne: true },
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    }).lean();

    // Authoritative calculation and inventory verification
    let rawSubtotal = 0;
    let itemDiscountsTotal = 0;
    const orderItems = [];

    for (const item of cart.items) {
      if (!item.product || item.product.isDeleted) {
        return res.status(400).json({
          success: false,
          message: 'One of the products in your cart is no longer available.',
        });
      }

      const product = item.product;
      const quantity = Math.max(1, parseInt(item.quantity, 10));

      // Stock check
      if (product.inStock === false || (product.stockQuantity !== undefined && product.stockQuantity < quantity)) {
        return res.status(400).json({
          success: false,
          message: `Product "${product.name}" has insufficient stock (${product.stockQuantity || 0} available).`,
        });
      }

      const catalogPrice = product.price;
      const lineRawTotal = catalogPrice * quantity;
      rawSubtotal += lineRawTotal;

      // Check for automatic product-level promotion
      const bestPromo = getBestPromotionForProduct(product._id, catalogPrice, activePromotions);
      let unitPrice = catalogPrice;
      let unitDiscount = 0;
      let appliedPromoCode = '';
      let discountType = null;
      let discountValue = 0;

      if (bestPromo) {
        const calc = calculateItemDiscount(
          catalogPrice,
          bestPromo.discountType,
          bestPromo.discountValue,
          bestPromo.maxDiscountAmount
        );
        unitPrice = calc.discountedPrice;
        unitDiscount = calc.discount;
        appliedPromoCode = bestPromo.code;
        discountType = bestPromo.discountType;
        discountValue = bestPromo.discountValue;
      }

      const lineFinalSubtotal = unitPrice * quantity;
      itemDiscountsTotal += unitDiscount * quantity;

      orderItems.push({
        product: product._id,
        name: product.name,
        slug: product.slug,
        imageUrl: product.imageUrl,
        price: unitPrice,
        originalPrice: catalogPrice,
        discount: unitDiscount,
        discountType,
        discountValue,
        promoCode: appliedPromoCode,
        quantity,
        subtotal: lineFinalSubtotal,
      });
    }

    if (rawSubtotal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order total calculated.',
      });
    }

    // Check optional checkout promo code (coupon)
    let checkoutDiscount = 0;
    let appliedCheckoutPromo = null;

    if (promoCode && typeof promoCode === 'string' && promoCode.trim()) {
      const cleanCode = promoCode.trim().toUpperCase();
      const promo = await Promotion.findOne({ code: cleanCode, isDeleted: { $ne: true } });

      if (!promo) {
        return res.status(400).json({
          success: false,
          message: `Promo code "${cleanCode}" is invalid.`,
        });
      }

      // Check if this promo code was already applied as an automatic product promotion
      const alreadyAppliedOnItems = orderItems.some((item) => item.promoCode === cleanCode);
      if (alreadyAppliedOnItems) {
        return res.status(400).json({
          success: false,
          message: `Promo code "${cleanCode}" has already been applied directly to items in your cart.`,
        });
      }

      // Check non-discounted items for coupon eligibility
      const unDiscountedItems = orderItems
        .filter((item) => !item.promoCode)
        .map((item) => ({
          product: { _id: item.product, price: item.originalPrice || item.price, name: item.name },
          quantity: item.quantity,
        }));

      const evalItems = unDiscountedItems.length > 0 ? unDiscountedItems : orderItems.map((item) => ({
        product: { _id: item.product, price: item.price, name: item.name },
        quantity: item.quantity,
      }));

      const evalResult = evaluateCartPromotion(promo, evalItems, req.user._id, now);
      if (!evalResult.valid) {
        return res.status(400).json({
          success: false,
          message: evalResult.reason || `Promo code "${cleanCode}" could not be applied.`,
        });
      }

      checkoutDiscount = evalResult.discountAmount;
      appliedCheckoutPromo = promo;
    }

    const totalDiscount = Math.round((itemDiscountsTotal + checkoutDiscount) * 100) / 100;
    const shippingFee = 0; // Free standard shipping per VOLTIX policy
    const eligibleSubtotal = Math.max(0, Math.round((rawSubtotal - totalDiscount) * 100) / 100);

    // Fetch active platform fee settings and calculate authoritative platform fee
    const feeSettings = await PlatformFeeSettings.getOrCreate();
    const platformFee = calculatePlatformFee(eligibleSubtotal, feeSettings);

    const grandTotal = Math.max(0, Math.round((eligibleSubtotal + shippingFee + platformFee) * 100) / 100);
    const amountInPaise = Math.round(grandTotal * 100);

    // Human-readable internal order number
    const orderNumber = `VO-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create or find internal order in MongoDB
    const internalOrder = new Order({
      orderNumber,
      customer: req.user._id,
      items: orderItems,
      subtotalBeforeDiscount: rawSubtotal,
      subtotal: rawSubtotal - itemDiscountsTotal,
      discount: totalDiscount,
      shippingFee,
      platformFee,
      platformFeeType: feeSettings.enabled ? feeSettings.feeType : null,
      platformFeeValue: feeSettings.enabled ? feeSettings.feeValue : 0,
      platformFeeEnabledAtPurchase: Boolean(feeSettings.enabled),
      total: grandTotal,
      promoCode: appliedCheckoutPromo ? appliedCheckoutPromo.code : (orderItems.find((i) => i.promoCode)?.promoCode || ''),
      promotion: appliedCheckoutPromo ? appliedCheckoutPromo._id : null,
      currency: 'INR',
      deliveryAddress: {
        fullName: fullName.trim(),
        phone: cleanPhone,
        street: street.trim(),
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        country: 'India',
      },
      paymentStatus: 'pending',
      orderStatus: 'placed',
      paymentMethod: 'razorpay',
      trackingHistory: [
        {
          status: 'placed',
          timestamp: new Date(),
          description: 'Order placed by customer. Awaiting payment authorization.',
          actor: 'customer',
        },
      ],
    });

    const rzp = getRazorpayInstance();
    let rzpOrderId = `rzp_ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (rzp) {
      try {
        const rzpResponse = await rzp.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: orderNumber,
          notes: {
            internalOrderId: internalOrder._id.toString(),
            customerId: req.user._id.toString(),
            customerEmail: req.user.email,
          },
        });
        rzpOrderId = rzpResponse.id;
      } catch (rzpErr) {
        console.error('[Razorpay Order Creation Error]:', rzpErr);
        return res.status(502).json({
          success: false,
          message: rzpErr.error?.description || 'Failed to initiate transaction with Razorpay. Please verify credentials.',
        });
      }
    }

    internalOrder.razorpayOrderId = rzpOrderId;
    await internalOrder.save();

    res.status(201).json({
      success: true,
      orderId: internalOrder._id,
      orderNumber: internalOrder.orderNumber,
      razorpayOrderId: rzpOrderId,
      amount: amountInPaise,
      currency: 'INR',
      keyId: getKeyId(),
      customer: {
        name: req.user.name,
        email: req.user.email,
        phone: cleanPhone,
      },
    });
  } catch (err) {
    console.error('[Create Order Error]:', err);
    res.status(500).json({
      success: false,
      message: 'An error occurred while creating your order. Please try again.',
    });
  }
});

/**
 * POST /api/payments/verify
 * Authenticated customer submits Razorpay Checkout signature for server-side verification.
 */
router.post('/verify', requireCustomer, async (req, res) => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification parameters.',
      });
    }

    // Find internal order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    // Verify order ownership
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to verify this order.',
      });
    }

    // Verify Razorpay Order ID matches
    if (order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay order ID mismatch.',
      });
    }

    // Idempotency: if already paid, return existing success state
    if (order.paymentStatus === 'paid') {
      return res.json({
        success: true,
        message: 'Payment has already been verified and processed.',
        order,
      });
    }

    // Authoritative Signature Verification using HMAC-SHA256
    const keySecret = getKeySecret();
    if (!keySecret) {
      return res.status(500).json({
        success: false,
        message: 'Payment gateway configuration error on server.',
      });
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      order.paymentStatus = 'failed';
      order.failedAt = new Date();
      order.failureReason = 'Payment signature verification failed';
      await order.save();

      return res.status(400).json({
        success: false,
        message: 'Payment signature verification failed. Untrusted response.',
      });
    }

    // Signature verified! Mark order as paid and confirmed
    order.paymentStatus = 'paid';
    order.orderStatus = 'confirmed';
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    order.paidAt = new Date();
    if (!Array.isArray(order.trackingHistory)) {
      order.trackingHistory = [];
    }
    const hasConfirmedEvent = order.trackingHistory.some((e) => e.status === 'confirmed');
    if (!hasConfirmedEvent) {
      order.trackingHistory.push({
        status: 'confirmed',
        timestamp: new Date(),
        description: 'Payment authorized via Razorpay. Order confirmed and sent to warehouse.',
        actor: 'system',
      });
    }
    await order.save();

    // Record promotion usage atomically if a promo code was redeemed
    if (order.promotion || order.promoCode) {
      try {
        const promoFilter = order.promotion
          ? { _id: order.promotion }
          : { code: order.promoCode.toUpperCase() };
        await Promotion.findOneAndUpdate(promoFilter, {
          $inc: { usedCount: 1 },
          $push: {
            usedBy: {
              customer: order.customer,
              orderId: order._id,
              usedAt: new Date(),
            },
          },
        });
      } catch (promoErr) {
        console.error('[Promotion Usage Tracking Error]:', promoErr);
      }
    }

    // Deduct inventory stock atomically
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stockQuantity: -item.quantity },
      });
    }

    // Clear customer's shopping cart in MongoDB
    await Cart.findOneAndUpdate({ user: req.user._id }, { $set: { items: [] } });

    res.json({
      success: true,
      message: 'Payment successfully verified and order confirmed.',
      order,
    });
  } catch (err) {
    console.error('[Payment Verification Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during payment verification.',
    });
  }
});

/**
 * POST /api/payments/webhook
 * Razorpay asynchronous webhook listener for payment.captured and payment.failed events.
 */
router.post('/webhook', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('[Webhook] Warning: RAZORPAY_WEBHOOK_SECRET is not configured.');
      return res.status(500).json({ success: false, message: 'Webhook secret not configured' });
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing webhook signature header' });
    }

    // Verify raw body HMAC
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id || payload?.order?.entity?.id;
      const paymentId = paymentEntity?.id;

      if (rzpOrderId) {
        const order = await Order.findOne({ razorpayOrderId: rzpOrderId });
        if (order && order.paymentStatus !== 'paid') {
          order.paymentStatus = 'paid';
          order.orderStatus = 'confirmed';
          order.razorpayPaymentId = paymentId || order.razorpayPaymentId;
          order.paidAt = new Date();
          if (!Array.isArray(order.trackingHistory)) {
            order.trackingHistory = [];
          }
          const hasConfirmed = order.trackingHistory.some((e) => e.status === 'confirmed');
          if (!hasConfirmed) {
            order.trackingHistory.push({
              status: 'confirmed',
              timestamp: new Date(),
              description: 'Payment captured via Razorpay webhook. Order confirmed for fulfillment.',
              actor: 'system',
            });
          }
          await order.save();

          // Deduct inventory
          for (const item of order.items) {
            await Product.findByIdAndUpdate(item.product, {
              $inc: { stockQuantity: -item.quantity },
            });
          }

          // Clear customer's cart
          await Cart.findOneAndUpdate({ user: order.customer }, { $set: { items: [] } });
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id;
      if (rzpOrderId) {
        const order = await Order.findOne({ razorpayOrderId: rzpOrderId });
        if (order && order.paymentStatus === 'pending') {
          order.paymentStatus = 'failed';
          order.failedAt = new Date();
          order.failureReason = paymentEntity?.error_description || 'Payment failed';
          order.trackingHistory.push({
            status: 'failed',
            timestamp: new Date(),
            description: `Payment attempt failed: ${order.failureReason}`,
            actor: 'system',
          });
          await order.save();
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[Webhook Processing Error]:', err);
    res.status(500).json({ success: false, message: 'Webhook processing error' });
  }
});

export default router;

