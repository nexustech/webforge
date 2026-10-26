# Template photos: 2.15a (Café/Restaurant, Salon/Beauty, Trades)

**Status:** ✅ Decided (product owner, 26 Oct 2026; see *Decision* below). The approved photos replace the generated placeholders in the Café, Salon and Trades templates, as **960 px copies** for now, to be replaced by full-size ones later.
**Decision:** Q6, refined 26 Oct 2026 ([spec/04 §9](../../spec/04-implementation-plan.md#9-open-questions), [spec/02 §7](../../spec/02-mvp-spec.md)): templates ship with generated placeholders (CC0, made by `tools/src/template-placeholder.ts`), and each batch shortlists real CC0 or public-domain photos.

## How these were found
The same way as [stream C's shortlist](template-photos-c.md) and [2.15b's](template-photos-b.md):
- **Index:** [Openverse](https://openverse.org/)'s API with the licence filter set to CC0.
- **Source:** [StockSnap](https://stocksnap.io/license), which releases every photo under CC0.
- **Not downloaded:** only the results' metadata (title, author, size, page) was read. Nobody has looked at these photos yet, so a row whose photo turns out not to fit is dropped for its alternate at the swap.
- **Checks before the swap:** the swap PR opens each photo's page and records what it says in `images.json` (source URL, author, `CC0-1.0`). A photo whose page says otherwise is dropped for its alternate.

**People in photos.** CC0 covers the photographer's rights, not the rights of the person shown, so there is no model release. So:
- the team photos are hands at work, not faces: the café's barista and cook, the salon's stylist and beauty therapist, the electricians;
- hero and gallery photos show work in progress (a coffee being poured, a manicure, wiring in a box) where a photo of that exists;
- the rows that may show a client's or worker's face (Salon rows 1, 4, 6 and 8; Trades row 1's alternate) need the product owner's decision, and the generated ones can stay until a photo with a release is found.

## Café/Restaurant (The Copper Kettle)
| # | Placeholder (file, use) | Choice | Author | Licence | Alternate |
|---|---|---|---|---|---|
| 1 | `hero.png` (1:1), Home's Hero: breakfast and a flat white | [Coffee Cappuccino](https://stocksnap.io/photo/coffee-cappuccino-9QUVG8OY1I) (5785×3862) | Vicky Gu | CC0 (StockSnap) | [Breakfast Coffee](https://stocksnap.io/photo/breakfast-coffee-RP8PNGWAZK) (5701×3781), Tomasz Gawłowski |
| 2 | `breakfast.png` (4:3), Gallery: a full breakfast with sourdough toast | [Breakfast Food](https://stocksnap.io/photo/breakfast-food-OC8WX0E0X3) (2509×1673): eggs, bacon, bread | Ali Inay | CC0 (StockSnap) | [Fried Egg](https://stocksnap.io/photo/fried-egg-7TZ228CGEN) (4197×3148), Pawel Kadysz |
| 3 | `cake.png` (4:3), Gallery: a slice of lemon drizzle cake | [Slice Cake](https://stocksnap.io/photo/slice-cake-EQRBUSHVRN) (6000×4000): a citrus cake | Foodie Girl | CC0 (StockSnap) | [Cake Dessert](https://stocksnap.io/photo/cake-dessert-QBHWAXIHDI) (4288×2848), YFBI |
| 4 | `coffee.png` (4:3), Gallery: a flat white with latte art | [Coffee Art](https://stocksnap.io/photo/coffee-art-GZCFF9JJE7) (4200×2779) | Elliott Chau | CC0 (StockSnap) | [Coffee Latte](https://stocksnap.io/photo/coffee-latte-JCNHQ3V8RU) (5184×3456), Matt Hoffman |
| 5 | `lunch.png` (4:3), Gallery: a bowl of tomato soup with bread | [Bowl Soup](https://stocksnap.io/photo/bowl-soup-WOZ7PQGMMI) (6000×4000): homemade soup with bread | Foodie Girl | CC0 (StockSnap) | [Soup Broth](https://stocksnap.io/photo/soup-broth-F8CED10668) (5472×3648), JESHOOTS.com |
| 6 | `riverside.png` (4:3), About: TextImage, the café's tables | [Tables Chairs](https://stocksnap.io/photo/tables-chairs-P15VNVN9KB) (5760×3840): a terrace | Leeroy | CC0 (StockSnap) | [French Restaurant](https://stocksnap.io/photo/french-restaurant-EQVWRV7CPF) (4896×3264), Julien Sister |
| 7 | `hannah.png` (1:1), Team: "Hannah, who runs the café" | [Barista Pouring](https://stocksnap.io/photo/barista-pouring-MD4L58LL1E) (4135×2757), hands at the machine | Burst | CC0 (StockSnap) | [Coffee Cafe](https://stocksnap.io/photo/coffee-cafe-ICUFSN4V4U) (5472×3078), Tim Wright |
| 8 | `sam.png` (1:1), Team: "Sam, the café's cook" | [Chef Cook](https://stocksnap.io/photo/chef-cook-J2W0D3CO2L) (4687×2750), hands plating a dish | Fabrizio Magoni | CC0 (StockSnap) | [Food Cook](https://stocksnap.io/photo/food-cook-1CB40GCIFG) (4896×3264), Timur Saglambilek |

**The menu photos don't have to match exactly.** StockSnap has no CC0 "lemon drizzle cake" or "tomato soup", and no café by a river. Rows 3, 5 and 6 are the closest that read right (a citrus cake, a bowl of soup with bread, a café terrace), and the captions can change to fit the photos chosen ("a slice of our citrus cake", "today's soup with bread"). A café owner replaces these with their own food anyway.

## Salon/Beauty (Willow Hair & Beauty)
| # | Placeholder (file, use) | Choice | Author | Licence | Alternate |
|---|---|---|---|---|---|
| 1 | `hero.png` (1:1), Home's Hero: hair being styled | [Hairdresser Cut](https://stocksnap.io/photo/hairdresser-cut-S7UEWWIRTD) (8256×5504), may show the client's face | Matt Moloney | CC0 (StockSnap) | [Blonde Hair](https://stocksnap.io/photo/blonde-hair-I1O9OZLVCS) (5471×3641), Ariel Lustre |
| 2 | `salon.png` (4:3), About: TextImage, styling chairs and mirrors | [Beauty Salon](https://stocksnap.io/photo/beauty-salon-0AA03E91E8) (5760×3840) | Leeroy | CC0 (StockSnap) | [Barbershop Chair](https://stocksnap.io/photo/barbershop-chair-7M505B7MYV) (4623×3068), Skitter Photo |
| 3 | `work-1.png` (4:5), Gallery: a soft balayage on long hair | [People Female](https://stocksnap.io/photo/people-female-JJ4YYCPZ1Y) (2002×3000), long hair from behind | Suhyeon Choi | CC0 (StockSnap) | [Blonde Hair](https://stocksnap.io/photo/blonde-hair-HDZE2J2VNL) (5184×3456), Alex Holyoake |
| 4 | `work-2.png` (4:5), Gallery: a short, textured cut | [Barber Cutting](https://stocksnap.io/photo/barber-cutting-O6KYUCUFY4) (4000×5000): a short cut in progress, may show a face | Nick Demou | CC0 (StockSnap) | [Fashion Model](https://stocksnap.io/photo/fashion-model-X1FOJTVTIQ) (2614×3928), Daria Shevtsova |
| 5 | `work-3.png` (4:5), Gallery: gel nails in pale pink | [People Hands](https://stocksnap.io/photo/people-hands-XX356Q6EI4) (5259×3506): a manicure in progress, hands only | Freestocks.org | CC0 (StockSnap) | [Nailpolish Nailvarnish](https://stocksnap.io/photo/nailpolish-nailvarnish-V2JTH0ST4Y) (6000×3376), Suzy Hazelwood |
| 6 | `work-4.png` (4:5), Gallery: shaped brows / eye make-up | [Eye Closeup](https://stocksnap.io/photo/eye-closeup-LXZ77IYCTB) (6000×4000), one eye only | Lisa Fotios | CC0 (StockSnap) | [Woman Makeup](https://stocksnap.io/photo/woman-makeup-AOLBB3P8AH) (2000×1333), Matt Moloney |
| 7 | `ella.png` (1:1), Team: "Ella, senior stylist" | [Hair Cut](https://stocksnap.io/photo/hair-cut-ASMG0XOU6M) (2304×3456), hands with comb and scissors | Candace McDaniel | CC0 (StockSnap) | [Barbershop Scissors](https://stocksnap.io/photo/barbershop-scissors-R9YRHH2JQY) (6000×4000), Nick Demou |
| 8 | `maya.png` (1:1), Team: "Maya, colourist" | [Hair Curls](https://stocksnap.io/photo/hair-curls-R6CKAMVOMZ) (4368×2912): a stylist putting in rollers, may show a face | Markus Spiske | CC0 (StockSnap) | [Beauty Makeup](https://stocksnap.io/photo/beauty-makeup-34MSYVUYS0) (5472×3648), Alexandre Vanier |
| 9 | `jess.png` (1:1), Team: "Jess, beauty therapist" | [Woman Makeup](https://stocksnap.io/photo/woman-makeup-2XXA0XX9G0) (5472×3648), hands holding brushes | EVG Photos | CC0 (StockSnap) | [People Hands](https://stocksnap.io/photo/people-hands-5M4DNCN8ZW) (5218×3479), Freestocks.org |

**The gallery's captions can change to fit the photos.** StockSnap has few salon photos, and none of a balayage, pale pink gel nails or brows being shaped. Rows 3–6 are the closest (long hair from behind, a short cut at the barber's, a manicure, an eye close-up), and the swap PR rewords each caption to what its photo shows. There is no photo of colour being applied, so Maya's row is a stylist at work and its alternate is a make-up palette, not a portrait.

## Trades (Brightside Electrical)
| # | Placeholder (file, use) | Choice | Author | Licence | Alternate |
|---|---|---|---|---|---|
| 1 | `hero.png` (1:1), Home's Hero: an electrician at work | [Electricity Switches](https://stocksnap.io/photo/electricity-switches-6Y6VEZPDC1) (4256×2832), hands wiring a box | Michal Jarmoluk | CC0 (StockSnap) | [Electrician Electricity](https://stocksnap.io/photo/electrician-electricity-3A5FXM89OG) (3246×2160), same author, shows the electrician |
| 2 | `job-1.png` (4:3), Gallery: a kitchen with under-cabinet lights | [Farmhouse Kitchen](https://stocksnap.io/photo/farmhouse-kitchen-QSX4WH8BDB) (6000×4000) | Matt Bango | CC0 (StockSnap) | [House Home](https://stocksnap.io/photo/house-home-9G5X445AP9) (4584×3056), WDnet Studio |
| 3 | `job-2.png` (4:3), Gallery: an electric car charging | [Plugs Sockets](https://stocksnap.io/photo/plugs-sockets-IKTONP88LJ) (5760×3840): plugs in a wall socket | Markus Spiske | CC0 (StockSnap) | [Electrical Plug](https://stocksnap.io/photo/electrical-plug-A1V4IH8B1W) (8192×5464), Design by Matt |
| 4 | `job-3.png` (4:3), Gallery: garden lights along a path at dusk | [Patio Outdoor](https://stocksnap.io/photo/patio-outdoor-ISWZOYDFU7) (7681×5123): a patio at dusk | Matt Bango | CC0 (StockSnap) | [Lantern Plants](https://stocksnap.io/photo/lantern-plants-RRHZANVQZM) (6000×4000), Lisa Fotios |
| 5 | `job-4.png` (4:3), Gallery: a fuse box | [Breaker Electrical](https://stocksnap.io/photo/breaker-electrical-880CF4B98B) (3089×2048): labelled breakers | Jay Mantri | CC0 (StockSnap) | [Wires Electrical](https://stocksnap.io/photo/wires-electrical-63670C8E97) (5857×3905), Ryan McGuire |
| 6 | `job-5.png` (4:3), Gallery: spotlights in a bathroom ceiling | [Modern Bathroom](https://stocksnap.io/photo/modern-bathroom-SX2H0BU5EG) (4016×6016), portrait, crops to 4:3 | Travel Adventures | CC0 (StockSnap) | [Indoor Lighting](https://stocksnap.io/photo/indoor-lighting-TYUJHJEZGO) (5080×3386), Photo ZIBIK |
| 7 | `job-6.png` (4:3), Gallery: outdoor sockets / a patio | [Patio Furniture](https://stocksnap.io/photo/patio-furniture-6CA109EECC) (3089×2048): a deck with string lights | Jay Mantri | CC0 (StockSnap) | [Electrical Outlets](https://stocksnap.io/photo/electrical-outlets-ZE54KB2ZLQ) (8192×5464), Design by Matt |
| 8 | `van.png` (4:3), About: TextImage, a work van outside a house | [Transportation Van](https://stocksnap.io/photo/transportation-van-6PV7L7ZC8F) (4669×3113): a van parked in a residential street | Matt Jones | CC0 (StockSnap) | [Yellow Van](https://stocksnap.io/photo/yellow-van-7FE5X3X85R) (4032×2683), Remy_Loz |
| 9 | `dan.png` (1:1), Team: "Dan, electrician and owner" | [Electricity Switches](https://stocksnap.io/photo/electricity-switches-81EG7NOR4G) (3433×2285), hands at work | Michal Jarmoluk | CC0 (StockSnap) | [Tools Hammer](https://stocksnap.io/photo/tools-hammer-6K150QNG2N) (5472×3648), Taduuda |
| 10 | `priya.png` (1:1), Team: "Priya, electrician" | [Cables Wires](https://stocksnap.io/photo/cables-wires-NTBTAJYIOK) (4256×2832), hands at an outlet | Michal Jarmoluk | CC0 (StockSnap) | [Handyman Tools](https://stocksnap.io/photo/handyman-tools-UUUGZVEU0R) (8160×6120), The World is a Stage |

**The jobs' captions can change to fit the photos.** StockSnap has no CC0 photo of an electric car charging or a wall charger (searches for "electric car", "electric vehicle", "charging", "charger" and "tesla" found phones and batteries), so row 3 is a wall socket and its caption becomes something like "New sockets throughout a house"; the product owner may prefer to keep the generated picture there until a CC0 charger photo turns up. Rows 2, 4, 6 and 7 show the room or garden rather than the fitting itself (a kitchen, a patio at dusk, a bathroom ceiling, a deck with string lights), and the swap PR rewords those captions to match. The hero and Dan's photo are from one series by the same author; Dan's alternate is from another, if the two look too alike side by side.

## Decision (product owner, 26 Oct 2026)
1. **Photos.** The first choice in every row, except four alternates:
   - Café 2: Fried Egg, Pawel Kadysz.
   - Café 8: Food Cook, Timur Saglambilek.
   - Salon 2: Barbershop Chair, Skitter Photo.
   - Salon 3: Blonde Hair, Alex Holyoake.
2. **Portraits.** The rows that may show a face (Salon 1, 4, 6 and 8) use their first choices.
   - **Trades 5 (the fuse box) keeps its generated picture.** Both its first choice (Breaker Electrical) and its alternate (Wires Electrical) have been taken down from StockSnap since the shortlist: their pages now redirect to StockSnap's home page, so neither still says CC0. Openverse still lists them. The full-size swap can look for another photo.
3. **Captions and alt text** are reworded to fit each photo, Trades 3's socket included:

   | Template | Gallery captions now |
   |---|---|
   | Café | Eggs and seeded toast, Lemon cake, every day |
   | Salon | Soft blonde ends, A short, sharp cut, Manicures, Lashes and eye make-up |
   | Trades | Kitchen rewire, New sockets, Patio power, Bathroom refit, Outdoor power (New fuse box stays) |

   Every image's alt text now describes its photo.

### How they were fetched
- **Only a 960 px copy.** StockSnap's pages and image CDN put scripted requests through a Cloudflare challenge, which isn't to be got around. Openverse's API serves each photo's 960-pixel-wide copy. The product owner chose to use these for now (26 Oct 2026), with full-size photos later.
- **Not upscaled.** Each photo is cropped to its placeholder's shape at the largest size its copy allows, so the photos are smaller than the placeholders:
  - squares: 640 px, against the 800–1200 px placeholders;
  - 4:3: about 850 × 640, against 1000 × 750 or 1200 × 900;
  - 4:5 from landscape photos: 512 × 640.
- **Licence check.** Openverse lists each photo as CC0 1.0. All 26 photos used have StockSnap pages that, opened in a browser on 26 Oct 2026, still say CC0.
- **What `images.json` records:** the StockSnap page as each image's source, with the Openverse record it was fetched through, plus its author and `CC0-1.0`.
