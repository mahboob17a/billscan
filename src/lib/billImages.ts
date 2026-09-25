/**
 * Bill photos: each bill keeps its pages at <documents>/bills/<billId>/page-N.jpg
 * (resized to ~1600 px, JPEG 70%) so the report can be checked against the photo later.
 * The same resized JPEG is what is sent to the AI.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_SIDE = 1600;
const QUALITY = 0.7;

function billDir(billId: string): Directory {
  return new Directory(Paths.document, 'bills', billId);
}

export interface PreparedPage {
  uri: string; // saved file (file://…)
  base64: string; // for the AI request
}

/**
 * Resize each photo, store it with the bill and return its base64.
 * `sources` are file URIs from the document scanner or the gallery.
 */
export async function prepareBillImages(billId: string, sources: string[]): Promise<PreparedPage[]> {
  const dir = billDir(billId);
  dir.create({ intermediates: true, idempotent: true });
  const pages: PreparedPage[] = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i].startsWith('file://') || sources[i].startsWith('content://') ? sources[i] : `file://${sources[i]}`;
    const ctx = ImageManipulator.manipulate(src);
    // Only shrink: resize the longer side to MAX_SIDE. Width-only is fine for portrait bills;
    // for landscape photos limit the height instead.
    const probe = await ctx.renderAsync();
    const { width, height } = probe;
    const img =
      Math.max(width, height) > MAX_SIDE
        ? await ImageManipulator.manipulate(probe)
            .resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE })
            .renderAsync()
        : probe;
    const saved = await img.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY, base64: true });
    const dest = new File(dir, `page-${i + 1}.jpg`);
    if (dest.exists) dest.delete();
    new File(saved.uri).moveSync(dest);
    pages.push({ uri: dest.uri, base64: saved.base64 ?? '' });
  }
  return pages;
}

/** Read stored pages again (used when the AI is retried later). */
export async function readPagesBase64(uris: string[]): Promise<string[]> {
  return Promise.all(uris.map((u) => new File(u).base64()));
}

/** Remove a bill's photos (after the bill is deleted). */
export function deleteBillImages(billId: string): void {
  try {
    const dir = billDir(billId);
    if (dir.exists) dir.delete();
  } catch {
    // Missing files are not a problem.
  }
}
