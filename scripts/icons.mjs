// Rasterizes public/favicon.svg into the PNG fallbacks Safari needs. Run after changing the logo.
// sharp comes with astro; no extra dependency.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg');
await sharp(svg).resize(96, 96).png().toFile('public/favicon.png');
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png');
// The share card public/og/site.jpg is hand-made, not generated here.
console.log('wrote public/favicon.png, public/apple-touch-icon.png');
