/**
 * The forms family (`catalogue/forms.tsx`, 2.8): the Contact form and Newsletter signup sections,
 * and the form fields they share with 2.11's form elements (F-CM-1, F-CM-6).
 */
export const forms = {
  "section.contactForm": "Contact form",
  "section.newsletter": "Newsletter signup",
  // A form of one's own fields, as an element (2.11).
  "element.form": "Form",
  "element.formField": "Form field",
  "field.formFields": "Fields",
  "field.formLabel": "What the form is for",
  "field.formLabel.help": "Screen readers name the form by it, such as Booking request.",
  "field.formFieldKind": "Asks for",
  "field.formFieldKind.text": "A line of text",
  "field.formFieldKind.email": "An email address",
  "field.formFieldKind.phone": "A phone number",
  "field.formFieldKind.message": "A message",
  "field.formFieldKind.checkbox": "A tick box",
  "field.formFieldKind.select": "A choice from a list",
  "field.formFieldLabel": "Label",
  "field.formFieldRequired": "Required",
  "field.formFieldOptions": "Choices",
  "field.formFieldOption": "Choice",
  "starter.formLabel": "Enquiry form",
  "starter.formButton": "Send",
  "starter.formFieldLabel": "Your question",
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
  // A form field whose label was left empty.
  "siteText.form.untitled": "Answer",
  // The honeypot's label, which visitors never see (B6).
  // The thank-you page the export makes for a form service to send visitors to (3.7).
  "siteText.thanks.title": "Thank you",
  "siteText.thanks.text": "Your message is on its way. We'll reply as soon as we can.",
  "siteText.thanks.home": "Back to the home page",
  "siteText.form.leaveEmpty": "Leave this empty",
} as const;
