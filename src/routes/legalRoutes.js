import express from 'express';
import { LegalContent } from '../models/LegalContent.js';
import { requireAdmin } from '../middleware/auth.js';
import { recordAuditLog } from '../services/auditService.js';

const router = express.Router();
export const adminLegalRouter = express.Router();

const VALID_SLUGS = ['terms-and-conditions', 'privacy-policy'];

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC STOREFRONT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/legal
 * Returns summary list of published legal pages.
 */
router.get('/', async (req, res) => {
  try {
    const pages = await LegalContent.find({ status: 'published' })
      .select('title slug status updatedAt characterCount')
      .sort({ slug: 1 })
      .lean();

    res.json({
      success: true,
      pages,
    });
  } catch (err) {
    console.error('[Public Get Legal Pages Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve legal pages.' });
  }
});

/**
 * GET /api/legal/:slug
 * Returns the published legal page content for the storefront.
 */
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const cleanSlug = String(slug || '').trim().toLowerCase();

    if (!VALID_SLUGS.includes(cleanSlug)) {
      return res.status(404).json({
        success: false,
        message: `Legal page "${cleanSlug}" does not exist.`,
      });
    }

    const page = await LegalContent.findOne({ slug: cleanSlug });

    if (!page) {
      return res.status(404).json({
        success: false,
        message: `Legal page "${cleanSlug}" is not available yet.`,
      });
    }

    if (page.status !== 'published') {
      return res.status(404).json({
        success: false,
        isDraft: true,
        message: `The ${page.title} page is currently in draft mode and not publicly available.`,
      });
    }

    const formattedPage = {
      id: page._id,
      slug: page.slug,
      title: page.title,
      content: page.content,
      status: page.status,
      characterCount: page.characterCount || page.content.length,
      updatedAt: page.updatedAt,
    };

    res.json({
      success: true,
      page: formattedPage,
      data: formattedPage,
    });
  } catch (err) {
    console.error('[Public Get Legal Page By Slug Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve legal content.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS (Protected with requireAdmin)
// ─────────────────────────────────────────────────────────────────────────────

adminLegalRouter.use(requireAdmin);

/**
 * GET /api/admin/legal
 * Returns all legal content pages with draft/published statuses.
 */
adminLegalRouter.get('/', async (req, res) => {
  try {
    const pages = await LegalContent.find()
      .sort({ slug: 1 })
      .lean();

    res.json({
      success: true,
      count: pages.length,
      pages,
    });
  } catch (err) {
    console.error('[Admin Get Legal Pages Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve legal pages for admin.' });
  }
});

/**
 * GET /api/admin/legal/:slug
 * Returns the specific legal content page for editing in admin panel.
 */
adminLegalRouter.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const cleanSlug = String(slug || '').trim().toLowerCase();

    if (!VALID_SLUGS.includes(cleanSlug)) {
      return res.status(400).json({
        success: false,
        message: `Invalid legal page slug "${cleanSlug}". Expected "terms-and-conditions" or "privacy-policy".`,
      });
    }

    let page = await LegalContent.findOne({ slug: cleanSlug });

    // If page doesn't exist yet, return a clean initialized template
    if (!page) {
      const defaultTitle = cleanSlug === 'terms-and-conditions' ? 'Terms & Conditions' : 'Privacy Policy';
      page = {
        slug: cleanSlug,
        title: defaultTitle,
        content: `## ${defaultTitle}\n\nEnter legal content here...`,
        status: 'draft',
        characterCount: 0,
        lastUpdatedBy: 'Admin',
      };
    }

    res.json({
      success: true,
      page,
    });
  } catch (err) {
    console.error('[Admin Get Legal Page Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve legal page.' });
  }
});

/**
 * PUT /api/admin/legal/:slug
 * Creates or updates legal content for a specific slug.
 */
adminLegalRouter.put('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const cleanSlug = String(slug || '').trim().toLowerCase();

    if (!VALID_SLUGS.includes(cleanSlug)) {
      return res.status(400).json({
        success: false,
        message: `Invalid legal page slug "${cleanSlug}". Must be "terms-and-conditions" or "privacy-policy".`,
      });
    }

    const { title, content, status } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Page title is required.',
      });
    }

    if (content === undefined || content === null || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Page content is required.',
      });
    }

    if (content.length > 50000) {
      return res.status(400).json({
        success: false,
        message: `Content exceeds the 50,000 character limit (${content.length} characters entered).`,
      });
    }

    const cleanStatus = status === 'draft' ? 'draft' : 'published';
    const adminActor = req.admin?.name || req.admin?.email || 'Admin';

    const updatedPage = await LegalContent.findOneAndUpdate(
      { slug: cleanSlug },
      {
        $set: {
          title: title.trim(),
          content: content,
          status: cleanStatus,
          characterCount: content.length,
          lastUpdatedBy: adminActor,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    // Record Audit Log for governance
    try {
      await recordAuditLog({
        action: 'UPDATE',
        module: 'CONTENT',
        description: `Updated legal content for "${updatedPage.title}" (${cleanSlug}) - Status: ${cleanStatus}, Characters: ${updatedPage.characterCount}`,
        actorName: req.admin?.name || 'PLUXPC Administrator',
        actorEmail: req.admin?.email || 'admin@pluxpc.com',
        role: 'admin',
        result: 'SUCCESS',
        ipAddress: req.ip || req.connection?.remoteAddress || '127.0.0.1',
      });
    } catch (auditErr) {
      console.warn('[Audit Log Warning]:', auditErr.message);
    }

    res.json({
      success: true,
      message: `"${updatedPage.title}" has been saved successfully!`,
      page: updatedPage,
    });
  } catch (err) {
    console.error('[Admin Update Legal Content Error]:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to save legal content.',
    });
  }
});

export default router;
