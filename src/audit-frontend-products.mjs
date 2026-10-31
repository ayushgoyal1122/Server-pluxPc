import fs from 'fs';

const content = fs.readFileSync('../frontend/src/data/products.ts', 'utf8');
const regex = /slug:\s*"([^"]+)"[\s\S]*?category:\s*"([^"]+)"[\s\S]*?imageUrl:\s*([^,\n]+)/g;
let match;
while ((match = regex.exec(content)) !== null) {
  console.log(`${match[1]} | ${match[2]} | ${match[3].trim()}`);
}

