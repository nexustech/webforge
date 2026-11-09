---

id: forms
title: Forms
summary: Let visitors send you messages, and choose the service that delivers them to you.
related: [sections, elements, site-settings, site-check]
updated: 2026-11-08
---

# Forms

Your website is a set of plain files, with no server of its own to receive messages. A form's messages go through a **form service**: a website that takes what visitors send and emails it to you. You choose one in Site Settings, once, for every form on your site.

## Adding a form

- The **Contact form** section is ready to use: name, email, message and, if you like, a phone number. See [Sections](sections.md#contact-form).
- The **Form** element lets you choose the fields yourself: a line of text, an email address, a phone number, a message, a tick box or a choice from a list. See [Elements](elements.md#form).

## Choosing a form service

Open **File › Site Settings…** and choose **Forms**. Then pick a **Form service**:

| Form service      | What to enter                                          |
| ----------------- | ------------------------------------------------------ |
| **Formspree**     | Your Formspree form ID                                 |
| **Web3Forms**     | Your Web3Forms access key                              |
| **FormSubmit**    | The email address messages should go to                |
| **Other address** | The address your service gave you, starting `https://` |

Sign up with the service on its own website first. Each service has its own terms and limits, and some charge for more messages.

**Netlify Forms** is in the list once your site has a Netlify destination in **Publish**. There's nothing to enter: Netlify receives the messages itself, and you read them in your Netlify account, under your site's **Forms**. They only work on the site Netlify serves. In an exported copy, or a copy published anywhere else, the form's button is turned off and [Site Check](site-check.md) lists it.

Until a service is chosen, forms on your pages show their button turned off, and [Site Check](site-check.md) lists them.

## What visitors see

When a visitor sends a form, they see a thank-you page. {appName} makes this page for you when the service can send visitors back to your site and your site has a web address. With Netlify Forms, it's made without one.

Forms include a hidden check that stops most spam robots. A form sent within a few seconds of the page opening waits a moment before it's sent.

## Newsletter signup

The **Newsletter signup** section sends to your newsletter service's own form address, not to the form service. See [Sections](sections.md#newsletter-signup).
