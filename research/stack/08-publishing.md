# Publishing

**Status:** Researched 2026-10-19. Decisions B1–B5 recorded below
**Recommendation (MVP):**
1. **Export to folder / ZIP** (already designed)
2. **FTP / FTPS / SFTP** to the user's existing web host
3. **Netlify** (free tier, one-click, incremental uploads, rollback)

**Later:** Cloudflare, and possibly Webforge's own hosting and form relay (a business decision). **Not recommended:** Vercel Hobby and GitHub Pages for business sites (their terms restrict commercial use).

**Fixed inputs:**
- Exported sites are self-contained flat HTML/CSS/JS that need no server config (X1, C8)
- Publish uses the stricter checks (X5)
- Webforge is a paid desktop product for non-technical users (C1)
- Projects have versions (06)

## Targets compared (checked Oct 2026)

| Target | How Webforge would publish | Cost to user | Commercial sites allowed? | Incremental upload | Rollback | Ease for non-technical users | Verdict |
|---|---|---|---|---|---|---|---|
| **Folder / ZIP** | Write files; user uploads however they like | — | ✅ | — | Re-export a version | ✅ Universal fallback | ✅ MVP (done) |
| **FTP / FTPS / SFTP** (cPanel, Plesk, most shared hosts) | `basic-ftp` (MIT) / `ssh2-sftp-client` (Apache-2.0) | Their existing hosting | ✅ | ✅ Via our manifest of file hashes | ✅ Re-publish a Webforge version | ⚠️ Need host, user, password, folder (we provide presets + "Test connection") | ✅ **MVP** (most small businesses already have a host) |
| **Netlify** | REST API: **file-digest deploy**, sends SHA1 list and uploads only files Netlify doesn't have; OAuth or personal token | Free tier; paid plans for more | ✅ | ✅ Built in | ✅ **Deploy history + one-call restore** | ✅ Sign in, pick/create site, done; free `*.netlify.app` URL + HTTPS | ✅ **MVP** |
| **Cloudflare** (Pages / Workers static assets) | Direct-upload API or Wrangler; Cloudflare steers new projects to Workers static assets | Free; static asset requests free and unlimited | ✅ | ✅ | ✅ | ⚠️ More complex API, product in transition | ⏭️ **Later** (v1.x) |
| **GitHub Pages** | Push to a repo via GitHub API | Free (public repo); private repo needs paid plan | ❌ **Not allowed as free hosting for businesses / e-commerce** | ✅ | ✅ Git | ❌ Developer-oriented | ⏭️ Later, developer option only |
| **Vercel** | Deploy API | Hobby free tier | ❌ **Hobby is personal / non-commercial only** | ✅ | ✅ | ✅ | ❌ Not offered (or only with a clear paid-plan warning) |
| **AWS S3 / Azure Static Web Apps** | SDK upload | Pay-as-you-go | ✅ | ✅ | ⚠️ | ❌ Technical | ⏭️ Later, if asked |
| **Webforge Hosting** (own, like Bootstrap Studio's bss.design) | Our own service | Subscription | ✅ | ✅ | ✅ | ⭐ Simplest possible | 💼 **Business decision** (recurring revenue, but servers, support, abuse handling) |

## Publish flow (all targets)

```
Publish ▸ [profile]
 1. Build: run the export pipeline in memory with Publish-strict checks (X5) → errors stop here
 2. Diff: compare file hashes with the last-published manifest for this profile
 3. Upload: changed/new files only. Order: assets first → pages → index.html last,
    so visitors never see a page pointing at missing files
 4. Clean up: optionally delete files we published before that no longer exist
    (never touch files Webforge didn't upload)
 5. Verify: fetch the live index.html over HTTPS; check status and our build marker
 6. Record: publish history entry + automatic project version "Published 19 Oct 14:02"
 7. Done: "Your site is live at https://… [Open] [Copy link]"
```

- **Rollback for every target:** because each publish creates a project version (06), *"Republish this version"* works even on FTP. Netlify additionally offers instant restore of previous deploys.
- **Progress and cancel:** per-file progress; cancelling mid-upload leaves the previous site intact as far as possible (pages are uploaded last).
- **Manifest:** for FTP/SFTP, a small hidden `.webforge-publish.json` on the server lists files we uploaded with their hashes, so incremental uploads and safe clean-up work even from another computer.

## Publish profiles and credentials
- A project can have several **publish profiles** (e.g. "Live site: Netlify", "Client staging: FTP").
- **Profile settings** (target type, host, folder, Netlify site ID, public URL) are stored **in the `.wforge` file**.
- **Secrets** (passwords, tokens, SSH keys) are **never stored in the project file**, which may be shared or emailed. They live in the **OS keychain** via Electron `safeStorage` (Windows DPAPI / macOS Keychain), keyed by project ID + profile.
- **Netlify sign-in:** OAuth in the system browser with a loopback redirect (preferred), with "paste a personal access token" as a fallback.
- **FTP:** prefer **FTPS or SFTP**. Warn clearly when using plain FTP (password sent unencrypted). Provide host presets/help links for popular hosts and a **Test connection** button.
- The publish profile's public URL fills in Site Settings → Web address (X3) if it's empty.

## Contact forms on a static site
Static sites can't send email by themselves; a form needs a **form service** that receives the POST.

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Any form service by URL** ⭐ | User pastes the endpoint from Formspree, Basin, Web3Forms, Formgrid… into the form's settings; Webforge outputs a plain HTML `<form method="POST" action="…">` | Works on any host; **no external JavaScript** needed (fits C8); user's choice of provider | User must sign up somewhere; we document 2–3 recommended services |
| **B. Netlify Forms** (when publishing to Netlify) | Webforge adds Netlify's form attribute; submissions appear in the Netlify dashboard | Zero extra sign-up for Netlify users | Netlify-only; free tier ~100 submissions/month |
| **C. Webforge form relay** (own service, like Bootstrap Studio's Smart Forms) | Our server receives and emails submissions | Simplest for users; differentiator | We operate a service: spam, deliverability, GDPR processor obligations, cost |
| D. `mailto:` link | Opens the visitor's email app | No service | Poor experience; often broken; not recommended |

**Recommendation:** MVP = **A + B** (B automatically when the profile is Netlify). Consider **C** together with the Webforge Hosting business decision.

- **Spam:** honeypot field and time-to-submit check built in (no external JS). CAPTCHA widgets (Turnstile, hCaptcha) need external scripts, so they're offered only as an explicit allowed exception (C8).
- **After submit:** redirect to a generated *Thank you* page (configurable).
- **Privacy:** form services process visitors' personal data. Show a short notice in the form settings that the user is responsible for their privacy policy, and link to guidance.

## Custom domains and HTTPS
- **MVP:** guidance, not automation. Show step-by-step help for connecting a domain to Netlify or to the user's host. Netlify and most modern hosts provide HTTPS automatically.
- **Later:** set the custom domain via the Netlify API and show DNS records to add.

## Libraries (permissive; npm 2026-10-19)
| Job | Library | Licence |
|---|---|---|
| FTP / FTPS | `basic-ftp` 6.2 | MIT |
| SFTP | `ssh2-sftp-client` 12.1 (on `ssh2`) | Apache-2.0 (`ssh2`: MIT, verify) |
| Netlify | REST API directly (`fetch`) or `@netlify/api` 15 | MIT |
| Cloudflare (later) | REST API or `wrangler` 4 | MIT OR Apache-2.0 |
| Credentials | Electron `safeStorage` | (built in) |

## Spike (2 days)
1. Netlify: OAuth from Electron (loopback), create site, digest deploy of an exported site, re-deploy with one changed file (only that file uploads), restore a previous deploy.
2. SFTP and FTPS to a test host: incremental upload via manifest; upload order; clean-up of removed files; cancel mid-way.
3. Netlify Forms detection on an API deploy; Formspree/Web3Forms plain-HTML POST with redirect to a thank-you page.
4. Credentials round trip through `safeStorage` on Windows and macOS.

## Decisions (2026-10-19)

| # | Topic | Decision |
|---|---|---|
| B1 | **MVP publish targets** | ✅ **Folder/ZIP, FTP/FTPS/SFTP, Netlify** |
| B2 | **Webforge Hosting / form relay** | **Not in MVP.** Possible paid add-on later; decision deferred |
| B3 | **Form services** | Built-in presets for the most widely used services + "Custom endpoint" (see below) |
| B4 | **Analytics** | **Google Analytics (GA4) supported** as a built-in option. Anything else goes through Custom HTML (C7) |
| B5 | **FTP security** | **Plain FTP allowed**; **FTPS / SFTP preferred**. Plain FTP shows a one-time warning that passwords and files are sent unencrypted, and suggests FTPS/SFTP if the host supports it ("Test connection" tries FTPS first) |
| B6 | **Form service presets** | ✅ **Formspree, Web3Forms, FormSubmit** as presets; **Netlify Forms** automatic on Netlify profiles; **Custom endpoint** for anything else (Basin, Formcarry, Forminit…) |
| B7 | **Consent scope** | **Consent banner covers analytics (GA4).** **Embeds (YouTube, Vimeo, Maps) use per-embed click-to-load placeholders** (05), which act as consent at the point of use. If a visitor clicks *"Accept all"* in the banner, embeds also load automatically. One small self-hosted script handles both |

## Form services (B3)

### Most widely used options (checked Oct 2026; verify pricing before launch)

| Service | Free tier | Paid from | Plain HTML form (no JS) | Notes |
|---|---|---|---|---|
| **Formspree** | 50 submissions/mo, unlimited forms, 30-day archive | $15/mo (200/mo) | ✅ `action="https://formspree.io/f/<id>"` | Best-known name; US hosting (AWS, SOC 2); reCAPTCHA optional |
| **Netlify Forms** | Included with Netlify hosting (credit-based plans since 2026) | Netlify plans | ✅ `data-netlify="true"` attribute, detected at deploy | Automatic when publishing to Netlify (B1); dashboard + email notifications; **verify detection on API deploys in the spike** |
| **Web3Forms** | **250/mo**, unlimited forms/domains, 30-day history | $49/yr | ✅ POST with an `access_key` hidden field | Most generous free tier; hCaptcha optional; GDPR-friendly claims (AWS) |
| **FormSubmit** | Free, **no sign-up**: first submission sends a confirmation email | — | ✅ `action="https://formsubmit.co/<email>"` | Fastest start; supports `_next` redirect, blacklist; reCAPTCHA on by default (we'd set `_captcha=false` and use our honeypot to stay script-free); fewer guarantees |
| **Basin** | 50/mo, 1 form | ~$12.50/mo (yearly) | ✅ | Lead/workflow features; overage billing instead of hard stop |
| **Formcarry** | 50/mo, 1 form | $5/mo (yearly) | ✅ | **EU hosting (Frankfurt)** |
| **Forminit** (formerly Getform, renamed Jan 2026) | 100/mo | $19/mo | ✅ | **EU data residency (AWS Ireland)** |

### Webforge implementation
- The **Form** component has a *"Send submissions to…"* setting, which offers:
  - **Netlify Forms** (only shown if the project has a Netlify publish profile)
  - **Formspree** (paste form ID)
  - **Web3Forms** (paste access key)
  - **FormSubmit** (enter email address)
  - **Custom endpoint** (any URL, e.g. Basin, Formcarry, Forminit, the user's own script)
- **Preset defaults:** Formspree, Web3Forms and FormSubmit, with Netlify Forms automatic on Netlify. Basin, Formcarry and Forminit are listed in help as alternatives (EU hosting) via Custom endpoint.
- Webforge outputs a **plain HTML `<form method="POST">`** with the right `action` and hidden fields for the chosen service. **No external JavaScript**, so self-contained output (C8) holds.
- **Spam:** our own honeypot field + minimum time-to-submit, mapped to each service's conventions. CAPTCHA widgets remain an opt-in allowed exception.
- **After submit:** redirect to a generated *Thank you* page using each service's redirect parameter (e.g. `_next`, `redirect`).
- **Help panel:** a short comparison (free limits, EU hosting) and links to sign up. A reminder that the user is responsible for their privacy policy.
- **Checks:** a form with no destination is a **warning on export** and an **error on publish** (X5).

## Google Analytics (B4)
- **Site Settings → Analytics:** enter a GA4 Measurement ID (`G-XXXXXXX`), with format validated.
- Webforge injects the standard `gtag.js` snippet on every page. This is the **one built-in allowed external script** under C8. It's listed as an approved exception, so the external-resource check doesn't flag it.
- **Cookie consent:** in the UK/EU, analytics cookies require visitor consent (ePrivacy/PECR, GDPR).
  - Webforge provides an optional **built-in consent banner**: self-hosted JS/CSS, styled with the site theme, text editable.
  - It works with **Google Consent Mode v2**: analytics storage is *denied* until the visitor accepts.
  - **On by default when GA is enabled**; can be turned off (the user's responsibility, with a help note).
- **Disabled automatically** in Webforge's live preview and when viewing the export from disk, so test views don't pollute statistics.
- Other analytics (Plausible, Matomo, Fathom…) go through **Custom HTML** (C7) and are reported by the external-resource check, which the user can allow per URL.

## Remaining open questions
1. **Webforge Hosting / form relay:** deferred business decision (B2).

## Sources
- Form services: [Formspree plans](https://formspree.io/plans) · [Web3Forms pricing](https://web3forms.com/pricing) · [FormSubmit](https://formsubmit.co/) · [Netlify Forms setup](https://docs.netlify.com/manage/forms/setup/) · [Free form backend comparison, June 2026 (MerginIT)](https://merginit.com/blog/24062026-free-form-backend-services-comparison)
- [Netlify API: get started (digest deploys, rollback, rate limits)](https://docs.netlify.com/api/get-started/)
- [Cloudflare: migrate from Pages to Workers static assets](https://developers.cloudflare.com/workers/static-assets/migrate-from-pages/) · [Cloudflare Pages vs Workers 2026](https://www.morphllm.com/comparisons/cloudflare-pages-vs-workers) · [Cloudflare Pages direct uploads](https://blog.cloudflare.com/cloudflare-pages-direct-uploads/)
- [GitHub Pages limits and prohibited uses](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Vercel Hobby plan: personal / non-commercial use only](https://conductatlas.com/platform/vercel/vercel-terms-of-service/provision/CA-P-048642/hobby-plan-personal-non-commercial-use-only/) · [Vercel fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines)
- [Form backends for static sites 2026](https://formgrid.dev/blog/the-best-form-backend-for-static-sites-in-2026) (written by a vendor; verify pricing) · [DEV: best form backend 2026](https://dev.to/allenarduino/the-best-form-backend-for-static-sites-in-2026-1fae)
- npm registry, 2026-10-19: basic-ftp 6.2.3 (MIT), ssh2-sftp-client 12.1.1 (Apache-2.0), @netlify/api 15.1.2 (MIT), wrangler 4.151.2
- Bootstrap Studio publishing precedent: [../bootstrap-studio/04-key-features.md](../bootstrap-studio/04-key-features.md)
