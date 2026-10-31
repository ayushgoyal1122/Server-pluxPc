import express from 'express';
import mongoose from 'mongoose';
import { Wishlist } from '../models/Wishlist.js';
import { Product } from '../models/Product.js';
import { requireCustomer } from '../middleware/customerAuth.js';

const router = express.Router();

// Enforce customer authentication on all wishlist routes
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

// Helper to format wishlist response
async function formatWishlistResponse(wishlist) {
  if (!wishlist) {
    return {
      items: [],
      count: 0,
    };
  }

  await wishlist.populate({
    path: 'items.product',
    select: 'id name slug price originalPrice imageUrl category categoryLabel inStock stockQuantity featureTag badge isDeleted rating reviewCount color colors',
  });

  const validItems = wishlist.items.filter((item) => item.product != null && !item.product.isDeleted);
  if (validItems.length !== wishlist.items.length) {
    wishlist.items = validItems;
    await wishlist.save();
  }

  const formattedItems = validItems.map((item) => {
    const p = item.product;
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
        featureTag: p.featureTag,
        badge: p.badge,
        rating: p.rating,
        reviewCount: p.reviewCount,
      },
      addedAt: item.addedAt,
    };
  });

  return {
    items: formattedItems,
    count: formattedItems.length,
  };
}

// ── GET /api/wishlist ──
router.get('/', async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, items: [] });
    }

    const formatted = await formatWishlistResponse(wishlist);
    res.json({
      success: true,
      wishlist: formatted,
    });
  } catch (err) {
    console.error('[Get Wishlist Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve wishlist',
    });
  }
});

// Helper to add item logic
async function addItemToWishlist(userId, productId) {
  const product = await resolveProduct(productId);
  if (!product) {
    return { error: 'Product not found', status: 404 };
  }

  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    wishlist = new Wishlist({ user: userId, items: [] });
  }

  const exists = wishlist.items.some(
    (item) => item.product.toString() === product._id.toString()
  );

  if (!exists) {
    wishlist.items.push({
      product: product._id,
      addedAt: new Date(),
    });
    await wishlist.save();
  }

  const formatted = await formatWishlistResponse(wishlist);
  return { formatted, product };
}

// ── POST /api/wishlist and POST /api/wishlist/items ──
const handleAddWishlistItem = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
      });
    }

    const result = await addItemToWishlist(req.user._id, productId);
    if (result.error) {
      return res.status(result.status).json({
        success: false,
        message: result.error,
      });
    }

    res.status(200).json({
      success: true,
      message: `"${result.product.name}" added to wishlist`,
      wishlist: result.formatted,
    });
  } catch (err) {
    console.error('[Add to Wishlist Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to wishlist',
    });
  }
};

router.post('/', handleAddWishlistItem);
router.post('/items', handleAddWishlistItem);

// ── POST /api/wishlist/merge ──
router.post('/merge', async (req, res) => {
  try {
    const { items = [] } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      let wishlist = await Wishlist.findOne({ user: req.user._id });
      if (!wishlist) {
        wishlist = await Wishlist.create({ user: req.user._id, items: [] });
      }
      const formatted = await formatWishlistResponse(wishlist);
      return res.json({ success: true, wishlist: formatted });
    }

    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      wishlist = new Wishlist({ user: req.user._id, items: [] });
    }

    for (const item of items) {
      const pid = typeof item === 'string' ? item : item?.productId || item?.id;
      if (!pid) continue;

      const product = await resolveProduct(pid);
      if (!product) continue;

      const exists = wishlist.items.some(
        (existing) => existing.product.toString() === product._id.toString()
      );
      if (!exists) {
        wishlist.items.push({
          product: product._id,
          addedAt: item.addedAt ? new Date(item.addedAt) : new Date(),
        });
      }
    }

    await wishlist.save();
    const formatted = await formatWishlistResponse(wishlist);
    res.json({
      success: true,
      message: 'Wishlist merged successfully',
      wishlist: formatted,
    });
  } catch (err) {
    console.error('[Merge Wishlist Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to merge wishlist',
    });
  }
});

// Helper to remove item logic
async function removeItemFromWishlist(userId, productId) {
  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    return { formatted: { items: [], count: 0 } };
  }

  const product = await resolveProduct(productId);
  if (product) {
    wishlist.items = wishlist.items.filter(
      (item) => item.product.toString() !== product._id.toString()
    );
  } else {
    wishlist.items = wishlist.items.filter(
      (item) => item.product.toString() !== productId
    );
  }

  await wishlist.save();
  const formatted = await formatWishlistResponse(wishlist);
  return { formatted };
}

// ── DELETE /api/wishlist/:productId and DELETE /api/wishlist/items/:productId ──
const handleRemoveWishlistItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await removeItemFromWishlist(req.user._id, productId);

    res.json({
      success: true,
      message: 'Item removed from wishlist',
      wishlist: result.formatted,
    });
  } catch (err) {
    console.error('[Remove Wishlist Item Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from wishlist',
    });
  }
};

router.delete('/items/:productId', handleRemoveWishlistItem);
router.delete('/:productId', handleRemoveWishlistItem);

// ── DELETE /api/wishlist (Clear all) ──
router.delete('/', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (wishlist) {
      wishlist.items = [];
      await wishlist.save();
    }

    res.json({
      success: true,
      message: 'Wishlist cleared',
      wishlist: {
        items: [],
        count: 0,
      },
    });
  } catch (err) {
    console.error('[Clear Wishlist Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to clear wishlist',
    });
  }
});

export default router;
