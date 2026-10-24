/**
 * The carousel family (`catalogue/carousel.tsx`): the Carousel and its slides (2.10).
 */
export const carousel = {
  "element.carousel": "Carousel",
  "element.carouselSlide": "Slide",
  "category.media": "Images and media",
  "field.carouselLayout.images": "Images",
  "field.carouselLayout.testimonials": "Testimonials",
  "field.carouselLayout.logos": "Logos",
  // What screen readers call the carousel: "Testimonials", "Our work".
  "field.carouselLabel": "Name for screen readers",
  "field.slides": "Slides",
  "field.slideName": "Name",
  "field.autoplayGroup": "Autoplay",
  "field.autoplay": "Play automatically",
  "field.autoplay.help":
    "Visitors can stop the slides, and they never move by themselves for visitors who prefer less motion.",
  "field.interval": "Next slide after",
  "field.interval.5": "5 seconds",
  "field.interval.7": "7 seconds",
  "field.interval.10": "10 seconds",
  // A carousel on an exported site, read by screen readers (2.10). "{n} of {total}": "2 of 5".
  "siteText.carousel": "carousel",
  "siteText.slide": "slide",
  "siteText.slideOf": "{n} of {total}",
  // Several slides in view at once (logos): "5 to 8 of 10".
  "siteText.slidesOf": "{from} to {to} of {total}",
  // The strip that holds the slides, which the keyboard scrolls.
  "siteText.slides": "Slides",
  "siteText.previousSlide": "Previous slide",
  "siteText.nextSlide": "Next slide",
  "siteText.stopSlides": "Stop the slides",
  "siteText.startSlides": "Play the slides",
  "starter.carouselLabel": "Highlights",
  "starter.slideText": "Say what this slide shows.",
} as const;
