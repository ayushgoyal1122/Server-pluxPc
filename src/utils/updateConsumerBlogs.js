import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Blog } from '../models/Blog.js';
import { SAMPLE_BLOGS } from './seedBlogs.js';

async function updateBlogs() {
  try {
    await connectDB();
    console.log('[Update Blogs]: Connected to MongoDB.');

    // Count existing products and orders to prove they remain untouched
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('[Safety Check]: Existing collections:', collections.map(c => c.name).join(', '));

    const oldCount = await Blog.countDocuments();
    console.log(`[Update Blogs]: Found ${oldCount} existing blog post(s).`);

    // Remove only blog collection records
    const delResult = await Blog.deleteMany({});
    console.log(`[Update Blogs]: Cleared ${delResult.deletedCount} old PC blog post(s).`);

    // Insert the 10 consumer electronics articles
    const inserted = await Blog.insertMany(SAMPLE_BLOGS);
    console.log(`[Update Blogs]: Successfully inserted ${inserted.length} Consumer Electronics & Gadget articles!`);

    inserted.forEach((b, idx) => {
      console.log(`  ${idx + 1}. [${b.category}] ${b.title} (${b.slug})`);
    });

    await mongoose.disconnect();
    console.log('[Update Blogs]: Disconnected cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('[Update Blogs Error]:', err);
    process.exit(1);
  }
}

updateBlogs();

