/**
 * The layout family (`catalogue/layout.tsx`): the shared Header and Footer (2.6).
 */
export const layout = {
  "layout.header": "Header",
  "layout.footer": "Footer",
  "field.siteName": "Site name",
  "field.siteName.help": "To show your logo here, choose it in Site Settings, under General.",
  // The Header's and Footer's layouts (2.6).
  "field.headerLayout.left": "Name left, menu right",
  "field.headerLayout.centred": "Centred",
  "field.headerLayout.split": "Name left, menu centred",
  // The business's logo from Site Settings (HF-1, 5.37), and where and how big it shows.
  "field.logoPlace": "Logo",
  "field.logoPlace.instead": "In place of the name",
  "field.logoPlace.beside": "Beside the name",
  "field.logoSize": "Logo size",
  "field.logoSize.small": "Small",
  "field.logoSize.medium": "Medium",
  "field.logoSize.large": "Large",
  // The Header's own button (HF-2, 5.38), in any layout.
  "field.headerButton": "Show a button",
  "field.headerButton.help": "A button such as “Book now”, on the right, and in the phone menu.",
  "starter.headerButton": "Book now",
  "field.footerLayout.centred": "Centred",
  "field.footerLayout.columns": "Columns",
  // The Footer's columns of elements (HF-4, 5.39), and the menu's links in one.
  "field.footerColumns": "Columns",
  "element.footerColumn": "Footer column",
  "element.menuLinks": "Menu links",
  // What Menu links leaves out of the menu, and adds to it, in the Footer (HF-8).
  // The Footer's own small links, in its bottom line (HF-5).
  "field.footerLinks": "Links",
  "field.footerLinks.help":
    "Pages linked in the Footer's bottom line, with its text: your Privacy or Terms page, say.",
  "field.menuLinksLeaveOut": "Leave out",
  "field.menuLinksLeaveOut.help": "Pages in your menu that the Footer doesn't list.",
  "field.menuLinksAdd": "Add",
  "field.menuLinksAdd.help": "Pages not in your menu that the Footer lists too, after the menu's.",
  // The Header on its page's first section (HH-1), on every page.
  "field.headerBackground": "Background",
  "field.headerBackground.help":
    "On every page: its own band, or the picture or colour the page's first section opens with.",
  "field.headerBackground.own": "Its own",
  "field.headerBackground.section": "The first section's",
  // A sticky header (F-DS-6).
  "field.sticky": "Stay at the top when scrolling",
  "field.scrollStyle": "Change style when scrolling",
  "field.scrollStyle.shadow": "Shadow",
  "field.scrollStyle.shrink": "Shrink",
  "field.scrollStyle.solid": "Solid background",
  // Slides out of view on the way down the page, and back on the way up (HH-7).
  "field.scrollStyle.hide": "Hide when scrolling down",
  "field.scrollStyle.none": "None",
  // The section in view (5.10b, GA10-1).
  "field.sectionHighlight": "Highlight the section in view",
  "field.sectionHighlight.help":
    "As visitors scroll, the menu lights up the section they're looking at.",
  // Text that appears on the exported site itself.
  "siteText.navigation": "Main navigation",
  "siteText.menu": "Menu",
  "siteText.footerNavigation": "Footer navigation",
  // The Footer's own small links, in its bottom line (HF-5).
  "siteText.footerLinks": "Footer links",
  "starter.footer": "Thanks for visiting.",
  // The title over the menu's links in a Footer started from *Full* (5.39).
  "starter.footerLinksTitle": "Explore",
} as const;
