/**
 * The layout family (`catalogue/layout.tsx`): the shared Header and Footer (2.6).
 */
export const layout = {
  "layout.header": "Header",
  "layout.footer": "Footer",
  "field.siteName": "Site name",
  // The Header's and Footer's layouts (2.6).
  "field.headerLayout.left": "Name left, menu right",
  "field.headerLayout.centred": "Centred",
  "field.headerLayout.split": "With a button",
  "field.footerLayout.centred": "Centred",
  "field.footerLayout.columns": "Columns",
  // A sticky header (F-DS-6).
  "field.sticky": "Stay at the top when scrolling",
  "field.scrollStyle": "Change style when scrolling",
  "field.scrollStyle.shadow": "Shadow",
  "field.scrollStyle.shrink": "Shrink",
  "field.scrollStyle.solid": "Solid background",
  "field.scrollStyle.none": "None",
  // Text that appears on the exported site itself.
  "siteText.navigation": "Main navigation",
  "siteText.menu": "Menu",
  "siteText.footerNavigation": "Footer navigation",
  "starter.footer": "Thanks for visiting.",
} as const;
