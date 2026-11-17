/**
 * The contact-buttons family (`catalogue/contact-buttons.tsx`): the Contact buttons.
 */
export const contactButtons = {
  "section.contactButtons": "Contact buttons",
  "field.contactButtons.call": "Call button",
  "field.contactButtons.phone": "Phone number",
  "field.contactButtons.phone.help": "Leave it empty to use the one in Site Settings › Contact.",
  "field.contactButtons.whatsapp": "WhatsApp button",
  "field.contactButtons.whatsappNumber": "WhatsApp number",
  "field.contactButtons.whatsappNumber.help":
    "With its country code (+44 7700 900123). Leave it empty to use the phone number.",
  "field.contactButtons.email": "Email button",
  "field.contactButtons.emailAddress": "Email address",
  "field.contactButtons.emailAddress.help":
    "Leave it empty to use the one in Site Settings › Contact.",
  // On the exported site: what screen readers call the buttons, and each one's tooltip.
  "siteText.contactButtons.label": "Contact us",
  "siteText.contactButtons.call": "Call us",
  "siteText.contactButtons.whatsapp": "Message us on WhatsApp",
  "siteText.contactButtons.email": "Email us",
} as const;
