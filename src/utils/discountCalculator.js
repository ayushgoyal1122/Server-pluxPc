/**
 * Server-side authoritative discount and promotion calculations.
 */

/**
 * Calculates discount on a single unit price.
 * @param {number} price - Original product unit price
 * @param {'percentage' | 'fixed'} discountType - Type of discount
 * @param {number} discountValue - Percentage (1-100) or fixed amount in INR
 * @param {number|null} maxDiscountAmount - Optional cap for percentage discounts
 * @returns {{ discount: number, discountedPrice: number }}
 */
export function calculateItemDiscount(price, discountType, discountValue, maxDiscountAmount = null) {
  const original = Math.max(0, Number(price) || 0);
  let discount = 0;

  if (discountType === 'percentage') {
    const pct = Math.min(100, Math.max(0, Number(discountValue) || 0));
    discount = (original * pct) / 100;
    if (maxDiscountAmount && Number(maxDiscountAmount) > 0 && discount > Number(maxDiscountAmount)) {
      discount = Number(maxDiscountAmount);
    }
  } else if (discountType === 'fixed') {
    const fixed = Math.max(0, Number(discountValue) || 0);
    discount = Math.min(original, fixed);
  }

  // Never allow discount to exceed price or produce a negative discounted price
  discount = Math.min(original, Math.max(0, discount));
  // Round to two decimal places
  discount = Math.round(discount * 100) / 100;
  const discountedPrice = Math.round((original - discount) * 100) / 100;

  return {
    originalPrice: original,
    discount,
    discountedPrice,
  };
}

/**
 * Checks if a promotion is active and valid based on date range and max usage limit.
 * @param {object} promotion
 * @param {Date} now
 * @returns {boolean}
 */
export function isPromotionValid(promotion, now = new Date()) {
  if (!promotion || promotion.isDeleted || !promotion.isActive) return false;
  if (promotion.startDate && new Date(promotion.startDate) > now) return false;
  if (promotion.endDate && new Date(promotion.endDate) < now) return false;
  if (promotion.maxUsageLimit && promotion.usedCount >= promotion.maxUsageLimit) return false;
  return true;
}

/**
 * Finds the single best eligible promotion for a given product among a list of active promotions.
 * Deterministic rule: highest currency discount amount wins.
 * @param {string|object} productId
 * @param {number} productPrice
 * @param {Array} activePromotions
 * @returns {object|null}
 */
export function getBestPromotionForProduct(productId, productPrice, activePromotions) {
  if (!activePromotions || activePromotions.length === 0) return null;

  const pIdStr = productId ? productId.toString() : '';
  const eligible = activePromotions.filter((promo) => {
    if (!isPromotionValid(promo)) return false;
    if (promo.appliesTo === 'all') return true;
    if (Array.isArray(promo.products)) {
      return promo.products.some((id) => (id._id || id).toString() === pIdStr);
    }
    return false;
  });

  if (eligible.length === 0) return null;

  // Pick the promotion with the greatest monetary savings on this product
  let best = null;
  let maxSavings = -1;

  for (const promo of eligible) {
    const { discount } = calculateItemDiscount(
      productPrice,
      promo.discountType,
      promo.discountValue,
      promo.maxDiscountAmount
    );
    if (discount > maxSavings) {
      maxSavings = discount;
      best = promo;
    }
  }

  return best;
}

/**
 * Validates a promotion against a shopping cart of items and optional customer ID.
 * Returns { valid: boolean, discount: number, subtotal: number, discountedTotal: number, reason?: string, breakdown?: Array }
 */
export function evaluateCartPromotion(promotion, items, customerId = null, now = new Date()) {
  if (!promotion) {
    return { valid: false, reason: 'Promotion not found.' };
  }

  if (promotion.isDeleted) {
    return { valid: false, reason: 'This promo code is archived and no longer available.' };
  }

  if (!promotion.isActive) {
    return { valid: false, reason: 'This promo code is currently inactive.' };
  }

  if (promotion.startDate && new Date(promotion.startDate) > now) {
    return { valid: false, reason: 'This promotion has not started yet.' };
  }

  if (promotion.endDate && new Date(promotion.endDate) < now) {
    return { valid: false, reason: 'This promotion has expired.' };
  }

  if (promotion.maxUsageLimit && promotion.usedCount >= promotion.maxUsageLimit) {
    return { valid: false, reason: 'This promo code has reached its maximum global redemption limit.' };
  }

  if (customerId && promotion.perCustomerLimit && Array.isArray(promotion.usedBy)) {
    const custIdStr = customerId.toString();
    const customerUsageCount = promotion.usedBy.filter(
      (u) => u.customer && u.customer.toString() === custIdStr
    ).length;
    if (customerUsageCount >= promotion.perCustomerLimit) {
      return {
        valid: false,
        reason: `You have already used this promo code the maximum allowed times (${promotion.perCustomerLimit}).`,
      };
    }
  }

  // Calculate cart subtotal and eligible items
  let cartSubtotal = 0;
  let eligibleSubtotal = 0;
  const eligibleItems = [];

  for (const item of items) {
    const product = item.product || item;
    const pId = (product._id || product.id || '').toString();
    const unitPrice = Number(product.price) || 0;
    const qty = Math.max(1, Number(item.quantity) || 1);
    const lineSubtotal = unitPrice * qty;
    cartSubtotal += lineSubtotal;

    let isEligible = false;
    if (promotion.appliesTo === 'all') {
      isEligible = true;
    } else if (Array.isArray(promotion.products)) {
      isEligible = promotion.products.some((p) => (p._id || p).toString() === pId);
    }

    if (isEligible) {
      eligibleSubtotal += lineSubtotal;
      eligibleItems.push({
        productId: pId,
        productName: product.name,
        unitPrice,
        quantity: qty,
        lineSubtotal,
      });
    }
  }

  if (eligibleItems.length === 0) {
    return {
      valid: false,
      reason: 'None of the items in your cart are eligible for this promo code.',
    };
  }

  if (promotion.minPurchaseAmount && cartSubtotal < promotion.minPurchaseAmount) {
    return {
      valid: false,
      reason: `Minimum cart value of ₹${promotion.minPurchaseAmount.toLocaleString('en-IN')} required to apply this code. (Current: ₹${cartSubtotal.toLocaleString('en-IN')})`,
    };
  }

  // Compute discount
  let totalDiscount = 0;
  const itemDiscounts = [];

  if (promotion.discountType === 'percentage') {
    const rawDiscount = (eligibleSubtotal * promotion.discountValue) / 100;
    totalDiscount = rawDiscount;
    if (promotion.maxDiscountAmount && promotion.maxDiscountAmount > 0 && totalDiscount > promotion.maxDiscountAmount) {
      totalDiscount = promotion.maxDiscountAmount;
    }
  } else if (promotion.discountType === 'fixed') {
    // Fixed amount discount off the eligible total (cannot exceed eligible total)
    totalDiscount = Math.min(eligibleSubtotal, promotion.discountValue);
  }

  totalDiscount = Math.min(cartSubtotal, Math.max(0, Math.round(totalDiscount * 100) / 100));
  const finalTotal = Math.max(0, Math.round((cartSubtotal - totalDiscount) * 100) / 100);

  return {
    valid: true,
    promoCode: promotion.code,
    promotionId: promotion._id,
    promotionName: promotion.name,
    discountType: promotion.discountType,
    discountValue: promotion.discountValue,
    discountAmount: totalDiscount,
    subtotal: cartSubtotal,
    eligibleSubtotal,
    finalTotal,
    itemCount: eligibleItems.length,
  };
}

