// Builds the app icon from the Pin (the companion), in every size the web app and Android need.
// Usage: node scripts/icon.mjs [preview-dir]   (needs Playwright's Chromium, only at build time of the icon)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLUE = '#2547D0';

// The default Pin, as drawn in src/ui/Companion.tsx (64×90 box, body 6..58 × 4..72).
const PIN = `
  <ellipse cx="32" cy="76.5" rx="13" ry="2.8" fill="#000" opacity=".22"/>
  <path d="M32 72C26 64 6 47 6 30a26 26 0 0 1 52 0c0 17-20 34-26 42z" fill="#2fd08f"/>
  <path d="M32 72C29 68 22 61 16 52c8 6 22 6 32 0-6 9-13 16-16 20z" fill="#1baf7a" opacity=".55"/>
  <ellipse cx="19" cy="17" rx="4.5" ry="7.5" transform="rotate(30 19 17)" fill="#fff" opacity=".35"/>
  <circle cx="16.5" cy="37" r="3.6" fill="#ff8fab" opacity=".6"/><circle cx="47.5" cy="37" r="3.6" fill="#ff8fab" opacity=".6"/>
  <ellipse cx="23" cy="29" rx="3.8" ry="4.8" fill="#0f1b3d"/><ellipse cx="41" cy="29" rx="3.8" ry="4.8" fill="#0f1b3d"/>
  <circle cx="24.4" cy="27.2" r="1.3" fill="#fff"/><circle cx="42.4" cy="27.2" r="1.3" fill="#fff"/>
  <path d="M26 38.5q6 6 12 0" fill="none" stroke="#0f1b3d" stroke-width="2.6" stroke-linecap="round"/>`;

const COIN = `
  <circle cx="0" cy="0" r="15" fill="#f5b819"/><circle cx="0" cy="0" r="11.5" fill="none" stroke="#d99a06" stroke-width="2"/>
  <text x="0" y="5.6" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="16" fill="#a86f00">€</text>`;

/**
 * Variants, each placed on a 512 canvas. `k` is the Pin's scale, (x, y) where its box's origin
 * lands. The Pin's visual centre is about (32, 40) in its own box.
 */
const at = (k, cx, cy) => `translate(${cx - 32 * k} ${cy - 40 * k}) scale(${k})`;
export const VARIANTS = {
  pin: () => `<g transform="${at(3.9, 256, 262)}">${PIN}</g>`,
  face: () => `<g transform="${at(6.4, 256, 300)}">${PIN}</g>`,
  coin: () => `<g transform="${at(3.6, 236, 258)}">${PIN}</g><g transform="translate(338 330) scale(3.6)">${COIN}</g>`,
};

const svg = (inner, bg = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg ? `<rect width="512" height="512" fill="${BLUE}"/>` : ''}${inner}</svg>`;

/** Adaptive-icon foreground: 108dp canvas where only the middle ~66% is safe, so shrink to fit. */
const foreground = (inner) => svg(`<g transform="translate(256 256) scale(0.66) translate(-256 -256)">${inner}</g>`, false);

async function render(page, markup, size, file, transparent = false) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  mkdirSync(dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
}

async function main() {
  const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage();
  const preview = process.argv[2];
  const pick = process.env.ICON ?? 'pin';

  if (preview) {
    // Side by side: full square, Android circle, and real home-screen size.
    const cells = Object.entries(VARIANTS)
      .map(([name, v]) => {
        const s = svg(v());
        const enc = `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;
        return `<div style="text-align:center;font:600 15px system-ui;color:#fff">
          <img src="${enc}" width="200" style="border-radius:44px"><br>
          <img src="${enc}" width="96" style="border-radius:50%;margin:10px 6px"> <img src="${enc}" width="48" style="border-radius:50%;margin:0 6px 24px">
          <div>${name}</div></div>`;
      })
      .join('');
    await page.setViewportSize({ width: 760, height: 420 });
    await page.setContent(`<body style="margin:0;padding:24px;background:linear-gradient(135deg,#334,#556);display:flex;gap:28px">${cells}</body>`);
    await page.screenshot({ path: join(preview, 'icon-variants.png') });
    await browser.close();
    return;
  }

  const inner = VARIANTS[pick]();
  const full = svg(inner);
  writeFileSync(join(ROOT, 'public/icon.svg'), full);
  await render(page, full, 192, join(ROOT, 'public/icon-192.png'));
  await render(page, full, 512, join(ROOT, 'public/icon-512.png'));
  // Maskable (PWA): same safe-zone rule as Android.
  await render(page, svg(`<g transform="translate(256 256) scale(0.8) translate(-256 -256)">${inner}</g>`), 512, join(ROOT, 'public/icon-maskable.png'));

  const res = join(ROOT, 'android/app/src/main/res');
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  const round = svg(`<clipPath id="c"><circle cx="256" cy="256" r="256"/></clipPath><g clip-path="url(#c)"><rect width="512" height="512" fill="${BLUE}"/>${inner}</g>`, false);
  const square = svg(`<clipPath id="c"><rect width="512" height="512" rx="96"/></clipPath><g clip-path="url(#c)"><rect width="512" height="512" fill="${BLUE}"/>${inner}</g>`, false);
  for (const [d, k] of Object.entries(dens)) {
    await render(page, foreground(inner), 108 * k, join(res, `mipmap-${d}/ic_launcher_foreground.png`), true);
    await render(page, square, 48 * k, join(res, `mipmap-${d}/ic_launcher.png`), true);
    await render(page, round, 48 * k, join(res, `mipmap-${d}/ic_launcher_round.png`), true);
  }
  await browser.close();
  console.log(`icon "${pick}" written`);
}

main();
