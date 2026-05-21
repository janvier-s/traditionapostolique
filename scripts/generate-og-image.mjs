/**
 * Generates static/og-image.png (1200x630) for social-media previews.
 * Run with: node scripts/generate-og-image.mjs
 */

import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

// Palette (from src/app.css :root, light theme)
const BG = '#f8f5ef';
const FG = '#1c1710';
const MUTED = '#4a443e';
const ACCENT = '#a62c2c';
const BORDER = '#e4dcd0';

// Dimensions
const W = 1200;
const H = 630;
const CX = W / 2;

// SVG composition: centred title + subtitle + accent rule + URL.
const svg = `<svg
  width="${W}" height="${H}"
  viewBox="0 0 ${W} ${H}"
  xmlns="http://www.w3.org/2000/svg">

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${BG}"/>

  <!-- Frame: outer -->
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}"
        fill="none" stroke="${BORDER}" stroke-width="1"/>
  <!-- Frame: inner -->
  <rect x="32" y="32" width="${W - 64}" height="${H - 64}"
        fill="none" stroke="${BORDER}" stroke-width="0.5"/>

  <!-- Fleuron -->
  <text
    x="${CX}" y="200"
    font-family="Libre Baskerville, Georgia, serif"
    font-size="34"
    fill="${ACCENT}"
    text-anchor="middle">&#x2720;</text>

  <!-- Main title -->
  <text
    x="${CX}" y="320"
    font-family="Libre Baskerville, Georgia, serif"
    font-size="92"
    font-weight="bold"
    fill="${FG}"
    text-anchor="middle">P&#232;res de l&#8217;&#201;glise</text>

  <!-- Subtitle -->
  <text
    x="${CX}" y="384"
    font-family="Libre Baskerville, Georgia, serif"
    font-size="32"
    font-style="italic"
    fill="${MUTED}"
    text-anchor="middle">Anthologie patristique fran&#231;aise</text>

  <!-- Accent rule -->
  <line
    x1="${CX - 160}" y1="430" x2="${CX + 160}" y2="430"
    stroke="${ACCENT}" stroke-width="1.5"/>

  <!-- Tagline -->
  <text
    x="${CX}" y="470"
    font-family="Gotham, Avenir Next, Helvetica Neue, sans-serif"
    font-size="14"
    font-weight="500"
    fill="${MUTED}"
    text-anchor="middle"
    letter-spacing="4">CITATIONS ORGANIS&#201;ES PAR SUJETS</text>

  <!-- URL -->
  <text
    x="${CX}" y="538"
    font-family="Gotham, Avenir Next, Helvetica Neue, sans-serif"
    font-size="15"
    fill="${ACCENT}"
    text-anchor="middle"
    letter-spacing="1.5">peres-eglise.fr</text>

</svg>`;

const outPath = resolve(root, 'static/og-image.png');

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outPath);

console.log(`og-image.png written to ${outPath}`);
