// Builds responsive hero backgrounds from the source render (design/hero-source.jpg, kept out of git).
import sharp from 'sharp';
import { existsSync } from 'node:fs';

const src = process.argv[2] ?? '../../design/hero-source.jpg';
if (!existsSync(src)) throw new Error(`missing ${src}`);
for (const w of [960, 1600, 2400]) {
  const img = sharp(src).resize({ width: w }).modulate({ saturation: 0.9 });
  await img.clone().avif({ quality: 52, effort: 6 }).toFile(`public/hero/mountains-${w}.avif`);
  await img.clone().webp({ quality: 74 }).toFile(`public/hero/mountains-${w}.webp`);
}
// tiny blurred placeholder shown while the full image loads
const lqip = await sharp(src).resize({ width: 24 }).blur(1).webp({ quality: 40 }).toBuffer();
console.log(`data:image/webp;base64,${lqip.toString('base64')}`);
