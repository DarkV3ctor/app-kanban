import { t } from '../i18n';
import { MAX_COVER_URL, isCover } from './normalize';
import { hashColor } from './utils';

/*
 * Issue covers (media boards). A cover is stored in the issue itself, as one of:
 *   - an https link to a picture, loaded straight from its site (with no referrer);
 *   - an uploaded picture, shrunk in the browser to a small WebP (or JPEG) data: URL, so it needs
 *     no file storage and loads with the issue. Firestore documents are limited to 1 MiB; covers
 *     stay well below MAX_COVER_DATA (lib/normalize.ts).
 */

/** Longest side of an uploaded cover, in pixels: about twice the width of a card. */
const COVER_SIZE = 480;
/** Uploaded covers are re-encoded until they are this small (the hard limit is MAX_COVER_DATA). */
const COVER_TARGET = 120_000;

export type CoverKind = 'none' | 'link' | 'upload';

export const coverKind = (cover: string): CoverKind => (!cover ? 'none' : cover.startsWith('data:') ? 'upload' : 'link');

/** The cover for a link the user typed or pasted, or null when it is not an https link. */
export function coverFromLink(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.href.length > MAX_COVER_URL) return null;
  return isCover(url.href) ? url.href : null;
}

/** The site a linked cover comes from (for labels and history). */
export function coverHost(cover: string): string {
  try {
    return new URL(cover).host;
  } catch {
    return '';
  }
}

/**
 * Turns an image file (from a file picker, a drop or the clipboard) into an uploaded cover.
 * createImageBitmap decodes it without an <img>, so the page's Content Security Policy (which
 * has no blob: images) does not get in the way; it also applies the photo's EXIF rotation.
 */
export async function coverFromFile(file: Blob): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(t('This file is not an image.'));
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(t('This image format is not supported. Try a JPEG, PNG or WebP file.'));
  }
  try {
    let scale = Math.min(1, COVER_SIZE / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 4; attempt++, scale *= 0.75) {
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0, w, h);
      for (const quality of [0.82, 0.7, 0.55]) {
        const data = encode(canvas, quality);
        if (data.length <= COVER_TARGET) return data;
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error(t('The image is too large even after shrinking it.'));
}

/** WebP where the browser can encode it (it falls back to PNG otherwise), else JPEG on white. */
function encode(canvas: HTMLCanvasElement, quality: number): string {
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) return webp;
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  return flat.toDataURL('image/jpeg', quality);
}

/**
 * A made-up poster for sample issues: a gradient in the type's colour with the title on it.
 * Returns '' where there is no canvas (the samples then simply have no cover).
 */
export function generateCover(title: string, typeName: string, color: string): string {
  const W = 300;
  const H = 450;
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return '';
  canvas.width = W;
  canvas.height = H;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, color);
  bg.addColorStop(1, hashColor(title));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // A few soft circles, placed by the title, so every poster looks a little different.
  let seed = 0;
  for (const ch of title) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) % 1000) / 1000;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H * 0.7, 60 + rnd() * 120, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.06 + rnd() * 0.1})`;
    ctx.fill();
  }

  // Darken the bottom so the title stays readable.
  const shade = ctx.createLinearGradient(0, H * 0.45, 0, H);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  const font = '"Inter Variable", "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = `600 15px ${font}`;
  ctx.fillText(typeName.toUpperCase(), 24, 40);

  ctx.fillStyle = '#fff';
  ctx.font = `700 32px ${font}`;
  const lines = wrap(ctx, title, W - 48).slice(0, 5);
  lines.forEach((line, i) => ctx.fillText(line, 24, H - 32 - (lines.length - 1 - i) * 38));

  return encode(canvas, 0.8);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
