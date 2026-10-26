/** How large an image is drawn to read its colours: enough for its main ones, quick to go through. */
const SIDE = 64;

/**
 * The pixels (RGBA) of the image at `url`, drawn at most 64 pixels on a side (PG-2): for a palette
 * from an image, read here, nothing sent anywhere. Loaded in CORS mode, which Media's scheme allows,
 * so the canvas can be read. Rejects when the image can't be loaded or read.
 */
export function readPixels(
  url: string,
  document: Document = globalThis.document,
): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const image = document.createElement("img");
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const scale = Math.min(1, SIDE / Math.max(image.naturalWidth, image.naturalHeight, 1));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context === null) throw new Error("No canvas to read the image on");
        context.drawImage(image, 0, 0, width, height);
        resolve(context.getImageData(0, 0, width, height).data);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("The image didn't load"));
    image.src = url;
  });
}
