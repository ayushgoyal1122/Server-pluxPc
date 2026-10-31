import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { Admin } from './models/Admin.js';
import { Category } from './models/Category.js';
import { Product } from './models/Product.js';
import { initialCategories, initialProducts } from './seedData.js';

export async function runSeed(force = false) {
  try {
    await connectDB();

    console.log('[Seed] Checking database contents...');

    // 1. Seed or verify Admin
    const adminEmail = (process.env.ADMIN_EMAIL || 'dev@youngdecade.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminVoltix2026!';
    const adminName = process.env.ADMIN_NAME || 'PLUXPC Admin';

    let admin = await Admin.findOne({ email: adminEmail });
    if (!admin || force) {
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(adminPassword, salt);
      if (admin) {
        admin.passwordHash = passwordHash;
        admin.name = adminName;
        await admin.save();
        console.log(`[Seed] Admin "${adminEmail}" password updated.`);
      } else {
        await Admin.create({
          name: adminName,
          email: adminEmail,
          passwordHash,
          role: 'admin',
        });
        console.log(`[Seed] Initial Admin "${adminEmail}" created.`);
      }
    } else {
      console.log(`[Seed] Admin "${adminEmail}" already exists.`);
    }

    // 2. Seed Categories if empty or forced
    const catCount = await Category.countDocuments();
    if (catCount === 0 || force) {
      if (force) await Category.deleteMany({});
      await Category.insertMany(initialCategories);
      console.log(`[Seed] Inserted ${initialCategories.length} categories.`);
    } else {
      console.log(`[Seed] Categories already exist (${catCount} found).`);
    }

    // 3. Seed Products if empty or forced
    const prodCount = await Product.countDocuments();
    if (prodCount === 0 || force) {
      if (force) await Product.deleteMany({});
      await Product.insertMany(initialProducts);
      console.log(`[Seed] Inserted ${initialProducts.length} products.`);

      // Update category counts
      for (const cat of initialCategories) {
        const count = await Product.countDocuments({ category: cat.slug });
        await Category.updateOne({ slug: cat.slug }, { productCount: count });
      }
      console.log('[Seed] Category product counts synchronized.');
    } else {
      console.log(`[Seed] Products already exist (${prodCount} found).`);
    }

    console.log('[Seed] Database initialization complete!');
  } catch (err) {
    console.error('[Seed Error]:', err);
    throw err;
  }
}

// If executed directly from CLI
if (process.argv[1]?.endsWith('seed.js')) {
  const force = process.argv.includes('--force');
  runSeed(force)
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

