import express from 'express';
import { Category } from '../models/Category.js';
import { SubCategory } from '../models/SubCategory.js';
import { Product } from '../models/Product.js';
import { requireAdmin } from '../middleware/auth.js';

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

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: 1 })
      .lean();
    const formatted = categories.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      slug: c.slug,
      imageUrl: c.imageUrl,
      description: c.description,
      productCount: c.productCount || 0,
    }));
    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('[Get Categories Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve categories' });
  }
});

// GET /api/categories/:slugOrId
router.get('/:slugOrId', async (req, res) => {
  try {
    const { slugOrId } = req.params;
    let category;
    if (slugOrId.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findOne({ _id: slugOrId, isDeleted: { $ne: true } }).lean();
    }
    if (!category) {
      category = await Category.findOne({ slug: slugOrId, isDeleted: { $ne: true } }).lean();
    }

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    category.id = category._id.toString();
    res.json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve category' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PROTECTED ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export const adminCategoryRouter = express.Router();
adminCategoryRouter.use(requireAdmin);

// GET /api/admin/categories
adminCategoryRouter.get('/', async (req, res) => {
  try {
    const { q, status } = req.query;
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
      ];
    }

    const categories = await Category.find(filter).sort({ name: 1 }).lean();

    // Recalculate accurate live active product counts for each category
    const categoriesWithLiveCounts = await Promise.all(
      categories.map(async (c) => {
        const liveCount = await Product.countDocuments({
          category: c.slug,
          isDeleted: { $ne: true },
        });
        return {
          id: c._id.toString(),
          name: c.name,
          slug: c.slug,
          imageUrl: c.imageUrl,
          description: c.description,
          productCount: liveCount,
          isDeleted: Boolean(c.isDeleted),
          deletedAt: c.deletedAt || null,
          deletedReason: c.deletedReason || '',
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      })
    );

    res.json({
      success: true,
      count: categoriesWithLiveCounts.length,
      data: categoriesWithLiveCounts,
    });
  } catch (err) {
    console.error('[Admin Get Categories Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve categories' });
  }
});

// POST /api/admin/categories
adminCategoryRouter.post('/', async (req, res) => {
  try {
    const { name, slug: customSlug, imageUrl, description } = req.body;

    if (!name || !imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Category name and imageUrl are required',
      });
    }

    let finalSlug = slugify(customSlug || name);
    const existing = await Category.findOne({ slug: finalSlug });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Category with slug "${finalSlug}" already exists`,
      });
    }

    const category = new Category({
      name: name.trim(),
      slug: finalSlug,
      imageUrl: imageUrl.trim(),
      description: description ? description.trim() : '',
      productCount: 0,
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  } catch (err) {
    console.error('[Admin Create Category Error]:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to create category',
    });
  }
});

// PATCH /api/admin/categories/:id
adminCategoryRouter.patch('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const oldSlug = category.slug;
    const { name, slug: customSlug, imageUrl, description } = req.body;

    if (name) category.name = name.trim();
    if (imageUrl) category.imageUrl = imageUrl.trim();
    if (description !== undefined) category.description = description.trim();

    if (customSlug && customSlug !== oldSlug) {
      const newSlug = slugify(customSlug);
      const duplicate = await Category.findOne({
        slug: newSlug,
        _id: { $ne: category._id },
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Slug "${newSlug}" already in use by another category`,
        });
      }
      category.slug = newSlug;

      // Also cascade slug change to all existing products using oldSlug
      await Product.updateMany(
        { category: oldSlug },
        { category: newSlug, categoryLabel: category.name }
      );
    } else if (name && !customSlug) {
      // Update categoryLabel in products
      await Product.updateMany({ category: oldSlug }, { categoryLabel: category.name });
    }

    await category.save();

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category,
    });
  } catch (err) {
    console.error('[Admin Update Category Error]:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to update category',
    });
  }
});

// DELETE /api/admin/categories/:id (SOFT DELETE / ARCHIVE)
// SAFETY WORKFLOW: Prevent archiving category if active products are still assigned!
adminCategoryRouter.delete('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    if (category.isDeleted) {
      return res.status(400).json({ success: false, message: 'Category is already archived' });
    }

    // Check if category contains active non-deleted products
    const activeProductCount = await Product.countDocuments({
      category: category.slug,
      isDeleted: { $ne: true },
    });
    if (activeProductCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot archive category "${category.name}". It still contains ${activeProductCount} active product(s). Please reassign or archive these products first.`,
        productCount: activeProductCount,
      });
    }

    category.isDeleted = true;
    category.deletedAt = new Date();
    category.deletedBy = req.admin?._id;
    category.deletedReason = req.body?.reason || 'Archived by administrator';
    await category.save();

    // Cascade archive child subcategories to avoid orphaned records
    await SubCategory.updateMany(
      { category: category.slug, isDeleted: { $ne: true } },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: req.admin?._id,
          deletedReason: `Archived via parent category: ${category.name}`,
        },
      }
    );

    res.json({
      success: true,
      message: `Category "${category.name}" archived successfully along with its subcategories`,
      data: category,
    });
  } catch (err) {
    console.error('[Admin Delete Category Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to archive category' });
  }
});

// PATCH /api/admin/categories/:id/restore (RESTORE ARCHIVED CATEGORY)
adminCategoryRouter.patch('/:id/restore', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    if (!category.isDeleted) {
      return res.status(400).json({ success: false, message: 'Category is not archived' });
    }

    category.isDeleted = false;
    category.deletedAt = null;
    category.deletedBy = null;
    category.deletedReason = '';
    await category.save();

    res.json({
      success: true,
      message: `Category "${category.name}" restored successfully. Child subcategories and products remain archived until explicitly restored.`,
      data: category,
    });
  } catch (err) {
    console.error('[Admin Restore Category Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to restore category' });
  }
});

export default router;

