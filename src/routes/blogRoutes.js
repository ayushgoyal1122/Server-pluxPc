import express from 'express';
import { Blog } from '../models/Blog.js';
import { requireAdmin } from '../middleware/auth.js';
import { recordAuditLog } from '../services/auditService.js';

const router = express.Router();
export const adminBlogRouter = express.Router();

// Helper to generate a clean, URL-safe slug from a title
function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper to estimate reading time based on 200 words per minute
function estimateReadingTime(text) {
  if (!text) return '3 min read';
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC STOREFRONT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/blogs/categories
 * Returns distinct published blog categories with article counts.
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await Blog.aggregate([
      { $match: { status: 'published', isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$category',
          slug: { $first: '$categorySlug' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ]);

    const formatted = categories.map((c) => ({
      name: c._id,
      slug: c.slug || generateSlug(c._id),
      count: c.count,
    }));

    res.json({ success: true, categories: formatted });
  } catch (err) {
    console.error('[Get Blog Categories Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve blog categories' });
  }
});

/**
 * GET /api/blogs/featured
 * Returns the primary featured article plus top 3 popular published articles.
 */
router.get('/featured', async (req, res) => {
  try {
    let featured = await Blog.findOne({
      status: 'published',
      isDeleted: { $ne: true },
      isFeatured: true,
    }).sort({ publishedAt: -1 });

    // Fallback if no specific article has isFeatured = true
    if (!featured) {
      featured = await Blog.findOne({
        status: 'published',
        isDeleted: { $ne: true },
      }).sort({ views: -1, publishedAt: -1 });
    }

    const popular = await Blog.find({
      status: 'published',
      isDeleted: { $ne: true },
      _id: featured ? { $ne: featured._id } : { $exists: true },
    })
      .sort({ views: -1, publishedAt: -1 })
      .limit(3);

    res.json({
      success: true,
      featured,
      popular,
    });
  } catch (err) {
    console.error('[Get Featured Blogs Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve featured blogs' });
  }
});

/**
 * GET /api/blogs
 * Filtered, paginated list of published blog articles.
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 9,
      category = '',
      search = '',
      q = '',
      tag = '',
      sort = 'latest',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 9));
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      status: 'published',
      isDeleted: { $ne: true },
    };

    // Category filter
    const catQuery = category.trim();
    if (catQuery && catQuery.toLowerCase() !== 'all') {
      const catSlug = generateSlug(catQuery);
      filter.$or = [
        { categorySlug: catSlug },
        { category: new RegExp(`^${catQuery}$`, 'i') },
      ];
    }

    // Tag filter
    if (tag && tag.trim()) {
      filter.tags = tag.trim();
    }

    // Search query
    const searchKeyword = (search || q).trim();
    if (searchKeyword) {
      const regex = new RegExp(searchKeyword, 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: regex },
          { excerpt: regex },
          { category: regex },
          { tags: regex },
          { author: regex },
        ],
      });
    }

    // Sort order
    let sortObj = { publishedAt: -1 };
    if (sort === 'popular') {
      sortObj = { views: -1, publishedAt: -1 };
    } else if (sort === 'oldest') {
      sortObj = { publishedAt: 1 };
    }

    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Blog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: blogs.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      blogs,
    });
  } catch (err) {
    console.error('[Get Blogs Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve blog articles' });
  }
});

/**
 * GET /api/blogs/:slug
 * Retrieves single published article by slug with related articles.
 */
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Support both slug and direct ID lookup
    const query = {
      $or: [{ slug: slug.toLowerCase().trim() }],
      status: 'published',
      isDeleted: { $ne: true },
    };
    if (slug.match(/^[0-9a-fA-F]{24}$/)) {
      query.$or.push({ _id: slug });
    }

    const blog = await Blog.findOneAndUpdate(
      query,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog article not found or has not been published yet.',
      });
    }

    // Fetch related articles (same category or recent)
    const relatedBlogs = await Blog.find({
      _id: { $ne: blog._id },
      category: blog.category,
      status: 'published',
      isDeleted: { $ne: true },
    })
      .sort({ publishedAt: -1 })
      .limit(3)
      .lean();

    // Fallback if category has fewer than 3 other articles
    if (relatedBlogs.length < 3) {
      const additional = await Blog.find({
        _id: { $nin: [blog._id, ...relatedBlogs.map((b) => b._id)] },
        status: 'published',
        isDeleted: { $ne: true },
      })
        .sort({ views: -1 })
        .limit(3 - relatedBlogs.length)
        .lean();
      relatedBlogs.push(...additional);
    }

    res.json({
      success: true,
      blog,
      relatedBlogs,
    });
  } catch (err) {
    console.error('[Get Single Blog Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve article' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS (Protected with requireAdmin)
// ─────────────────────────────────────────────────────────────────────────────

adminBlogRouter.use(requireAdmin);

/**
 * GET /api/admin/blogs/stats
 * Overview counts for the Admin Blog Dashboard.
 */
adminBlogRouter.get('/stats', async (req, res) => {
  try {
    const [total, published, draft, viewsAgg] = await Promise.all([
      Blog.countDocuments({ isDeleted: { $ne: true } }),
      Blog.countDocuments({ status: 'published', isDeleted: { $ne: true } }),
      Blog.countDocuments({ status: 'draft', isDeleted: { $ne: true } }),
      Blog.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: null, totalViews: { $sum: '$views' } } },
      ]),
    ]);

    const totalViews = viewsAgg[0]?.totalViews || 0;

    res.json({
      success: true,
      stats: {
        total,
        published,
        draft,
        totalViews,
      },
    });
  } catch (err) {
    console.error('[Admin Blog Stats Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to load blog statistics' });
  }
});

