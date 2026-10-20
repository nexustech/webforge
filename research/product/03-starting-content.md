# Starting Content: Components, Templates, Themes, Fonts

**Status:** ✅ Decided 2026-10-19 (S1–S5)
**Context:**
- **Users:** DIY small-business owners (T1)
- **No house look:** sites must look distinct (05)
- **Components:** daisyUI-based, static, accessible (05)
- **Install size:** installer ≤ 150 MB target ([architecture §10](../../spec/01-architecture.md#10-performance-targets))
- **Testing:** every component tested across themes and devices via Storybook ([standards](../../spec/03-engineering-standards.md))

## 1. Components (sections + elements)

| Option | Contents | Effort (build + stories + a11y + tests) | Test matrix (× 3 themes × 2 devices) | Fit |
|---|---|---|---|---|
| **A. Lean** | ~10 sections (Header, Footer, Hero, Text, Text+Image, Features, Gallery, Testimonials, Contact form, CTA) + ~10 elements | Lowest | ~120 screenshots | Covers basic brochure sites; users hit gaps quickly (no FAQ, pricing, hours, team) |
| **B. Standard** ⭐ (as proposed in the MVP spec) | **18 sections** + **16 elements**; key sections have **2–4 layout variants** (e.g. Hero: centred, split, image background, minimal) → **~45 section designs** | Medium | ~200 screenshots | Covers what small-business sites actually need: hours, prices, FAQ, team, map, buy buttons |
| **C. Rich** | B + carousel/slider, timeline, before/after, newsletter signup, countdown, tables, pricing comparison, stats counters, video background, tabs/accordion variants… (50+ components) | High; delays MVP | 300+ screenshots | Impressive, but more to maintain; several items need more JS |

**Recommendation: B, growing through layout variants rather than new component types.** Variants give visual variety (no house look) at much lower cost than new components, since one component's options and accessibility work cover all its layouts.

## 2. Templates (ready-made starting sites)

Each template = 3–5 pages, realistic sample text, images, chosen theme and font pairing. Rough effort: **2–4 days each** (design, copy, images, QA).

| Option | Count | Examples | Notes |
|---|---|---|---|
| A. Minimal | 3 + Blank | Business, Portfolio, Personal | Fast to ship; weak first impression on the start screen |
| **B. Core verticals** ⭐ | **8 incl. Blank** | Café/Restaurant, Salon/Beauty, Trades/Home services, Consultant/Professional, Photographer/Portfolio, Shop (Buy buttons), Personal/CV, Blank | Matches the persona's businesses; ~3–5 weeks of content work; can run in parallel with engineering |
| C. Broad | 15–20 | B + Fitness/Yoga, Clinic/Therapist, Event/Wedding, Non-profit, Real estate, Musician/Band, Agency, Landing page… | Strong marketing; heavy content/QA load before launch |

**Recommendation: B at launch, then add 2–4 templates per release** (cheap once the components are stable).

**Image licensing for templates (paid product, C1):**
- Use photos we can **redistribute inside a commercial product**: commissioned photos, CC0 sources, or stock with an explicit redistribution licence.
- **Check carefully:** popular free-photo licences (e.g. Unsplash, Pexels) allow commercial use but restrict compiling photos into a similar/competing service. Bundling them in a template library needs legal review.
- Alternative: abstract/illustrative images we create, plus clear "replace this image" placeholders.

## 3. Themes

daisyUI 5 ships **35 built-in themes**. Several are novelty styles (e.g. Halloween, Cyberpunk, Valentine, Aqua) that don't suit most small businesses.

| Option | What users get | Pros | Cons |
|---|---|---|---|
| A. All 35 daisyUI themes | Big list | Zero design work | Many unsuitable; looks generic ("daisyUI look"); inconsistent quality |
| **B. Curated Webforge themes** ⭐ | **10–12 hand-tuned themes**: colours, **font pairing**, corner style, spacing, button style; light + dark variants | Distinct, professional, consistent; supports "no house look" | Design work: ~1–2 days per theme incl. contrast checks |
| C. Curated + extras | B + selected daisyUI themes under "More themes" (marked playful) | Choice for those who want it | More to test; mixed quality |

**Every theme is a starting point.** Users adjust **brand colours, fonts, roundness and spacing** (F-DS-2), so a small curated set still yields endless variety. Contrast checks keep text readable (WCAG AA).

**Recommendation: B (10–12 curated) at launch.** Option C later if users ask. Visual regression runs every component on **3 representative themes** (light, dark, high-contrast/rounded) rather than all of them; full-theme screenshots run nightly.

## 4. Fonts

**Measured (Fontsource, Oct 2026):** one variable font family covering Latin + Latin Extended is roughly **60–130 KB** (e.g. Inter ≈ 133 KB, Playfair Display ≈ 60 KB). With italics, about **≤ 250 KB per family**. Exported sites include only the fonts and weights actually used.

| Option | Bundled in installer | Installer cost | Offline? | Choice |
|---|---|---|---|---|
| A. 30 curated families | 30 | ~7 MB | ✅ | Limited but tidy |
| **B. ~40–60 curated families + on-demand catalogue** ⭐ | 40–60 (incl. **12–15 tested pairings**) | ~10–15 MB | ✅ for bundled; on-demand fonts download **once at design time** into a local cache, then work offline | **Full Google Fonts catalogue (~1,900 families)** available on demand |
| C. ~100 families bundled | 100 | ~25 MB | ✅ | Large list; overwhelming without good curation |
| D. Whole catalogue bundled | ~1,900 | Hundreds of MB | ✅ | ❌ Breaks the installer budget |

On-demand fonts are fetched from npm/Fontsource **by the editor at design time** and are still **self-hosted in the exported site** (C8 holds; nothing loads from Google at visitor time).

**Licence rule:** the catalogue build includes only fonts with **OFL, Apache-2.0 or Ufl** licences (Fontsource metadata records each font's licence), so they can be redistributed inside exported sites.

**Recommendation: B.** Bundle ~50 curated families with 12–15 tested **font pairings** (heading + body), shown as the primary choice. Add "Browse all fonts" for the on-demand catalogue.

## Summary of recommendations

| Area | Recommendation | Launch scope |
|---|---|---|
| Components | **B. Standard** | 18 sections (~45 layout variants) + 16 elements |
| Templates | **B. Core verticals** | 8 incl. Blank; +2–4 per release |
| Themes | **B. Curated** | 10–12 Webforge themes (light + dark) |
| Fonts | **B. Curated + on demand** | ~50 bundled, 12–15 pairings, full catalogue on demand |

## Decisions (2026-10-19)
| # | Area | Decision |
|---|---|---|
| S1 | Components | **B. Standard:** 18 sections (~45 layout variants) + 16 elements; grow via layout variants. **Extended by GA1** ([gap analysis](05-feature-gap-analysis.md)): 19 sections (+ Newsletter signup) and 17 elements (+ Carousel) |
| S2 | Templates | **B. 8 templates** (Café/Restaurant, Salon/Beauty, Trades/Home services, Consultant/Professional, Photographer/Portfolio, Shop, Personal/CV, Blank); +2–4 per release |
| S3 | Themes | **B. 10–12 curated Webforge themes** (light + dark); visual regression on 3 representative themes per PR, all themes nightly |
| S4 | Fonts | **B. ~50 bundled families + 12–15 tested pairings + on-demand Fontsource catalogue** (OFL/Apache/UFL only) |
| S5 | Template images | **Public-domain (CC0) and free stock photos** for now; **legal review of stock licences deferred** (revisit before launch if required). Track each image's source and licence in a manifest so images can be swapped if needed |
