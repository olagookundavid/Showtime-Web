import sharp from "sharp";
import { readFile, writeFile, unlink, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const PUBLIC_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
);

// Resized to ~2x the largest actual on-page render size, then converted to WebP.
// Renaming these requires updating the src/ files that hardcode their paths
// (done by hand alongside this script — see the PR this script shipped with).
const CONVERT_TO_WEBP = [
  { src: "images/branding/showtime-logo.png", maxWidth: 320, quality: 90 },
  { src: "images/default_football.png", maxWidth: 160, quality: 85 },
  {
    src: "images/branding/showtime-community-cup-shield.png",
    maxWidth: 200,
    quality: 85,
  },
  {
    src: "images/branding/showtime-bowl-trophy.png",
    maxWidth: 200,
    quality: 85,
  },
  { src: "showtime-broadcast-logo.png", maxWidth: 400, quality: 88 },
  { src: "images/branding/home-bg.jpeg", maxWidth: 1920, quality: 78 },
  {
    src: "images/branding/showtime-arena-main.jpg",
    maxWidth: 1600,
    quality: 78,
  },
  { src: "images/branding/store-hero.jpg", maxWidth: 1600, quality: 72 },
  { src: "images/branding/hero-1.jpeg", maxWidth: 1600, quality: 78 },
  { src: "images/branding/hero-2.jpeg", maxWidth: 1600, quality: 78 },
  { src: "images/branding/hero-3.jpeg", maxWidth: 1600, quality: 78 },
  { src: "images/store/raptors-jersey-1.png", maxWidth: 900, quality: 85 },
  { src: "images/store/greenbacks-jersey.png", maxWidth: 900, quality: 85 },
  {
    src: "images/store/showtime-snapback-with-crest-black.png",
    maxWidth: 900,
    quality: 85,
  },
  {
    src: "images/store/showtime-snapback-with-red-stripes-blue.png",
    maxWidth: 900,
    quality: 85,
  },
  { src: "images/store/showtime-keychain.png", maxWidth: 900, quality: 85 },
  {
    src: "images/store/showtime-snapback-black.png",
    maxWidth: 900,
    quality: 85,
  },
  {
    src: "images/store/showtime-snapback-with-crest-white.png",
    maxWidth: 900,
    quality: 85,
  },
  {
    src: "images/store/showtime-snapback-unite-compete-thrive-blue.png",
    maxWidth: 900,
    quality: 85,
  },
  { src: "images/leadership/azeez_amida.jpg", maxWidth: 800, quality: 80 },
  {
    src: "images/leadership/adebare_adejumo.jpg",
    maxWidth: 800,
    quality: 80,
  },
  { src: "images/leadership/kalu_esther.jpg", maxWidth: 800, quality: 80 },
];

// Kept as PNG at their existing path — BadgeImage.tsx/AdminBadges.tsx match
// these by exact filename against the CDN-served badge artwork, so renaming
// would require touching that matching logic for comparatively little gain
// (these are already small). Just resize to icon size and recompress.
const COMPRESS_IN_PLACE_PNG = [
  "badges/tournament-mvp.png",
  "badges/rookie-of-the-season.png",
  "badges/player-of-the-week.png",
  "badges/team-of-the-season.png",
  "badges/game-mvp.png",
  "badges/team-of-the-week.png",
  "badges/best-receiver.png",
  "badges/best-defender.png",
  "badges/best-center.png",
  "badges/best-rusher.png",
];
const BADGE_MAX_WIDTH = 160;

function pct(before, after) {
  return `${Math.round((1 - after / before) * 100)}%`;
}

async function convertToWebp({ src, maxWidth, quality }) {
  const srcPath = path.join(PUBLIC_DIR, src);
  const outPath = srcPath.replace(/\.(png|jpe?g)$/i, ".webp");
  const before = (await stat(srcPath)).size;
  await sharp(srcPath)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toFile(outPath);
  const after = (await stat(outPath)).size;
  await unlink(srcPath);
  console.log(
    `${src} -> ${path.basename(outPath)}: ${before}B -> ${after}B (-${pct(before, after)})`,
  );
}

async function compressInPlacePng(relPath) {
  const p = path.join(PUBLIC_DIR, relPath);
  const before = (await stat(p)).size;
  const buf = await sharp(p)
    .resize({ width: BADGE_MAX_WIDTH, withoutEnlargement: true })
    .png({ quality: 85, compressionLevel: 9 })
    .toBuffer();
  await writeFile(p, buf);
  console.log(`${relPath}: ${before}B -> ${buf.length}B (-${pct(before, buf.length)})`);
}

async function regenerateFavicon() {
  const faviconPath = path.join(PUBLIC_DIR, "favicon.svg");
  const svg = await readFile(faviconPath, "utf8");
  const match = svg.match(/data:image\/png;base64,([^"]+)/);
  if (!match) {
    console.log("favicon.svg: no embedded base64 PNG found, skipping");
    return;
  }
  const before = svg.length;
  const pngBuffer = Buffer.from(match[1], "base64");
  const resized = await sharp(pngBuffer).resize(64, 64).png().toBuffer();
  const newSvg = `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,${resized.toString("base64")}" width="64" height="64"/></svg>`;
  await writeFile(faviconPath, newSvg);
  console.log(`favicon.svg: ${before}B -> ${newSvg.length}B (-${pct(before, newSvg.length)})`);
}

for (const f of CONVERT_TO_WEBP) await convertToWebp(f);
for (const f of COMPRESS_IN_PLACE_PNG) await compressInPlacePng(f);
await regenerateFavicon();