/**
 * GET /api/admin/blogs
 * Admin view of all articles (both published and drafts) with filtering.
 */
adminBlogRouter.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = 'all',
      category = 'all',
      q = '',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = { isDeleted: { $ne: true } };

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (category && category !== 'all') {
      filter.category = new RegExp(`^${category}$`, 'i');
    }

    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filter.$or = [
        { title: regex },
        { author: regex },
        { category: regex },
        { tags: regex },
      ];
    }

    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Blog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      blogs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (err) {
    console.error('[Admin Get Blogs Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to load articles' });
  }
});

/**
 * GET /api/admin/blogs/:id
 * Retrieve single article details for admin editor.
 */
adminBlogRouter.get('/:id', async (req, res) => {
  try {
    const blog = await Blog.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }
    res.json({ success: true, blog });
  } catch (err) {
    console.error('[Admin Get Blog By ID Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to load article' });
  }
});

/**
 * POST /api/admin/blogs
 * Create a new blog post.
 */
adminBlogRouter.post('/', async (req, res) => {
  try {
    const {
      title,
      slug,
      excerpt,
      content,
      coverImage,
      category,
      author,
      authorRole,
      authorAvatar,
      tags,
      status = 'published',
      readTime,
      isFeatured = false,
      metaTitle,
      metaDescription,
      publishedAt,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Article title is required' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Article content is required' });
    }
    if (!excerpt || !excerpt.trim()) {
      return res.status(400).json({ success: false, message: 'Article excerpt is required' });
    }
    if (!coverImage || !coverImage.trim()) {
      return res.status(400).json({ success: false, message: 'Cover image URL is required' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }

    let finalSlug = slug && slug.trim() ? generateSlug(slug) : generateSlug(title);

    // Ensure unique slug
    let slugExists = await Blog.findOne({ slug: finalSlug, isDeleted: { $ne: true } });
    if (slugExists) {
      finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
    }

    const calculatedReadTime = readTime && readTime.trim() ? readTime.trim() : estimateReadingTime(content);

    const newBlog = new Blog({
      title: title.trim(),
      slug: finalSlug,
      excerpt: excerpt.trim(),
      content: content.trim(),
      coverImage: coverImage.trim(),
      category: category.trim(),
      categorySlug: generateSlug(category),
      author: author && author.trim() ? author.trim() : req.admin?.name || 'PLUXPC Hardware Lab',
      authorRole: authorRole && authorRole.trim() ? authorRole.trim() : 'Hardware Editor',
      authorAvatar: authorAvatar && authorAvatar.trim() ? authorAvatar.trim() : '',
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : (typeof tags === 'string' ? tags.split(',').map((t) => t.trim()).filter(Boolean) : []),
      status: status === 'draft' ? 'draft' : 'published',
      readTime: calculatedReadTime,
      isFeatured: Boolean(isFeatured),
      metaTitle: metaTitle && metaTitle.trim() ? metaTitle.trim() : `${title.trim()} | PLUXPC`,
      metaDescription: metaDescription && metaDescription.trim() ? metaDescription.trim() : excerpt.trim(),
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
    });

    await newBlog.save();

    // Audit log
    await recordAuditLog({
      req,
      action: 'CREATE',
      actionLabel: 'Create Blog Post',
      module: 'BLOGS',
      moduleLabel: 'Blog Management',
      entityType: 'Blog',
      entityId: newBlog._id.toString(),
      entityTitle: newBlog.title,
      description: `Administrator "${req.admin?.name}" created article: "${newBlog.title}" (${newBlog.status}).`,
      result: 'success',
    });

    res.status(201).json({
      success: true,
      message: 'Article created successfully',
      blog: newBlog,
    });
  } catch (err) {
    console.error('[Admin Create Blog Error]:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create article' });
  }
});

/**
 * PUT /api/admin/blogs/:id
 * Update an existing article.
 */
