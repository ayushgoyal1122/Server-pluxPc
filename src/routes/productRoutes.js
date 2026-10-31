import express from 'express';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Promotion } from '../models/Promotion.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  calculateItemDiscount,
  getBestPromotionForProduct,
} from '../utils/discountCalculator.js';

const router = express.Router();

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC STOREFRONT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/products
router.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  try {
    const { category, section, q, sort, inStock } = req.query;
    const filter = {
      isDeleted: { $ne: true },
    };

    if (category) filter.category = category.toLowerCase().trim();
    if (section) filter.section = section.toLowerCase().trim();
    if (inStock === 'true') filter.inStock = true;
    if (q) {
      filter.$or = [
        { name: { $regex: q.trim(), $options: 'i' } },
        { description: { $regex: q.trim(), $options: 'i' } },
        { categoryLabel: { $regex: q.trim(), $options: 'i' } },
      ];
    }

    let query = Product.find(filter);

    if (sort === 'price-asc') query = query.sort({ price: 1 });
    else if (sort === 'price-desc') query = query.sort({ price: -1 });
    else if (sort === 'rating') query = query.sort({ rating: -1 });
    else if (sort === 'newest') query = query.sort({ createdAt: -1 });
    else query = query.sort({ createdAt: -1 });

    const products = await query.lean();

    const now = new Date();
    const activePromotions = await Promotion.find({
      isActive: true,
      isDeleted: { $ne: true },
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    }).lean();

    const formatted = products.map((p) => {
      const bestPromo = getBestPromotionForProduct(p._id, p.price, activePromotions);
      let effectivePrice = p.price;
      let effectiveOriginalPrice = p.originalPrice;
      let activePromotion = null;

      if (bestPromo) {
        const { discount, discountedPrice } = calculateItemDiscount(
          p.price,
          bestPromo.discountType,
          bestPromo.discountValue,
          bestPromo.maxDiscountAmount
        );
        effectivePrice = discountedPrice;
        effectiveOriginalPrice = p.price;
        activePromotion = {
          id: bestPromo._id.toString(),
          name: bestPromo.name,
          code: bestPromo.code,
          discountType: bestPromo.discountType,
          discountValue: bestPromo.discountValue,
          badgeText:
            bestPromo.discountType === 'percentage'
              ? `${bestPromo.discountValue}% OFF`
              : `₹${bestPromo.discountValue} OFF`,
          endDate: bestPromo.endDate,
        };
      }

      return {
        id: p._id.toString(),
        name: p.name,
        slug: p.slug,
        category: p.category,
        categoryLabel: p.categoryLabel,
        price: effectivePrice,
        basePrice: p.price,
        originalPrice: effectiveOriginalPrice,
        rating: p.rating,
        reviewCount: p.reviewCount,
        imageUrl: p.imageUrl,
        images: p.images || [],
        galleryImages: p.galleryImages || p.images || [],
        promotionalPosters: p.promotionalPosters || [],
        badge: p.badge,
        badgeIcon: p.badgeIcon,
        featureTag: p.featureTag,
        inStock: p.inStock,
        stockQuantity: p.stockQuantity,
        description: p.description,
        overview: p.overview || '',
        keyFeatures: p.keyFeatures || [],
        highlights: p.highlights || [],
        useCases: p.useCases || [],
        inTheBox: p.inTheBox || [],
        compatibility: p.compatibility || [],
        warrantyDetails: p.warrantyDetails || '',
        specs: p.specs,
        colors: p.colors,
        section: p.section,
        isNew: p.isNew,
        isTrending: p.isTrending,
        activePromotion,
      };
    });

    res.json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (err) {
    console.error('[Get Products Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve products' });
  }
});

