/**
 * The forms family (`catalogue/forms.tsx`, 2.8): the Contact form and Newsletter signup sections,
 * and the form fields they share with 2.11's form elements (F-CM-1, F-CM-6).
 */
export const forms = {
  "section.contactForm": "Contact form",
  "section.newsletter": "Newsletter signup",
  "field.buttonLabel": "Button text",
  "field.askPhone": "Ask for a phone number",
  "field.askName": "Ask for a name",
  "field.formAddress": "Form address",
  "field.formAddress.help":
    "The address your newsletter service gives its signup form, starting with https://.",
  "field.emailFieldName": "Email field's name",
  "field.emailFieldName.help":
    "What your newsletter service calls the email address, such as EMAIL. Leave it as email if unsure.",
  "field.formLayout.stacked": "Text above",
  "field.formLayout.split": "Text beside",
  "starter.contactFormTitle": "Get in touch",
  "starter.contactFormText": "Send us a message and we'll reply within a day.",
  "starter.contactFormButton": "Send message",
  "starter.newsletterTitle": "Stay in the loop",
  "starter.newsletterText": "News and offers, once a month. Unsubscribe at any time.",
  "starter.newsletterButton": "Sign up",
  // A form on an exported site.
  "siteText.form.contact": "Contact form",
  "siteText.form.newsletter": "Newsletter signup",
  "siteText.form.name": "Name",
  "siteText.form.email": "Email address",
  "siteText.form.phone": "Phone number",
  "siteText.form.message": "Message",
  "siteText.form.choose": "Choose…",
  // The honeypot's label, which visitors never see (B6).
  "siteText.form.leaveEmpty": "Leave this empty",
} as const;
