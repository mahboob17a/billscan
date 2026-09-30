/**
 * OpsNest-style two-tone icons (64×64): teal outline for the frame, white for the
 * detail, and a teal→blue gradient accent. Plain data so the same shapes render in the
 * app (react-native-svg) and in design previews.
 */

export type Paint = 'teal' | 'white' | 'grad';

export type Shape =
  | { kind: 'path'; d: string; stroke?: Paint; fill?: Paint; width?: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number; stroke?: Paint; fill?: Paint; width?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; stroke?: Paint; fill?: Paint; width?: number };

export type BrandIconName = 'scan' | 'photos' | 'files' | 'internet' | 'fingerprint';

export const BRAND_ICONS: Record<BrandIconName, Shape[]> = {
  // Bill inside scanner corner brackets, with a scan line.
  scan: [
    { kind: 'path', d: 'M6 18V9a3 3 0 0 1 3-3h9M46 6h9a3 3 0 0 1 3 3v9M58 46v9a3 3 0 0 1-3 3h-9M18 58H9a3 3 0 0 1-3-3v-9', stroke: 'teal', width: 4.5 },
    { kind: 'path', d: 'M22 14h20v36l-3.3-2.4L35.3 50 32 47.6 28.7 50l-3.4-2.4L22 50z', stroke: 'white', width: 3 },
    { kind: 'path', d: 'M27 22h10M27 28h10M27 40h6', stroke: 'white', width: 2.6 },
    { kind: 'rect', x: 9, y: 32.5, w: 46, h: 3, r: 1.5, fill: 'grad' },
  ],
  // Two stacked photos: teal back frame, white front frame with a mountain, gradient sun.
  photos: [
    { kind: 'path', d: 'M14 16V12a4 4 0 0 1 4-4h34a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4h-4', stroke: 'teal', width: 4.5 },
    { kind: 'rect', x: 8, y: 18, w: 40, h: 36, r: 4, stroke: 'white', width: 3 },
    { kind: 'path', d: 'M12 48l11-12 8 8 5-5 8 9', stroke: 'white', width: 3 },
    { kind: 'circle', cx: 36, cy: 28, r: 4.5, fill: 'grad' },
  ],
  // Folder (teal) holding a white document, gradient bar = stored safely inside the app.
  files: [
    { kind: 'path', d: 'M6 20V13a3 3 0 0 1 3-3h13l5 6h28a3 3 0 0 1 3 3v33a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z', stroke: 'teal', width: 4.5 },
    { kind: 'path', d: 'M20 24h18l6 6v18H20z', stroke: 'white', width: 3 },
    { kind: 'path', d: 'M25 36h14M25 42h10', stroke: 'white', width: 2.6 },
    { kind: 'rect', x: 12, y: 50, w: 40, h: 3, r: 1.5, fill: 'grad' },
  ],
  // Signal arcs: teal outer, white middle, gradient dot.
  internet: [
    { kind: 'path', d: 'M6 26a37 37 0 0 1 52 0', stroke: 'teal', width: 4.5 },
    { kind: 'path', d: 'M15 35a24 24 0 0 1 34 0', stroke: 'white', width: 3.5 },
    { kind: 'path', d: 'M24 44a11.5 11.5 0 0 1 16 0', stroke: 'white', width: 3.5 },
    { kind: 'circle', cx: 32, cy: 52, r: 4.5, fill: 'grad' },
  ],
  // Fingerprint: teal outer ridges, white inner ridges, gradient core.
  fingerprint: [
    { kind: 'path', d: 'M14 24a20 20 0 0 1 36 0M12 38c0-5 .6-8 2-12M52 36c0-4-.4-7-2-10', stroke: 'teal', width: 4.5 },
    { kind: 'path', d: 'M20 44c-1-3-1.4-6-1.4-9a13.4 13.4 0 0 1 26.8 0c0 4-.6 8-2 12', stroke: 'white', width: 3 },
    { kind: 'path', d: 'M26 50c-1.2-4-1.6-8-1.6-12a7.6 7.6 0 0 1 15.2 0c0 5-.8 10-2.8 14', stroke: 'white', width: 3 },
    { kind: 'path', d: 'M32 34v8c0 4-.8 8-2 12', stroke: 'grad', width: 3.4 },
  ],
};

export const BRAND_COLORS = { teal: '#19D3C5', white: '#FFFFFF', gradFrom: '#19D3C5', gradTo: '#3B82F6' } as const;

/** SVG markup for previews and documents. */
export function brandIconSvg(name: BrandIconName, size: number): string {
  const id = `g-${name}-${size}`;
  const paint = (p?: Paint) => (!p ? 'none' : p === 'grad' ? `url(#${id})` : BRAND_COLORS[p]);
  const body = BRAND_ICONS[name]
    .map((s) => {
      const common = `fill="${paint(s.fill)}" stroke="${paint(s.stroke)}" stroke-width="${s.width ?? 0}" stroke-linecap="round" stroke-linejoin="round"`;
      if (s.kind === 'path') return `<path d="${s.d}" ${common}/>`;
      if (s.kind === 'rect') return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r ?? 0}" ${common}/>`;
      return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${common}/>`;
    })
    .join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="6" y1="0" x2="58" y2="0"><stop offset="0" stop-color="${BRAND_COLORS.gradFrom}"/><stop offset="1" stop-color="${BRAND_COLORS.gradTo}"/></linearGradient></defs>${body}</svg>`;
}