// GET /api/products/:slugOrId
router.get('/:slugOrId', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  try {
    const { slugOrId } = req.params;
    let product;

    if (slugOrId.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findOne({ _id: slugOrId, isDeleted: { $ne: true } }).lean();
    }
    if (!product) {
      product = await Product.findOne({ slug: slugOrId, isDeleted: { $ne: true } }).lean();
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.id = product._id.toString();

    const now = new Date();
    const activePromotions = await Promotion.find({
      isActive: true,
      isDeleted: { $ne: true },
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    }).lean();

    const bestPromo = getBestPromotionForProduct(product._id, product.price, activePromotions);
    if (bestPromo) {
      const { discount, discountedPrice } = calculateItemDiscount(
        product.price,
        bestPromo.discountType,
        bestPromo.discountValue,
        bestPromo.maxDiscountAmount
      );
      product.basePrice = product.price;
      product.originalPrice = product.price;
      product.price = discountedPrice;
      product.activePromotion = {
        id: bestPromo._id.toString(),
        name: bestPromo.name,
        code: bestPromo.code,
        discountType: bestPromo.discountType,
        discountValue: bestPromo.discountValue,
        badgeText:
          bestPromo.discountType === 'percentage'
            ? `${bestPromo.discountValue}% OFF`
            : `₹${bestPromo.discountValue} OFF`,
        endDate: bestPromo.endDate,
      };
    } else {
      product.basePrice = product.price;
      product.activePromotion = null;
    }

    // Strictly ensure images and galleryImages are cleanly synchronized with zero stale fallbacks
    if (Array.isArray(product.galleryImages) && product.galleryImages.length > 0) {
      product.images = product.galleryImages;
    } else if (Array.isArray(product.images) && product.images.length > 0) {
      product.galleryImages = product.images;
    }

    res.json({ success: true, data: product });
  } catch (err) {
    console.error('[Get Product Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve product' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PROTECTED ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/products
export const adminProductRouter = express.Router();

adminProductRouter.use(requireAdmin);

adminProductRouter.get('/', async (req, res) => {
  try {
    const { q, category, inStock, status } = req.query;
    const filter = {};

    if (status === 'active') {
      filter.isDeleted = { $ne: true };
    } else if (status === 'archived') {
      filter.isDeleted = true;
    }

    if (q) {
      filter.$or = [
        { name: { $regex: q.trim(), $options: 'i' } },
        { slug: { $regex: q.trim(), $options: 'i' } },
        { categoryLabel: { $regex: q.trim(), $options: 'i' } },
      ];
    }
    if (category) filter.category = category.toLowerCase().trim();
    if (inStock === 'true') filter.inStock = true;
    if (inStock === 'false') filter.inStock = false;

    const products = await Product.find(filter).sort({ createdAt: -1 }).lean();

    const formatted = products.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      category: p.category,
      categoryLabel: p.categoryLabel,
      price: p.price,
      originalPrice: p.originalPrice,
      rating: p.rating,
      reviewCount: p.reviewCount,
      imageUrl: p.imageUrl,
      images: p.images,
      badge: p.badge,
      badgeIcon: p.badgeIcon,
      featureTag: p.featureTag,
      inStock: p.inStock,
      stockQuantity: p.stockQuantity,
      description: p.description,
      colors: p.colors,
      section: p.section,
      isNew: p.isNew,
      isTrending: p.isTrending,
      isDeleted: Boolean(p.isDeleted),
      deletedAt: p.deletedAt || null,
      deletedReason: p.deletedReason || '',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('[Admin Get Products Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve admin products' });
  }
});

// POST /api/admin/products
adminProductRouter.post('/', async (req, res) => {
  try {
    const {
      name,
      slug: customSlug,
      category,
      categoryLabel,
      price,
      originalPrice,
      rating,
      reviewCount,
      imageUrl,
      images,
      badge,
      badgeIcon,
      featureTag,
      inStock,
      stockQuantity,
      description,
      specs,
      colors,
      section,
      isNew,
      isTrending,
    } = req.body;

    if (!name || !category || price === undefined || !imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Name, category, price, and imageUrl are required fields',
      });
    }

    // Auto-generate or sanitize slug
    let finalSlug = slugify(customSlug || name);
    // Ensure slug uniqueness
    const existing = await Product.findOne({ slug: finalSlug });
    if (existing) {
      finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
    }

    // Validate category exists and is not archived
    const catDoc = await Category.findOne({
      slug: category.toLowerCase().trim(),
      isDeleted: { $ne: true },
    });
    if (!catDoc) {
      return res.status(400).json({
        success: false,
        message: `Category "${category}" is archived or does not exist. Products cannot be assigned to archived categories.`,
      });
    }

    // Resolve categoryLabel if not passed
    let finalCategoryLabel = categoryLabel || catDoc.name;

    const product = new Product({
      name: name.trim(),
      slug: finalSlug,
      category: category.toLowerCase().trim(),
      categoryLabel: finalCategoryLabel,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      rating: rating ? Number(rating) : 4.5,
      reviewCount: reviewCount ? Number(reviewCount) : 0,
      imageUrl: imageUrl.trim(),
      images: Array.isArray(images) ? images : [],
      badge: badge ? badge.trim() : '',
      badgeIcon: badgeIcon ? badgeIcon.trim() : '',
      featureTag: featureTag ? featureTag.trim() : '',
      inStock: inStock !== undefined ? Boolean(inStock) : true,
      stockQuantity: stockQuantity !== undefined ? Number(stockQuantity) : 50,
      description: description ? description.trim() : '',
      specs: specs || {},
      colors: Array.isArray(colors) && colors.length > 0 ? colors : ['bg-gray-900'],
      section: Array.isArray(section) && section.length > 0 ? section : ['exclusive'],
      isNew: Boolean(isNew),
      isTrending: Boolean(isTrending),
    });

    await product.save();

    // Update category count
    await Category.updateOne(
      { slug: product.category },
      { $inc: { productCount: 1 } }
    );

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (err) {
    console.error('[Admin Create Product Error]:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to create product',
    });
  }
});

// GET /api/admin/products/:id
adminProductRouter.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    product.id = product._id.toString();

    const now = new Date();
    const activePromotions = await Promotion.find({
      isActive: true,
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    }).lean();

    const bestPromo = getBestPromotionForProduct(product._id, product.price, activePromotions);
    if (bestPromo) {
      const { discount, discountedPrice } = calculateItemDiscount(
        product.price,
        bestPromo.discountType,
        bestPromo.discountValue,
        bestPromo.maxDiscountAmount
      );
      product.basePrice = product.price;
      product.originalPrice = product.price;
      product.price = discountedPrice;
      product.activePromotion = {
        id: bestPromo._id.toString(),
        name: bestPromo.name,
        code: bestPromo.code,
        discountType: bestPromo.discountType,
        discountValue: bestPromo.discountValue,
        badgeText:
          bestPromo.discountType === 'percentage'
            ? `${bestPromo.discountValue}% OFF`
            : `₹${bestPromo.discountValue} OFF`,
        endDate: bestPromo.endDate,
      };
    } else {
      product.basePrice = product.price;
      product.activePromotion = null;
    }

    // Strictly ensure images and galleryImages are cleanly synchronized with zero stale fallbacks
    if (Array.isArray(product.galleryImages) && product.galleryImages.length > 0) {
      product.images = product.galleryImages;
    } else if (Array.isArray(product.images) && product.images.length > 0) {
      product.galleryImages = product.images;
    }

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve product' });
  }
});

