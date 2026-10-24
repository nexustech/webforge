/**
 * The gallery family (`catalogue/gallery.tsx`): the Gallery, its images and its lightbox (2.7a).
 */
export const gallery = {
  "section.gallery": "Gallery",
  "element.galleryImage": "Image",
  "category.galleries": "Galleries",
  "field.galleryLayout.grid": "Grid",
  "field.galleryLayout.masonry": "Natural shapes",
  "field.galleryLayout.featured": "First image large",
  "field.images": "Images",
  "starter.galleryTitle": "Our work",
  // A gallery's lightbox on an exported site (2.7a). "{n} of {total}": "3 of 8".
  "siteText.lightbox": "Image viewer",
  "siteText.imageOf": "{n} of {total}",
  "siteText.close": "Close",
  "siteText.previousImage": "Previous image",
  "siteText.nextImage": "Next image",
  // A gallery image's link, named for the image it opens larger: "Open larger: Our oven".
  "siteText.openLarger": "Open larger: {name}",
  // The name of an image with neither alt text nor a caption.
  "siteText.galleryImage": "image",
} as const;
