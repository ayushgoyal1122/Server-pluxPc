import express from 'express';
import mongoose from 'mongoose';
import { Cart } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { PlatformFeeSettings } from '../models/PlatformFeeSettings.js';
import { calculatePlatformFee } from '../utils/platformFeeCalculator.js';
import { requireCustomer } from '../middleware/customerAuth.js';

const router = express.Router();

// Enforce customer authentication on all cart routes
router.use(requireCustomer);

// Helper to find a product by either MongoDB ObjectId, custom id string, or slug
async function resolveProduct(identifier) {
  if (!identifier) return null;
  const str = String(identifier).trim();

  // Try MongoDB ObjectId
  if (mongoose.Types.ObjectId.isValid(str)) {
    const byId = await Product.findOne({ _id: str, isDeleted: { $ne: true } });
    if (byId) return byId;
  }

  // Try custom id string
  const byCustomId = await Product.findOne({ id: str, isDeleted: { $ne: true } });
  if (byCustomId) return byCustomId;

  // Try slug
  const bySlug = await Product.findOne({ slug: str, isDeleted: { $ne: true } });
  if (bySlug) return bySlug;

  // Fallback map for static mock IDs (e.g. p1 -> voltix-airpods-pro-181)
  const mockSlugMap = {
    p1: 'voltix-airpods-pro-181',
    p2: 'voltix-rockerz-110',
    p3: 'voltix-nirvana-ion-anc',
    p4: 'voltix-powerbank-20k',
    p5: 'voltix-stone-180',
    p6: 'voltix-watch-flash',
    p7: 'voltix-cinehead-f1',
    p8: 'voltix-airdopes-161',
    p9: 'voltix-airpods-pro-2',
    p10: 'voltix-headphone-450',
    p11: 'voltix-watch-wave',
    p12: 'voltix-speaker-rugby',
    p13: 'voltix-soundbar-100',
    p14: 'voltix-dashcam-4k',
    p15: 'voltix-trimmer-pro',
    p16: 'voltix-powerbank-10k',
    p17: 'voltix-cinehead-4k',
    p18: 'voltix-watch-storm',
    p19: 'voltix-airpods-131',
    p20: 'voltix-headphone-700',
    p21: 'voltix-party-speaker',
    p22: 'voltix-soundbar-500',
    p23: 'voltix-dashcam-dual',
    p24: 'voltix-trimmer-lite',
    p25: 'voltix-powerbank-30k',
    p26: 'voltix-cinehead-max',
  };
  if (mockSlugMap[str]) {
    const byMockSlug = await Product.findOne({ slug: mockSlugMap[str], isDeleted: { $ne: true } });
    if (byMockSlug) return byMockSlug;
  }

  return null;
}

// Helper to format cart with verified database product prices and totals
async function formatCartResponse(cart) {
  if (!cart) {
    return {
      items: [],
      itemCount: 0,
      subtotal: 0,
      shippingFee: 0,
      total: 0,
    };
  }

  // Populate product details
  await cart.populate({
    path: 'items.product',
    select: 'id name slug price originalPrice imageUrl category categoryLabel inStock stockQuantity isDeleted',
  });

  // Filter out items where product no longer exists or is archived/deleted
  const validItems = cart.items.filter((item) => item.product != null && !item.product.isDeleted);
  if (validItems.length !== cart.items.length) {
    cart.items = validItems;
    await cart.save();
  }

  let subtotal = 0;
  let itemCount = 0;

  const formattedItems = validItems.map((item) => {
    const p = item.product;
    const qty = Math.max(1, item.quantity);
    const itemSubtotal = p.price * qty;

    subtotal += itemSubtotal;
    itemCount += qty;

    return {
      product: {
        id: p._id.toString(),
        customId: p.id || p._id.toString(),
        name: p.name,
        slug: p.slug,
        price: p.price,
        originalPrice: p.originalPrice,
        imageUrl: p.imageUrl,
        category: p.category,
        categoryLabel: p.categoryLabel || p.category,
        inStock: p.inStock,
        stockQuantity: p.stockQuantity ?? 50,
      },
      quantity: qty,
      subtotal: itemSubtotal,
    };
  });

  const feeSettings = await PlatformFeeSettings.getOrCreate();
  const platformFee = calculatePlatformFee(subtotal, feeSettings);
  const total = Math.max(0, Math.round((subtotal + platformFee) * 100) / 100);

  return {
    items: formattedItems,
    itemCount,
    subtotal,
    platformFee,
    platformFeeSettings: {
      enabled: feeSettings.enabled,
      feeType: feeSettings.feeType,
      feeValue: feeSettings.feeValue,
    },
    shippingFee: 0, // Free standard delivery
    total,
  };
}