// PATCH /api/admin/products/:id
adminProductRouter.patch('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const oldCategory = product.category;
    const updates = { ...req.body };

    if (updates.name && !updates.slug) {
      // keep existing slug unless explicitly provided
    } else if (updates.slug) {
      updates.slug = slugify(updates.slug);
      const duplicate = await Product.findOne({
        slug: updates.slug,
        _id: { $ne: product._id },
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Slug already in use by another product',
        });
      }
    }

    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.originalPrice !== undefined) updates.originalPrice = Number(updates.originalPrice);
    if (updates.stockQuantity !== undefined) {
      updates.stockQuantity = Number(updates.stockQuantity);
      if (updates.stockQuantity <= 0 && updates.inStock === undefined) {
        updates.inStock = false;
      }
    }

    if (updates.category && updates.category !== oldCategory) {
      const targetCat = await Category.findOne({
        slug: updates.category.toLowerCase().trim(),
        isDeleted: { $ne: true },
      });
      if (!targetCat) {
        return res.status(400).json({
          success: false,
          message: `Category "${updates.category}" is archived or does not exist.`,
        });
      }
      updates.category = targetCat.slug;
      if (!updates.categoryLabel) updates.categoryLabel = targetCat.name;
    }

    Object.assign(product, updates);
    await product.save();

    // If category changed, update active counts for both old and new
    if (updates.category && updates.category !== oldCategory) {
      const [oldCount, newCount] = await Promise.all([
        Product.countDocuments({ category: oldCategory, isDeleted: { $ne: true } }),
        Product.countDocuments({ category: updates.category, isDeleted: { $ne: true } }),
      ]);
      await Promise.all([
        Category.updateOne({ slug: oldCategory }, { productCount: oldCount }),
        Category.updateOne({ slug: updates.category }, { productCount: newCount }),
      ]);
    }

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    });
  } catch (err) {
    console.error('[Admin Update Product Error]:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to update product',
    });
  }
});

// DELETE /api/admin/products/:id (SOFT DELETE / ARCHIVE)
adminProductRouter.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (product.isDeleted) {
      return res.status(400).json({ success: false, message: 'Product is already archived' });
    }

    product.isDeleted = true;
    product.deletedAt = new Date();
    product.deletedBy = req.admin?._id;
    product.deletedReason = req.body?.reason || 'Archived by administrator';
    await product.save();

    // Recalculate category active productCount
    const activeCount = await Product.countDocuments({
      category: product.category,
      isDeleted: { $ne: true },
    });
    await Category.updateOne({ slug: product.category }, { productCount: activeCount });

    res.json({
      success: true,
      message: `Product "${product.name}" archived successfully`,
      data: product,
    });
  } catch (err) {
    console.error('[Admin Delete Product Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to archive product' });
  }
});

// PATCH /api/admin/products/:id/restore (RESTORE ARCHIVED PRODUCT)
adminProductRouter.patch('/:id/restore', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (!product.isDeleted) {
      return res.status(400).json({ success: false, message: 'Product is not archived' });
    }

    // Verify assigned category is active
    const catDoc = await Category.findOne({
      slug: product.category,
      isDeleted: { $ne: true },
    });
    if (!catDoc) {
      return res.status(400).json({
        success: false,
        message: `Cannot restore product "${product.name}" because its category "${product.categoryLabel || product.category}" is archived or missing. Restore the category first.`,
      });
    }

    product.isDeleted = false;
    product.deletedAt = null;
    product.deletedBy = null;
    product.deletedReason = '';
    await product.save();

    // Recalculate category active productCount
    const activeCount = await Product.countDocuments({
      category: product.category,
      isDeleted: { $ne: true },
    });
    await Category.updateOne({ slug: product.category }, { productCount: activeCount });

    res.json({
      success: true,
      message: `Product "${product.name}" restored successfully`,
      data: product,
    });
  } catch (err) {
    console.error('[Admin Restore Product Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to restore product' });
  }
});

export default router;