adminBlogRouter.put('/:id', async (req, res) => {
  try {
    const blog = await Blog.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    const {
      title,
      slug,
      excerpt,
      content,
      coverImage,
      category,
      author,
      authorRole,
      authorAvatar,
      tags,
      status,
      readTime,
      isFeatured,
      metaTitle,
      metaDescription,
      publishedAt,
    } = req.body;

    if (title && title.trim()) blog.title = title.trim();
    if (excerpt && excerpt.trim()) blog.excerpt = excerpt.trim();
    if (content && content.trim()) blog.content = content.trim();
    if (coverImage && coverImage.trim()) blog.coverImage = coverImage.trim();
    if (category && category.trim()) {
      blog.category = category.trim();
      blog.categorySlug = generateSlug(category);
    }
    if (author && author.trim()) blog.author = author.trim();
    if (authorRole && authorRole.trim()) blog.authorRole = authorRole.trim();
    if (typeof authorAvatar === 'string') blog.authorAvatar = authorAvatar.trim();

    if (tags !== undefined) {
      blog.tags = Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : (typeof tags === 'string' ? tags.split(',').map((t) => t.trim()).filter(Boolean) : []);
    }

    if (status && (status === 'published' || status === 'draft')) {
      blog.status = status;
    }

    if (isFeatured !== undefined) {
      blog.isFeatured = Boolean(isFeatured);
    }

    if (slug && slug.trim()) {
      const cleanSlug = generateSlug(slug);
      if (cleanSlug !== blog.slug) {
        const conflict = await Blog.findOne({ slug: cleanSlug, _id: { $ne: blog._id }, isDeleted: { $ne: true } });
        if (!conflict) {
          blog.slug = cleanSlug;
        }
      }
    }

    if (readTime && readTime.trim()) {
      blog.readTime = readTime.trim();
    } else if (content) {
      blog.readTime = estimateReadingTime(blog.content);
    }

    if (metaTitle !== undefined) blog.metaTitle = metaTitle.trim();
    if (metaDescription !== undefined) blog.metaDescription = metaDescription.trim();
    if (publishedAt) blog.publishedAt = new Date(publishedAt);

    await blog.save();

    // Audit log
    await recordAuditLog({
      req,
      action: 'UPDATE',
      actionLabel: 'Update Blog Post',
      module: 'BLOGS',
      moduleLabel: 'Blog Management',
      entityType: 'Blog',
      entityId: blog._id.toString(),
      entityTitle: blog.title,
      description: `Administrator "${req.admin?.name}" updated article: "${blog.title}".`,
      result: 'success',
    });

    res.json({
      success: true,
      message: 'Article updated successfully',
      blog,
    });
  } catch (err) {
    console.error('[Admin Update Blog Error]:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to update article' });
  }
});

/**
 * PATCH /api/admin/blogs/:id/status
 * Toggle or set article publication status.
 */
adminBlogRouter.patch('/:id/status', async (req, res) => {
  try {
    const blog = await Blog.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    const { status } = req.body;
    const targetStatus = status || (blog.status === 'published' ? 'draft' : 'published');

    blog.status = targetStatus;
    if (targetStatus === 'published' && !blog.publishedAt) {
      blog.publishedAt = new Date();
    }
    await blog.save();

    // Audit log
    await recordAuditLog({
      req,
      action: 'STATUS_CHANGE',
      actionLabel: 'Change Blog Status',
      module: 'BLOGS',
      moduleLabel: 'Blog Management',
      entityType: 'Blog',
      entityId: blog._id.toString(),
      entityTitle: blog.title,
      description: `Administrator "${req.admin?.name}" changed status of "${blog.title}" to "${blog.status}".`,
      result: 'success',
    });

    res.json({
      success: true,
      message: `Article status changed to ${blog.status}`,
      blog,
    });
  } catch (err) {
    console.error('[Admin Toggle Blog Status Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to change article status' });
  }
});

/**
 * DELETE /api/admin/blogs/:id
 * Soft-delete an article.
 */
adminBlogRouter.delete('/:id', async (req, res) => {
  try {
    const blog = await Blog.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    blog.isDeleted = true;
    blog.deletedAt = new Date();
    await blog.save();

    // Audit log
    await recordAuditLog({
      req,
      action: 'DELETE',
      actionLabel: 'Delete Blog Post',
      module: 'BLOGS',
      moduleLabel: 'Blog Management',
      entityType: 'Blog',
      entityId: blog._id.toString(),
      entityTitle: blog.title,
      description: `Administrator "${req.admin?.name}" deleted article: "${blog.title}".`,
      result: 'success',
    });

    res.json({
      success: true,
      message: 'Article deleted successfully',
    });
  } catch (err) {
    console.error('[Admin Delete Blog Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to delete article' });
  }
});

export default router;