// ── GET /api/cart ──
router.get('/', async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    const formatted = await formatCartResponse(cart);
    res.json({
      success: true,
      cart: formatted,
    });
  } catch (err) {
    console.error('[Get Cart Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve shopping cart',
    });
  }
});

// ── POST /api/cart/items ──
router.post('/items', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer',
      });
    }

    // Resolve product from DB
    const product = await resolveProduct(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (!product.inStock) {
      return res.status(400).json({
        success: false,
        message: `"${product.name}" is currently out of stock`,
      });
    }

    const availableStock = product.stockQuantity ?? 50;

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Check if item already in cart
    const existingIndex = cart.items.findIndex(
      (item) => item.product.toString() === product._id.toString()
    );

    if (existingIndex > -1) {
      const newQty = cart.items[existingIndex].quantity + parsedQty;
      if (newQty > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Available stock for "${product.name}" is ${availableStock} units (you already have ${cart.items[existingIndex].quantity} in cart).`,
        });
      }
      cart.items[existingIndex].quantity = newQty;
    } else {
      if (parsedQty > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Requested quantity exceeds available stock of ${availableStock} units`,
        });
      }
      cart.items.push({
        product: product._id,
        quantity: parsedQty,
      });
    }

    await cart.save();
    const formatted = await formatCartResponse(cart);

    res.status(200).json({
      success: true,
      message: `"${product.name}" added to cart`,
      cart: formatted,
    });
  } catch (err) {
    console.error('[Add to Cart Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart',
    });
  }
});

// ── PATCH /api/cart/items/:productId ──
router.patch('/items/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty)) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a valid number',
      });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    const product = await resolveProduct(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === product._id.toString()
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in your cart',
      });
    }

    if (parsedQty <= 0) {
      // Remove item if quantity set to 0 or less
      cart.items.splice(itemIndex, 1);
    } else {
      const availableStock = product.stockQuantity ?? 50;
      if (parsedQty > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Cannot set quantity to ${parsedQty}. Available stock is ${availableStock} units.`,
        });
      }
      cart.items[itemIndex].quantity = parsedQty;
    }

    await cart.save();
    const formatted = await formatCartResponse(cart);

    res.json({
      success: true,
      message: 'Cart updated',
      cart: formatted,
    });
  } catch (err) {
    console.error('[Update Cart Item Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update item quantity',
    });
  }
});

// ── DELETE /api/cart/items/:productId ──
router.delete('/items/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    const product = await resolveProduct(productId);
    if (product) {
      cart.items = cart.items.filter(
        (item) => item.product.toString() !== product._id.toString()
      );
    } else {
      // Direct string ID filter fallback
      cart.items = cart.items.filter(
        (item) => item.product.toString() !== productId
      );
    }

    await cart.save();
    const formatted = await formatCartResponse(cart);

    res.json({
      success: true,
      message: 'Item removed from cart',
      cart: formatted,
    });
  } catch (err) {
    console.error('[Remove Cart Item Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart',
    });
  }
});

// ── DELETE /api/cart ──
router.delete('/', async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    res.json({
      success: true,
      message: 'Cart cleared',
      cart: {
        items: [],
        itemCount: 0,
        subtotal: 0,
        shippingFee: 0,
        total: 0,
      },
    });
  } catch (err) {
    console.error('[Clear Cart Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart',
    });
  }
});

export default router;

