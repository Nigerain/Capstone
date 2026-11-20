import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Shrinking photos before upload keeps OCR fast and cheap. Vision reads
// price tags fine at this size.
const MAX_LONG_SIDE = 1600;
const JPEG_QUALITY = 0.7;

// Extra room around the on-screen frame, so a tag lined up right at the
// edge doesn't get its last digit cut off.
const FRAME_MARGIN = 0.08;

export type Rect = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };

export type ProcessedImage = { uri: string; width: number; height: number };

/**
 * Converts the scan frame (in screen points) into a crop rectangle in photo pixels.
 *
 * The camera preview fills its view like `resizeMode: cover`: the photo is
 * scaled up until it covers the view, and the overflow is cut off evenly on
 * both sides. We undo that scale and offset to find which photo pixels were
 * under the frame.
 */
export function frameToPhotoCrop(frame: Rect, view: Size, photo: Size): Rect {
  const scale = Math.max(view.width / photo.width, view.height / photo.height);
  const offsetX = (photo.width * scale - view.width) / 2;
  const offsetY = (photo.height * scale - view.height) / 2;

  const marginX = frame.width * FRAME_MARGIN;
  const marginY = frame.height * FRAME_MARGIN;

  const left = (frame.x - marginX + offsetX) / scale;
  const top = (frame.y - marginY + offsetY) / scale;
  const right = (frame.x + frame.width + marginX + offsetX) / scale;
  const bottom = (frame.y + frame.height + marginY + offsetY) / scale;

  // Keep the rectangle inside the photo.
  const x = Math.max(0, Math.floor(left));
  const y = Math.max(0, Math.floor(top));
  return {
    x,
    y,
    width: Math.min(photo.width, Math.ceil(right)) - x,
    height: Math.min(photo.height, Math.ceil(bottom)) - y,
  };
}

/** Optionally crops, then shrinks to MAX_LONG_SIDE and saves as JPEG. */
export async function prepareScanImage(
  uri: string,
  size: Size,
  crop?: Rect
): Promise<ProcessedImage> {
  const context = ImageManipulator.manipulate(uri);
  const outSize = crop ?? size;

  if (crop) {
    context.crop({
      originX: crop.x,
      originY: crop.y,
      width: crop.width,
      height: crop.height,
    });
  }

  // Only resize down; resizing one side keeps the aspect ratio.
  if (Math.max(outSize.width, outSize.height) > MAX_LONG_SIDE) {
    context.resize(
      outSize.width >= outSize.height
        ? { width: MAX_LONG_SIDE }
        : { height: MAX_LONG_SIDE }
    );
  }

  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
