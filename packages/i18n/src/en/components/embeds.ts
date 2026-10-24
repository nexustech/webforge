/**
 * The embeds family (`catalogue/embeds.tsx`, 2.8): the Video and Map sections, and the
 * click-to-load placeholder they share with 2.11's embed elements (F-CM-4).
 */
export const embeds = {
  "section.video": "Video",
  "section.map": "Map",
  "category.contact": "Contact",
  "field.videoAddress": "Video address",
  "field.videoAddress.help": "Paste the link to a YouTube or Vimeo video.",
  "field.mapAddress": "Address",
  "field.mapAddress.help":
    "The place's address, or a link to it from OpenStreetMap. An address shows on Google Maps.",
  "field.embedLayout.stacked": "Text above",
  "field.embedLayout.split": "Text beside",
  "starter.videoTitle": "See us at work",
  "starter.videoText": "Say what this video shows.",
  "starter.mapTitle": "Find us",
  "starter.mapText": "Tell visitors how to get here, and where to park.",
  // An embed's placeholder on an exported site, until the visitor loads it (F-CM-4, B7).
  "siteText.embed.playVideo": "Play video",
  "siteText.embed.showMap": "Show map",
  "siteText.embed.notice": "This loads it from {provider}, which may set cookies.",
  "siteText.embed.watchOn": "Watch on {provider}",
  "siteText.embed.openIn": "Open in {provider}",
  "siteText.embed.provider.youtube": "YouTube",
  "siteText.embed.provider.vimeo": "Vimeo",
  "siteText.embed.provider.googleMaps": "Google Maps",
  "siteText.embed.provider.openStreetMap": "OpenStreetMap",
  // The loaded player's or map's name for screen readers, when its section has no title.
  "siteText.embed.videoTitle": "Video",
  "siteText.embed.mapTitle": "Map",
} as const;
