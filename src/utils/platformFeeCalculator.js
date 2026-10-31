/**
 * Authoritative Platform Fee calculation utility for VOLTIX E-Commerce.
 */

/**
 * Calculates platform fee on eligible merchandise subtotal based on configuration.
 * @param {number} eligibleSubtotal - Net merchandise subtotal (after discounts)
 * @param {object} settings - Platform fee settings document or object
 * @returns {number} Calculated platform fee in INR (rounded to 2 decimal places, non-negative)
 */
export function calculatePlatformFee(eligibleSubtotal, settings) {
  if (!settings || !settings.enabled) {
    return 0;
  }

  const subtotal = Math.max(0, Number(eligibleSubtotal) || 0);
  if (subtotal <= 0) {
    return 0;
  }

  let fee = 0;
  const feeValue = Math.max(0, Number(settings.feeValue) || 0);

  if (settings.feeType === 'fixed') {
    fee = feeValue;
  } else if (settings.feeType === 'percentage') {
    // Percentage calculated against eligible subtotal
    fee = (subtotal * feeValue) / 100;

    // Apply minimum fee if configured
    if (settings.minFee !== null && settings.minFee !== undefined && settings.minFee !== '') {
      const minFee = Number(settings.minFee);
      if (!isNaN(minFee) && minFee > 0 && fee < minFee) {
        fee = minFee;
      }
    }

    // Apply maximum fee cap if configured
    if (settings.maxFee !== null && settings.maxFee !== undefined && settings.maxFee !== '') {
      const maxFee = Number(settings.maxFee);
      if (!isNaN(maxFee) && maxFee > 0 && fee > maxFee) {
        fee = maxFee;
      }
    }
  }

  // Never return negative, round safely to 2 decimal places
  fee = Math.max(0, Math.round(fee * 100) / 100);
  return fee;
}

/**
 * Validates platform fee configuration input.
 * @param {object} input
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePlatformFeeInput(input) {
  const errors = [];
  if (!input) {
    return { valid: false, errors: ['Settings object is required'] };
  }

  const { enabled, feeType, feeValue, minFee, maxFee } = input;

  if (typeof enabled !== 'boolean') {
    errors.push('Enabled must be a boolean value.');
  }

  if (feeType !== 'fixed' && feeType !== 'percentage') {
    errors.push("Fee type must be either 'fixed' or 'percentage'.");
  }

  const numVal = Number(feeValue);
  if (isNaN(numVal) || numVal < 0) {
    errors.push('Fee value must be a non-negative number.');
  }

  if (feeType === 'percentage' && numVal > 100) {
    errors.push('Percentage fee value cannot exceed 100%.');
  }

  let parsedMin = null;
  if (minFee !== null && minFee !== undefined && minFee !== '') {
    parsedMin = Number(minFee);
    if (isNaN(parsedMin) || parsedMin < 0) {
      errors.push('Minimum fee must be a non-negative number.');
    }
  }

  let parsedMax = null;
  if (maxFee !== null && maxFee !== undefined && maxFee !== '') {
    parsedMax = Number(maxFee);
    if (isNaN(parsedMax) || parsedMax < 0) {
      errors.push('Maximum fee must be a non-negative number.');
    }
  }

  if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
    errors.push('Minimum fee cannot exceed maximum fee.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

