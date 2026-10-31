import express from 'express';
import mongoose from 'mongoose';
import { Promotion } from '../models/Promotion.js';
import { Product } from '../models/Product.js';
import { requireAdmin } from '../middleware/auth.js';
import { requireCustomer } from '../middleware/customerAuth.js';
import {
  calculateItemDiscount,
  isPromotionValid,
  evaluateCartPromotion,
} from '../utils/discountCalculator.js';

const router = express.Router();
export const adminPromotionRouter = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC / CUSTOMER ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/promotions/active
 * Returns public list of active promotions (for banners/announcements)
 */
router.get('/active', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  try {
    const now = new Date();
    const promotions = await Promotion.find({
      isActive: true,
      isDeleted: { $ne: true },
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    })
      .select('name code description discountType discountValue minPurchaseAmount appliesTo endDate')
      .lean();

    res.json({ success: true, count: promotions.length, promotions });
  } catch (err) {
    console.error('[Get Active Promotions Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to load active promotions.' });
  }
});

/**
 * POST /api/promotions/validate
 * Validates a promo code against current cart items and returns calculated discount.
 * Body: { code: string, items: Array<{ productId: string, quantity: number, price?: number }> }
 */
router.post('/validate', async (req, res) => {
  try {
    const { code, items } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter a valid promo code.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required to validate promo code.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const promo = await Promotion.findOne({ code: cleanCode });

    if (!promo || promo.isDeleted) {
      return res.status(404).json({
        success: false,
        message: `Promo code "${cleanCode}" does not exist or has been archived.`,
      });
    }

    // Load actual product prices from database (never trust client prices!)
    const productIds = items.map((i) => i.productId || i.product || i.id).filter(Boolean);
    const dbProducts = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));

    const verifiedItems = items
      .map((item) => {
        const pId = (item.productId || item.product || item.id || '').toString();
        const p = productMap.get(pId);
        if (!p) return null;
        return {
          product: p,
          quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        };
      })
      .filter(Boolean);

    // Optional customer ID from token if logged in
    let customerId = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken');
        const token = req.headers.authorization.split(' ')[1];
        const secret = process.env.JWT_SECRET || 'voltix_super_secret_jwt_key_2026_secure';
        const decoded = jwt.default.verify(token, secret);
        customerId = decoded.id;
      } catch (e) {
        // Guest customer is fine for preview
      }
    }

    const result = evaluateCartPromotion(promo, verifiedItems, customerId);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.reason || 'This promo code cannot be applied to your cart.',
      });
    }

    res.json({
      success: true,
      message: `Promo code "${promo.code}" applied! You save ₹${result.discountAmount.toLocaleString('en-IN')}`,
      evaluation: result,
    });
  } catch (err) {
    console.error('[Validate Promo Code Error]:', err);
    res.status(500).json({ success: false, message: 'An error occurred while validating the promo code.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PROTECTED ROUTES (requireAdmin)
// ─────────────────────────────────────────────────────────────────────────────

adminPromotionRouter.use(requireAdmin);

/**
 * GET /api/admin/promotions/preview
 * Calculates live preview of discounts for given product IDs, type, and value.
 * Query: { discountType, discountValue, maxDiscountAmount, productIds }
 */
adminPromotionRouter.get('/preview', async (req, res) => {
  try {
    const { discountType, discountValue, maxDiscountAmount, productIds, appliesTo } = req.query;

    const type = discountType === 'fixed' ? 'fixed' : 'percentage';
    const val = Number(discountValue) || 0;
    const maxDiscount = maxDiscountAmount ? Number(maxDiscountAmount) : null;

    let targetProducts = [];
    if (appliesTo === 'all') {
      targetProducts = await Product.find({}).limit(10).lean();
    } else if (productIds) {
      const ids = Array.isArray(productIds) ? productIds : String(productIds).split(',').filter(Boolean);
      targetProducts = await Product.find({ _id: { $in: ids } }).lean();
    }

    const preview = targetProducts.map((p) => {
      const calc = calculateItemDiscount(p.price, type, val, maxDiscount);
      return {
        id: p._id.toString(),
        name: p.name,
        price: p.price,
        discount: calc.discount,
        discountedPrice: calc.discountedPrice,
        savingsPercent: p.price > 0 ? Math.round((calc.discount / p.price) * 100) : 0,
      };
    });

    res.json({ success: true, preview });
  } catch (err) {
    console.error('[Promotion Preview Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to calculate promotion preview.' });
  }
});

/**
 * GET /api/admin/promotions
 * List all promotions with search and filters.
 */
adminPromotionRouter.get('/', async (req, res) => {
  try {
    const { q, status, discountType } = req.query;
    const filter = {};

    if (q && q.trim()) {
      const searchRegex = new RegExp(q.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { code: searchRegex }, { description: searchRegex }];
    }

    const now = new Date();
    if (status === 'archived') {
      filter.isDeleted = true;
    } else if (status === 'active') {
      filter.isDeleted = { $ne: true };
      filter.isActive = true;
      filter.startDate = { $lte: now };
      filter.$or = [{ endDate: null }, { endDate: { $gte: now } }];
    } else if (status === 'inactive') {
      filter.isDeleted = { $ne: true };
      filter.isActive = false;
    } else if (status === 'expired') {
      filter.isDeleted = { $ne: true };
      filter.endDate = { $lt: now };
    } else if (status === 'scheduled') {
      filter.isDeleted = { $ne: true };
      filter.startDate = { $gt: now };
    }

    if (discountType === 'percentage' || discountType === 'fixed') {
      filter.discountType = discountType;
    }

    const promotions = await Promotion.find(filter)
      .populate('products', 'name price slug category categoryLabel imageUrl')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = promotions.map((p) => {
      const isExpired = p.endDate ? new Date(p.endDate) < now : false;
      const isScheduled = p.startDate ? new Date(p.startDate) > now : false;
      let computedStatus = 'active';
      if (p.isDeleted) computedStatus = 'archived';
      else if (!p.isActive) computedStatus = 'inactive';
      else if (isExpired) computedStatus = 'expired';
      else if (isScheduled) computedStatus = 'scheduled';

      return {
        ...p,
        id: p._id.toString(),
        computedStatus,
        isDeleted: Boolean(p.isDeleted),
        deletedAt: p.deletedAt || null,
        deletedReason: p.deletedReason || '',
        productCount: p.appliesTo === 'all' ? 'All' : (p.products ? p.products.length : 0),
      };
    });

    res.json({ success: true, count: formatted.length, promotions: formatted });
  } catch (err) {
    console.error('[Admin Get Promotions Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to load promotions.' });
  }
});

/**
 * POST /api/admin/promotions
 * Create a new promotion.
 */
adminPromotionRouter.post('/', async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      discountType,
      discountValue,
      appliesTo,
      products,
      isActive,
      startDate,
      endDate,
      minPurchaseAmount,
      maxDiscountAmount,
      maxUsageLimit,
      perCustomerLimit,
    } = req.body;

    // 1. Required field validations
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Promotion name is required.' });
    }
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Promo code is required.' });
    }
    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ success: false, message: 'Discount type must be "percentage" or "fixed".' });
    }

    const numValue = Number(discountValue);
    if (isNaN(numValue) || numValue <= 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be greater than zero.' });
    }

    if (discountType === 'percentage' && numValue > 100) {
      return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100%.' });
    }

    // 2. Normalize and check uniqueness of code
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
    const existing = await Promotion.findOne({ code: cleanCode });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Promo code "${cleanCode}" is already in use. Please choose a different code.`,
      });
    }

    // 3. Date validation
    const parsedStart = startDate ? new Date(startDate) : new Date();
    let parsedEnd = null;
    if (endDate) {
      parsedEnd = new Date(endDate);
      if (parsedEnd <= parsedStart) {
        return res.status(400).json({
          success: false,
          message: 'End date and time must be after the start date and time.',
        });
      }
    }

    // 4. Products list
    let productIds = [];
    if (appliesTo === 'specific') {
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please select at least one product for a specific product promotion.',
        });
      }
      productIds = products.map((p) => (p._id || p).toString()).filter((id) => mongoose.Types.ObjectId.isValid(id));
    }

    // 5. Check for conflicts with existing active promotions for the same products
    if (isActive !== false && appliesTo === 'specific') {
      const now = new Date();
      const conflictingPromos = await Promotion.find({
        isActive: true,
        _id: { $ne: null },
        products: { $in: productIds },
        $or: [{ endDate: null }, { endDate: { $gte: now } }],
      }).lean();

      if (conflictingPromos.length > 0) {
        const conflictCodes = conflictingPromos.map((c) => c.code).join(', ');
        console.warn(`[Promotion Conflict] Newly created promo "${cleanCode}" overlaps with existing active promo(s): ${conflictCodes}`);
      }
    }

    const promotion = new Promotion({
      name: name.trim(),
      code: cleanCode,
      description: description ? description.trim() : '',
      discountType,
      discountValue: numValue,
      appliesTo: appliesTo === 'all' ? 'all' : 'specific',
      products: productIds,
      isActive: isActive !== false,
      startDate: parsedStart,
      endDate: parsedEnd,
      minPurchaseAmount: Math.max(0, Number(minPurchaseAmount) || 0),
      maxDiscountAmount: maxDiscountAmount ? Math.max(0, Number(maxDiscountAmount)) : null,
      maxUsageLimit: maxUsageLimit ? Math.max(1, parseInt(maxUsageLimit, 10)) : null,
      perCustomerLimit: perCustomerLimit ? Math.max(1, parseInt(perCustomerLimit, 10)) : 1,
    });

    await promotion.save();

    res.status(201).json({
      success: true,
      message: `Promotion "${promotion.name}" (${promotion.code}) created successfully.`,
      promotion,
    });
  } catch (err) {
    console.error('[Create Promotion Error]:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create promotion.' });
  }
});

/**
 * GET /api/admin/promotions/:id
 */
adminPromotionRouter.get('/:id', async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id)
      .populate('products', 'name price slug category categoryLabel imageUrl')
      .lean();

    if (!promotion) {
      return res.status(404).json({ success: false, message: 'Promotion not found.' });
    }

    promotion.id = promotion._id.toString();
    res.json({ success: true, promotion });
  } catch (err) {
    console.error('[Get Promotion By ID Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve promotion.' });
  }
});

/**
 * PUT /api/admin/promotions/:id
 * Update an existing promotion.
 */
adminPromotionRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const promotion = await Promotion.findById(id);

    if (!promotion) {
      return res.status(404).json({ success: false, message: 'Promotion not found.' });
    }

    const {
      name,
      code,
      description,
      discountType,
      discountValue,
      appliesTo,
      products,
      isActive,
      startDate,
      endDate,
      minPurchaseAmount,
      maxDiscountAmount,
      maxUsageLimit,
      perCustomerLimit,
    } = req.body;

    if (name && name.trim()) promotion.name = name.trim();
    if (description !== undefined) promotion.description = description ? description.trim() : '';

    if (code && code.trim()) {
      const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
      if (cleanCode !== promotion.code) {
        const existing = await Promotion.findOne({ code: cleanCode, _id: { $ne: id } });
        if (existing) {
          return res.status(409).json({ success: false, message: `Promo code "${cleanCode}" is already in use.` });
        }
        promotion.code = cleanCode;
      }
    }

    if (discountType) {
      if (!['percentage', 'fixed'].includes(discountType)) {
        return res.status(400).json({ success: false, message: 'Discount type must be "percentage" or "fixed".' });
      }
      promotion.discountType = discountType;
    }

    if (discountValue !== undefined) {
      const numVal = Number(discountValue);
      if (isNaN(numVal) || numVal <= 0) {
        return res.status(400).json({ success: false, message: 'Discount value must be greater than zero.' });
      }
      if (promotion.discountType === 'percentage' && numVal > 100) {
        return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100%.' });
      }
      promotion.discountValue = numVal;
    }

    if (appliesTo) {
      promotion.appliesTo = appliesTo === 'all' ? 'all' : 'specific';
    }

    if (products !== undefined) {
      if (promotion.appliesTo === 'specific') {
        const ids = Array.isArray(products)
          ? products.map((p) => (p._id || p).toString()).filter((i) => mongoose.Types.ObjectId.isValid(i))
          : [];
        promotion.products = ids;
      } else {
        promotion.products = [];
      }
    }

    if (isActive !== undefined) promotion.isActive = Boolean(isActive);

    if (startDate) promotion.startDate = new Date(startDate);
    if (endDate !== undefined) {
      promotion.endDate = endDate ? new Date(endDate) : null;
      if (promotion.endDate && promotion.startDate && promotion.endDate <= promotion.startDate) {
        return res.status(400).json({ success: false, message: 'End date must be after the start date.' });
      }
    }

    if (minPurchaseAmount !== undefined) {
      promotion.minPurchaseAmount = Math.max(0, Number(minPurchaseAmount) || 0);
    }
    if (maxDiscountAmount !== undefined) {
      promotion.maxDiscountAmount = maxDiscountAmount ? Math.max(0, Number(maxDiscountAmount)) : null;
    }
    if (maxUsageLimit !== undefined) {
      promotion.maxUsageLimit = maxUsageLimit ? Math.max(1, parseInt(maxUsageLimit, 10)) : null;
    }
    if (perCustomerLimit !== undefined) {
      promotion.perCustomerLimit = perCustomerLimit ? Math.max(1, parseInt(perCustomerLimit, 10)) : 1;
    }

    await promotion.save();

    res.json({
      success: true,
      message: `Promotion "${promotion.name}" updated successfully.`,
      promotion,
    });
  } catch (err) {
    console.error('[Update Promotion Error]:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to update promotion.' });
  }
});

/**
 * PATCH /api/admin/promotions/:id/toggle
 * Toggle active/inactive state quickly.
 */
adminPromotionRouter.patch('/:id/toggle', async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({ success: false, message: 'Promotion not found.' });
    }

    promotion.isActive = !promotion.isActive;
    await promotion.save();

    res.json({
      success: true,
      message: `Promotion "${promotion.name}" is now ${promotion.isActive ? 'Active' : 'Inactive'}.`,
      isActive: promotion.isActive,
    });
  } catch (err) {
    console.error('[Toggle Promotion Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle promotion status.' });
  }
});

/**
 * DELETE /api/admin/promotions/:id
 * Archive a promotion (Soft delete). Does NOT delete associated products or historical order records!
 */
adminPromotionRouter.delete('/:id', async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({ success: false, message: 'Promotion not found.' });
    }
    if (promotion.isDeleted) {
      return res.status(400).json({ success: false, message: 'Promotion is already archived.' });
    }

    promotion.isDeleted = true;
    promotion.deletedAt = new Date();
    promotion.deletedBy = req.admin?._id;
    promotion.deletedReason = req.body?.reason || 'Archived by administrator';
    await promotion.save();

    res.json({
      success: true,
      message: `Promotion "${promotion.name}" (${promotion.code}) was archived successfully.`,
      promotion,
    });
  } catch (err) {
    console.error('[Delete Promotion Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to archive promotion.' });
  }
});

/**
 * PATCH /api/admin/promotions/:id/restore
 * Restore an archived promotion. Preserves usage count, limits, and redemption history.
 */
adminPromotionRouter.patch('/:id/restore', async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({ success: false, message: 'Promotion not found.' });
    }
    if (!promotion.isDeleted) {
      return res.status(400).json({ success: false, message: 'Promotion is not archived.' });
    }

    promotion.isDeleted = false;
    promotion.deletedAt = null;
    promotion.deletedBy = null;
    promotion.deletedReason = '';
    // Usage counts and limits are strictly preserved
    await promotion.save();

    res.json({
      success: true,
      message: `Promotion "${promotion.name}" (${promotion.code}) was restored successfully.`,
      promotion,
    });
  } catch (err) {
    console.error('[Restore Promotion Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to restore promotion.' });
  }
});

export default router;

