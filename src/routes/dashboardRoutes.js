import express from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

async function getDashboardData() {
  const [
    totalProducts,
    totalCategories,
    inStockCount,
    outOfStockCount,
    lowStockCount,
    inventoryAggregate,
    recentProducts,
    categories,
  ] = await Promise.all([
    Product.countDocuments(),
    Category.countDocuments(),
    Product.countDocuments({ inStock: true, stockQuantity: { $gt: 0 } }),
    Product.countDocuments({ $or: [{ inStock: false }, { stockQuantity: { $lte: 0 } }] }),
    Product.countDocuments({ inStock: true, stockQuantity: { $gt: 0, $lte: 25 } }),
    Product.aggregate([
      {
        $group: {
          _id: null,
          totalInventoryUnits: { $sum: '$stockQuantity' },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
        },
      },
    ]),
    Product.find().sort({ createdAt: -1 }).limit(8).lean(),
    Category.find().sort({ name: 1 }).lean(),
  ]);

  const agg = inventoryAggregate[0] || {
    totalInventoryUnits: 0,
    avgPrice: 0,
    minPrice: 0,
    maxPrice: 0,
  };

  const formattedRecent = recentProducts.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    slug: p.slug,
    category: p.category,
    categoryLabel: p.categoryLabel,
    price: p.price,
    originalPrice: p.originalPrice,
    imageUrl: p.imageUrl,
    inStock: p.inStock,
    stockQuantity: p.stockQuantity ?? 0,
    rating: p.rating,
    badge: p.badge,
    createdAt: p.createdAt,
  }));

  return {
    metrics: {
      totalProducts,
      totalCategories,
      inStockCount,
      outOfStockCount,
      lowStockCount,
      totalInventoryUnits: agg.totalInventoryUnits || 0,
      avgPrice: Math.round(agg.avgPrice || 0),
      minPrice: agg.minPrice || 0,
      maxPrice: agg.maxPrice || 0,
    },
    databaseStatus: {
      connected: mongoose.connection.readyState === 1,
      databaseName: mongoose.connection.name,
      host: mongoose.connection.host,
    },
    recentProducts: formattedRecent,
    categories: categories.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      slug: c.slug,
      productCount: c.productCount,
      imageUrl: c.imageUrl,
    })),
  };
}

router.get('/', requireAdmin, async (req, res) => {
  try {
    const data = await getDashboardData();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Dashboard Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard statistics' });
  }
});

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const data = await getDashboardData();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Dashboard Stats Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard statistics' });
  }
});

export default router;
