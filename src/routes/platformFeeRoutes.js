import express from 'express';
import { PlatformFeeSettings } from '../models/PlatformFeeSettings.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  calculatePlatformFee,
  validatePlatformFeeInput,
} from '../utils/platformFeeCalculator.js';
import { recordAuditLog } from '../services/auditService.js';

const router = express.Router();
export const adminPlatformFeeRouter = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC STOREFRONT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/platform-fee/config
 * Returns active platform fee configuration for client preview
 */
router.get('/config', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  try {
    const settings = await PlatformFeeSettings.getOrCreate();
    res.json({
      success: true,
      settings: {
        enabled: settings.enabled,
        feeType: settings.feeType,
        feeValue: settings.feeValue,
        minFee: settings.minFee,
        maxFee: settings.maxFee,
      },
    });
  } catch (err) {
    console.error('[Get Platform Fee Config Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve platform fee settings' });
  }
});

/**
 * POST /api/platform-fee/calculate
 * Computes platform fee quote for a given subtotal
 */
router.post('/calculate', async (req, res) => {
  try {
    const { subtotal } = req.body;
    const settings = await PlatformFeeSettings.getOrCreate();
    const fee = calculatePlatformFee(subtotal, settings);

    res.json({
      success: true,
      platformFee: fee,
      enabled: settings.enabled,
      feeType: settings.feeType,
      feeValue: settings.feeValue,
    });
  } catch (err) {
    console.error('[Calculate Platform Fee Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to calculate platform fee' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED ADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

adminPlatformFeeRouter.use(requireAdmin);

/**
 * GET /api/admin/settings/platform-fee
 * Retrieves current platform fee configuration for admin editing
 */
adminPlatformFeeRouter.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  try {
    const settings = await PlatformFeeSettings.getOrCreate();
    res.json({
      success: true,
      settings,
    });
  } catch (err) {
    console.error('[Admin Get Platform Fee Settings Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch platform fee settings' });
  }
});

/**
 * PUT /api/admin/settings/platform-fee
 * Updates platform fee settings after strict validation
 */
adminPlatformFeeRouter.put('/', async (req, res) => {
  try {
    const { enabled, feeType, feeValue, minFee, maxFee } = req.body;

    const validation = validatePlatformFeeInput({
      enabled: Boolean(enabled),
      feeType: feeType || 'fixed',
      feeValue: feeValue !== undefined ? Number(feeValue) : 0,
      minFee: minFee !== undefined && minFee !== '' && minFee !== null ? Number(minFee) : null,
      maxFee: maxFee !== undefined && maxFee !== '' && maxFee !== null ? Number(maxFee) : null,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join(' '),
        errors: validation.errors,
      });
    }

    let settings = await PlatformFeeSettings.getOrCreate();

    settings.enabled = Boolean(enabled);
    settings.feeType = feeType;
    settings.feeValue = Number(feeValue);
    settings.minFee = minFee !== undefined && minFee !== '' && minFee !== null ? Number(minFee) : null;
    settings.maxFee = maxFee !== undefined && maxFee !== '' && maxFee !== null ? Number(maxFee) : null;
    if (req.admin?._id) {
      settings.updatedBy = req.admin._id;
    }

    await settings.save();

    await recordAuditLog({
      req,
      action: 'CONFIG_UPDATE',
      actionLabel: 'Update',
      module: 'PLATFORM_FEE',
      moduleLabel: 'Platform Fee',
      entityType: 'PlatformFeeSettings',
      entityId: settings._id?.toString() || 'platform_fee',
      entityTitle: 'Platform Fee Configuration',
      description: `Admin updated platform fee rules: feeType=${feeType}, feeValue=${feeValue}, enabled=${Boolean(enabled)}.`,
      result: 'success',
      changedFields: ['enabled', 'feeType', 'feeValue', 'minFee', 'maxFee'],
      metadata: { enabled: Boolean(enabled), feeType, feeValue: Number(feeValue), minFee, maxFee },
    });

    res.json({
      success: true,
      message: 'Platform fee settings updated successfully.',
      settings,
    });
  } catch (err) {
    console.error('[Admin Update Platform Fee Settings Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to update platform fee settings' });
  }
});

/**
 * PATCH /api/admin/settings/platform-fee/toggle
 * Toggles the enabled status of the platform fee
 */
adminPlatformFeeRouter.patch('/toggle', async (req, res) => {
  try {
    let settings = await PlatformFeeSettings.getOrCreate();
    settings.enabled = !settings.enabled;
    if (req.admin?._id) {
      settings.updatedBy = req.admin._id;
    }
    await settings.save();

    await recordAuditLog({
      req,
      action: 'STATUS_CHANGE',
      actionLabel: 'Status Change',
      module: 'PLATFORM_FEE',
      moduleLabel: 'Platform Fee',
      entityType: 'PlatformFeeSettings',
      entityId: settings._id?.toString() || 'platform_fee',
      entityTitle: 'Platform Fee Status',
      description: `Admin ${settings.enabled ? 'activated' : 'disabled'} the global platform fee.`,
      result: 'success',
      changedFields: ['enabled'],
      metadata: { enabled: settings.enabled },
    });

    res.json({
      success: true,
      message: `Platform fee ${settings.enabled ? 'enabled' : 'disabled'} successfully.`,
      enabled: settings.enabled,
      settings,
    });
  } catch (err) {
    console.error('[Admin Toggle Platform Fee Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle platform fee status' });
  }
});

export default router;

