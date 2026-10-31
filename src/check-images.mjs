import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Product } from './models/Product.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const products = await Product.find({}).lean();
  console.log(`Auditing ${products.length} products...`);
  
  for (const p of products) {
    const images = [p.imageUrl, ...(p.galleryImages || [])];
    const posters = (p.promotionalPosters || []).map(po => po.image);
    
    // Check for anything not unsplash or non-standard
    const unusual = [...images, ...posters].filter(url => !url.startsWith('https://images.unsplash.com'));
    if (unusual.length > 0) {
      console.log(`[UNUSUAL URL] Product: ${p.slug} (${p.name}):`, unusual);
    }
  }
  
  await mongoose.disconnect();
}

run().catch(console.error);

