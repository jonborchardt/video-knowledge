// Rasterizes public/favicon.svg into the PNG fallbacks Safari and social cards need. Run after changing the logo.
// sharp comes with astro; no extra dependency.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg');
const name = 'Video knowledge';
const tagline = ['What YouTube videos and blog posts claim,', 'checked against the evidence.'];

await sharp(svg).resize(96, 96).png().toFile('public/favicon.png');
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png');

const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#15171c"/>
  <text x="300" y="320" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="84" font-weight="600" fill="#f2f3f5">${name}</text>
  <text x="300" y="390" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="32" fill="#a3a9b5">${tagline[0]}</text>
  <text x="300" y="436" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="32" fill="#a3a9b5">${tagline[1]}</text>
</svg>`;
await sharp(Buffer.from(card))
  .composite([{ input: await sharp(svg).resize(200, 200).png().toBuffer(), left: 72, top: 215 }])
  .png()
  .toFile('public/og/site.png');
console.log('wrote public/favicon.png, public/apple-touch-icon.png, public/og/site.png');
