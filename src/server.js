import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { runSeed } from './seed.js';
import { backfillLegacyTrackingHistory } from './utils/backfillTracking.js';

import productRoutes, { adminProductRouter } from './routes/productRoutes.js';
import categoryRoutes, { adminCategoryRouter } from './routes/categoryRoutes.js';
import subCategoryRoutes, { adminSubCategoryRouter } from './routes/subCategoryRoutes.js';
import customerAuthRoutes from './routes/customerAuthRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import orderRoutes, { adminOrderRouter } from './routes/orderRoutes.js';
import promotionRoutes, { adminPromotionRouter } from './routes/promotionRoutes.js';
import platformFeeRoutes, { adminPlatformFeeRouter } from './routes/platformFeeRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
  })
);

// Capture raw body for webhook verification without breaking standard JSON parsing
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static assets serving for product media
app.use('/images', express.static(path.resolve(__dirname, '../../frontend/public/images')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PLUXPC E-Commerce API',
    timestamp: new Date().toISOString(),
  });
});

// Mount Public Storefront Routes
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/subcategories', subCategoryRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/platform-fee', platformFeeRoutes);

// Mount Customer Authentication & Shopping Cart Routes
app.use('/api/auth', customerAuthRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', orderRoutes);

// Mount Admin Routes (Protected)
app.use('/api/admin/auth', authRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/admin/products', adminProductRouter);
app.use('/api/admin/categories', adminCategoryRouter);
app.use('/api/admin/subcategories', adminSubCategoryRouter);
app.use('/api/admin/orders', adminOrderRouter);
app.use('/api/admin/promotions', adminPromotionRouter);
app.use('/api/admin/settings/platform-fee', adminPlatformFeeRouter);

// 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint "${req.originalUrl}" not found`,
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
});

// Start Server and Auto-Seed
async function startServer() {
  try {
    await connectDB();

    // Auto-seed if database is fresh
    await runSeed(false);

    // Safe backfill for legacy orders
    await backfillLegacyTrackingHistory();

    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 PLUXPC Backend API running on port ${PORT}`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`🛡️  Admin API ready with JWT authentication`);
      console.log(`===============================================`);
    });
  } catch (err) {
    console.error('Fatal Server Startup Error:', err);
    process.exit(1);
  }
}

startServer();

