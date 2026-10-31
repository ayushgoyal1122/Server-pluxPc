import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Product } from './models/Product.js';
import { Category } from './models/Category.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const categories = await Category.find({}).lean();
  const catMap = Object.fromEntries(categories.map(c => [c._id.toString(), c.name]));
  
  const products = await Product.find({}).lean();
  for (const p of products) {
    const catName = catMap[p.category?.toString()] || 'Unknown';
    console.log(`Product: "${p.name}" | Slug: "${p.slug}" | Category: "${catName}"`);
    console.log(`  Main Image: ${p.imageUrl}`);
    console.log(`  Gallery: ${p.galleryImages?.length} images`);
    if (p.galleryImages?.length > 1) {
      console.log(`  Gallery[1]: ${p.galleryImages[1]}`);
    }
    console.log(`  Posters: ${p.promotionalPosters?.length} posters`);
    if (p.promotionalPosters?.length > 0) {
      console.log(`  Poster[0] image: ${p.promotionalPosters[0].image}`);
    }
  }
  await mongoose.disconnect();
}

run().catch(console.error);

