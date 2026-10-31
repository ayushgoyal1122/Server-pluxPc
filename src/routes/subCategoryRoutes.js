import express from 'express';
import { SubCategory } from '../models/SubCategory.js';
import { Category } from '../models/Category.js';
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

// GET /api/subcategories
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = {
      isDeleted: { $ne: true },
    };
    if (category) filter.category = category.toLowerCase().trim();

    const subCategories = await SubCategory.find(filter).sort({ name: 1 }).lean();
    const formatted = subCategories.map((sc) => ({
      id: sc._id.toString(),
      name: sc.name,
      slug: sc.slug,
      category: sc.category,
      categoryName: sc.categoryName,
      imageUrl: sc.imageUrl,
      description: sc.description,
      productCount: sc.productCount || 0,
      createdAt: sc.createdAt,
      updatedAt: sc.updatedAt,
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('[Get SubCategories Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve subcategories' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PROTECTED ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export const adminSubCategoryRouter = express.Router();
adminSubCategoryRouter.use(requireAdmin);

// GET /api/admin/subcategories
adminSubCategoryRouter.get('/', async (req, res) => {
  try {
    const { q, category, status } = req.query;
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
        { category: { $regex: q.trim(), $options: 'i' } },
        { categoryName: { $regex: q.trim(), $options: 'i' } },
      ];
    }

    if (category) {
      filter.category = category.toLowerCase().trim();
    }

    const subCategories = await SubCategory.find(filter).sort({ createdAt: -1 }).lean();

    // Map parent category display name and accurate counts
    const mapped = await Promise.all(
      subCategories.map(async (sc) => {
        let catName = sc.categoryName;
        if (!catName) {
          const parent = await Category.findOne({ slug: sc.category }).lean();
          catName = parent ? parent.name : sc.category.toUpperCase();
        }

        return {
          id: sc._id.toString(),
          name: sc.name,
          slug: sc.slug,
          category: sc.category,
          categoryName: catName,
          imageUrl: sc.imageUrl,
          description: sc.description,
          productCount: sc.productCount || 0,
          isDeleted: Boolean(sc.isDeleted),
          deletedAt: sc.deletedAt || null,
          deletedReason: sc.deletedReason || '',
          createdAt: sc.createdAt,
          updatedAt: sc.updatedAt,
        };
      })
    );

    res.json({
      success: true,
      count: mapped.length,
      data: mapped,
    });
  } catch (err) {
    console.error('[Admin Get SubCategories Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve subcategories' });
  }
});

// POST /api/admin/subcategories
adminSubCategoryRouter.post('/', async (req, res) => {
  try {
    const { name, slug: customSlug, category, categoryName, imageUrl, description } = req.body;

    if (!name || !category || !imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Name, parent category, and image URL are required',
      });
    }

    const finalSlug = customSlug ? slugify(customSlug) : slugify(name);

    // Check duplicate slug
    const existing = await SubCategory.findOne({ slug: finalSlug });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Subcategory with slug "${finalSlug}" already exists`,
      });
    }

    // Lookup parent category and ensure it is not archived
    const parent = await Category.findOne({
      slug: category.toLowerCase().trim(),
      isDeleted: { $ne: true },
    });
    if (!parent) {
      return res.status(400).json({
        success: false,
        message: `Parent category "${category}" is archived or does not exist.`,
      });
    }

    let finalCatName = categoryName || parent.name;

    const newSubCat = await SubCategory.create({
      name: name.trim(),
      slug: finalSlug,
      category: category.toLowerCase().trim(),
      categoryName: finalCatName,
      imageUrl: imageUrl.trim(),
      description: (description || '').trim(),
      productCount: 0,
    });

    res.status(201).json({
      success: true,
      message: 'Subcategory created successfully',
      data: {
        id: newSubCat._id.toString(),
        name: newSubCat.name,
        slug: newSubCat.slug,
        category: newSubCat.category,
        categoryName: newSubCat.categoryName,
        imageUrl: newSubCat.imageUrl,
        description: newSubCat.description,
        createdAt: newSubCat.createdAt,
      },
    });
  } catch (err) {
    console.error('[Create SubCategory Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to create subcategory' });
  }
});

// PUT /api/admin/subcategories/:id
adminSubCategoryRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug: customSlug, category, categoryName, imageUrl, description } = req.body;

    const subCat = await SubCategory.findById(id);
    if (!subCat) {
      return res.status(404).json({ success: false, message: 'Subcategory not found' });
    }

    if (name) subCat.name = name.trim();
    if (imageUrl) subCat.imageUrl = imageUrl.trim();
    if (description !== undefined) subCat.description = description.trim();

    if (category) {
      const parent = await Category.findOne({
        slug: category.toLowerCase().trim(),
        isDeleted: { $ne: true },
      });
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: `Target category "${category}" is archived or does not exist.`,
        });
      }
      subCat.category = parent.slug;
      subCat.categoryName = categoryName || parent.name;
    }

    if (customSlug) {
      const finalSlug = slugify(customSlug);
      if (finalSlug !== subCat.slug) {
        const duplicate = await SubCategory.findOne({ slug: finalSlug, _id: { $ne: id } });
        if (duplicate) {
          return res.status(409).json({
            success: false,
            message: `Slug "${finalSlug}" is already taken by another subcategory`,
          });
        }
        subCat.slug = finalSlug;
      }
    }

    await subCat.save();

    res.json({
      success: true,
      message: 'Subcategory updated successfully',
      data: {
        id: subCat._id.toString(),
        name: subCat.name,
        slug: subCat.slug,
        category: subCat.category,
        categoryName: subCat.categoryName,
        imageUrl: subCat.imageUrl,
        description: subCat.description,
        updatedAt: subCat.updatedAt,
      },
    });
  } catch (err) {
    console.error('[Update SubCategory Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to update subcategory' });
  }
});

// DELETE /api/admin/subcategories/:id (SOFT DELETE / ARCHIVE)
adminSubCategoryRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const subCat = await SubCategory.findById(id);
    if (!subCat) {
      return res.status(404).json({ success: false, message: 'Subcategory not found' });
    }
    if (subCat.isDeleted) {
      return res.status(400).json({ success: false, message: 'Subcategory is already archived' });
    }

    subCat.isDeleted = true;
    subCat.deletedAt = new Date();
    subCat.deletedBy = req.admin?._id;
    subCat.deletedReason = req.body?.reason || 'Archived by administrator';
    await subCat.save();

    res.json({
      success: true,
      message: `Subcategory "${subCat.name}" archived successfully`,
      data: subCat,
    });
  } catch (err) {
    console.error('[Delete SubCategory Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to archive subcategory' });
  }
});

// PATCH /api/admin/subcategories/:id/restore (RESTORE ARCHIVED SUBCATEGORY)
adminSubCategoryRouter.patch('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const subCat = await SubCategory.findById(id);
    if (!subCat) {
      return res.status(404).json({ success: false, message: 'Subcategory not found' });
    }
    if (!subCat.isDeleted) {
      return res.status(400).json({ success: false, message: 'Subcategory is not archived' });
    }

    // Verify parent category is active
    const parent = await Category.findOne({
      slug: subCat.category,
      isDeleted: { $ne: true },
    });
    if (!parent) {
      return res.status(400).json({
        success: false,
        message: `Cannot restore subcategory "${subCat.name}" because its parent category "${subCat.categoryName || subCat.category}" is archived. Please restore the parent category first.`,
      });
    }

    subCat.isDeleted = false;
    subCat.deletedAt = null;
    subCat.deletedBy = null;
    subCat.deletedReason = '';
    await subCat.save();

    res.json({
      success: true,
      message: `Subcategory "${subCat.name}" restored successfully`,
      data: subCat,
    });
  } catch (err) {
    console.error('[Restore SubCategory Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to restore subcategory' });
  }
});

export default router;

