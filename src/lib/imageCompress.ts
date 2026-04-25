import imageCompression from 'browser-image-compression';

// Every upload goes through this. Phone photos come in at 3-6 MB; we
// downscale the long edge to 1600 px, recompress to WebP quality 0.82, and
// strip EXIF so GPS/author metadata isn't leaked. Output is typically
// 200-400 KB — a 10-20x reduction with no perceptible quality loss for
// social-feed use. File name keeps the original stem so downloads read
// naturally; extension switches to .webp.

const TARGET_MAX_SIDE_PX = 1600;
const TARGET_QUALITY = 0.82;
const TARGET_MIME = 'image/webp';

export interface CompressedImage {
  file: File;
  originalBytes: number;
  compressedBytes: number;
}

export async function compressForUpload(source: File): Promise<CompressedImage> {
  const originalBytes = source.size;

  // Skip recompression for things we can't meaningfully improve (tiny files,
  // SVGs, GIFs where we'd lose animation). Everything else goes through.
  if (source.size < 200 * 1024) {
    return { file: source, originalBytes, compressedBytes: source.size };
  }
  if (source.type === 'image/svg+xml' || source.type === 'image/gif') {
    return { file: source, originalBytes, compressedBytes: source.size };
  }

  try {
    const compressed = await imageCompression(source, {
      maxWidthOrHeight: TARGET_MAX_SIDE_PX,
      useWebWorker: true,
      fileType: TARGET_MIME,
      initialQuality: TARGET_QUALITY,
      // EXIF is stripped by default when re-encoding via canvas (which is
      // what browser-image-compression does). No extra flag needed.
    });

    const stem = source.name.replace(/\.[^.]+$/, '') || 'photo';
    const renamed = new File([compressed], `${stem}.webp`, {
      type: TARGET_MIME,
      lastModified: Date.now(),
    });

    return { file: renamed, originalBytes, compressedBytes: renamed.size };
  } catch (err) {
    // Never block an upload because compression failed. Fall back to
    // shipping the original bytes and log so we notice patterns.
    console.warn('image compression failed; uploading original', err);
    return { file: source, originalBytes, compressedBytes: source.size };
  }
}
