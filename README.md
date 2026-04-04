# Sattari Music Custom Site Starter

This is a React + Vite starter for rebuilding Sattari Music as a custom site in VS Code.

## Direction
- Homepage focused on drums
- Shop page for drum gear and small products
- Local Services page for repair, rentals, and local musician support
- Founder story and Instagram area brought forward on the homepage

## Run locally
```bash
npm install
npm run dev
```

## Cart + Stripe checkout

1. Copy [.env.example](.env.example) to `.env`.
2. Add your Stripe keys:
	- `VITE_STRIPE_PUBLISHABLE_KEY`
	- `STRIPE_SECRET_KEY`
3. Start both apps in separate terminals:

```bash
npm run dev
npm run dev:api
```

4. Open Stripe test mode and use a test card like `4242 4242 4242 4242`.

## Copilot prompt to paste into VS Code
Use this project as the starter for a premium dark music brand site called Sattari Music. Keep the site drum-first. Improve the visual polish with subtle motion, cleaner typography, stronger card design, and better spacing. Add a real About section on the homepage, replace placeholders with reusable data arrays, and prepare the shop cards to be powered by a CMS or Shopify later. Keep three routes only: Home, Shop, and Local Services. Add a mobile menu, scroll reveal animations with CSS or lightweight React logic, and a contact form on the Local Services page. Do not add unnecessary dependencies unless they clearly improve the site.

## Recommended next build steps
1. Replace placeholder text with final brand copy.
2. Add your real logo and product images.
3. Decide whether checkout will use Shopify, Stripe links, or manual inquiries.
4. Add Instagram embed or a curated gallery section.
5. Connect the service form to Formspree, Resend, Netlify Forms, or a custom backend.

## Content notes from the current site
- Current shop includes cymbals, hi-hats, practice pads, drumsticks, and accessories.
- Current About page mentions Woodland Hills, California and founder Mohammad Sattari with 30+ years of international performance experience.

Use that as source material, but tighten the messaging so the custom site feels more focused.
