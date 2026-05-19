# Sattari Music - Modernized E-Commerce Platform

A cutting-edge, production-ready e-commerce website for Sattari Music featuring handcrafted drum gear, local services, and Stripe payments integration.

## ✨ Features

### Core Functionality
- **Product Catalog** - Browse cymbals, drumsticks, and essentials with detailed information
- **Shopping Cart** - Add/remove items with persistent local storage
- **Stripe Checkout** - Secure payment processing with phone and billing address collection
- **Local Services** - Inquire about repairs, rentals, and musician services
- **Instagram Integration** - Display product highlights from Instagram feed

### Modern Stack
- ⚡ **Vite** - Lightning-fast build tool and dev server
- ⚛️ **React 18** - Latest React with hooks
- 📘 **TypeScript** - Full type safety across the codebase
- 🎨 **CSS with Design Tokens** - Scalable, maintainable styling
- 🔍 **SEO-Ready** - Meta tags, structured data, sitemaps
- ♿ **Accessible** - WCAG 2.1 compliant, keyboard navigation
- 🚀 **Performance** - Code splitting, lazy loading, image optimization
- 🛡️ **Error Tracking** - Sentry integration for production monitoring
- 🧪 **Testing** - Vitest setup for unit tests
- 🔐 **Environment Management** - Secure API key handling
- 📦 **Order Persistence** - Completed Stripe orders stored durably for fulfillment
- ✉️ **Optional Notifications** - Business email alerts when new paid orders or service inquiries arrive

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Stripe account (for payments)

### Installation

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your Stripe keys and configuration
```

### Development

```bash
# Start dev server (frontend)
npm run dev

# In another terminal, start checkout server
npm run dev:api

# Frontend runs at http://localhost:5173
# API server runs at http://localhost:4242
```

### Verify the baseline

```bash
# Run the current quality gates
npm run type-check
npm run lint
npm test
npm run build
```

### Build

```bash
npm run build
```

## 📁 Project Structure

```
src/
├── components/        # React components
├── pages/            # Route pages
├── context/          # React Context (Cart)
├── data/             # Static data (catalog)
├── utils/            # Utilities (Stripe, SEO)
├── types/            # TypeScript definitions
├── App.tsx           # Main component
├── main.tsx          # Entry point
└── styles*.css       # Styles with design tokens

server/
└── checkout-server.js   # Express checkout API

public/
├── robots.txt        # SEO
└── sitemap.xml       # SEO
```

## 🎨 Design System

### Color Tokens
- `--bg`: Dark background (#0a0a0b)
- `--text`: Primary text (#f5f5f2)
- `--accent`: Gold accent (#d6b36d)
- `--error`: Error red (#ff3b30)
- `--success`: Success green (#34c759)

### Responsive
- Mobile-first design
- Breakpoints: 600px, 860px
- Fluid typography with clamp()

## 🔐 Security

**API Keys:**
- `.env` never committed to git
- Use `.env.example` as template
- Stripe secret keys backend-only
- Public keys safe for frontend

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...  # Frontend
STRIPE_SECRET_KEY=sk_...                 # Backend only
```

## 🧪 Testing & Quality

```bash
npm run type-check   # TypeScript checking
npm run lint         # ESLint
npm run lint:fix     # Auto-fix issues
npm run test         # Run Vitest in non-watch mode
npm run test:ui      # Test dashboard
```

Current baseline:
- `npm run type-check` passes
- `npm run lint` passes
- `npm test` passes with smoke tests for catalog and checkout utilities
- `npm run build` passes

## 🚀 Deployment

### Netlify

1. Connect GitHub repository to [Netlify](https://netlify.com)
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Set environment variables in Site settings
5. Use the built-in Netlify Function for checkout or provide `VITE_CHECKOUT_URL` for an external checkout API
6. Follow [NETLIFY_STRIPE_LAUNCH_CHECKLIST.md](NETLIFY_STRIPE_LAUNCH_CHECKLIST.md) before going live

### Environment Variables for Production
```
VITE_STRIPE_PUBLISHABLE_KEY
VITE_SENTRY_DSN
VITE_CHECKOUT_URL (optional external checkout endpoint)
VITE_CHECKOUT_STATUS_URL (optional external status verification endpoint)
VITE_API_URL (optional fallback checkout server URL)
STRIPE_SECRET_KEY (required for Netlify function checkout)
STRIPE_WEBHOOK_SECRET (required for Stripe webhook verification)
RESEND_API_KEY (optional for order notification and service inquiry emails)
ORDER_NOTIFICATION_EMAIL (optional paid-order notification recipient)
ORDER_NOTIFICATION_FROM (optional verified sender address for order/service emails)
SERVICE_INQUIRY_TO (optional service inquiry recipient; falls back to ORDER_NOTIFICATION_EMAIL)
SERVICE_INQUIRY_FROM (optional verified sender for service inquiries; falls back to ORDER_NOTIFICATION_FROM)
ORDER_LOOKUP_TOKEN (optional admin token for querying stored orders)
```

## 📊 Monitoring

**Error Tracking:** Setup Sentry
1. Create account at [sentry.io](https://sentry.io)
2. Create React project
3. Add DSN to `.env.example` and production environment

## 🔄 API Integration

**Checkout Flow:**
1. User adds items to cart
2. Clicks checkout
3. Frontend → `POST /api/create-checkout-session`
4. Backend creates Stripe session
5. User redirected to Stripe Checkout
6. After payment: redirect to success/cancel page with Stripe session ID
7. Frontend verifies the session server-side via `GET /api/checkout-session-status`
8. Stripe sends `checkout.session.completed` to `/api/stripe-webhook`
9. Completed orders are persisted and can trigger an optional business email alert
10. Admins can inspect stored orders through a token-protected `/api/admin/orders` endpoint

## 📱 Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## 📝 Changelog

**v1.0.0** (April 23, 2026)
- TypeScript migration
- ESLint & Prettier setup
- Vitest testing framework
- Sentry error tracking
- SEO enhancements (Helmet, structured data, robots.txt, sitemap)
- Enhanced CSS design tokens
- Accessibility improvements
- Performance optimizations (code splitting, lazy loading)
- Comprehensive documentation

---

**Last Updated:** April 23, 2026

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
    - `STRIPE_WEBHOOK_SECRET` (for verified webhook processing)
    - `RESEND_API_KEY`, `ORDER_NOTIFICATION_EMAIL`, `ORDER_NOTIFICATION_FROM` (optional order alerts)
    - `SERVICE_INQUIRY_TO`, `SERVICE_INQUIRY_FROM` (optional service inquiry recipient/sender; fall back to the order notification env vars)
3. Start both apps in separate terminals:

```bash
npm run dev
npm run dev:api
```

4. Open Stripe test mode and use a test card like `4242 4242 4242 4242`.

## Service inquiry emails

The Local Services form posts to `/api/service-inquiry`, which is served by `netlify/functions/service-inquiry.js` through the Netlify rewrite in `netlify.toml`.

Required to send inquiry emails:
- `RESEND_API_KEY`
- `SERVICE_INQUIRY_TO` or `ORDER_NOTIFICATION_EMAIL`
- `SERVICE_INQUIRY_FROM` or `ORDER_NOTIFICATION_FROM` (must be a Resend-verified sender/domain)

The function validates `service`, `name`, `email`, and `details`, returns clear `400` errors for malformed submissions, and returns a configuration error if email delivery is not set up. The React form captures non-2xx and thrown submission errors in Sentry before showing the user-facing error state.

## Admin order lookup

When `ORDER_LOOKUP_TOKEN` is configured, you can inspect stored orders with:

```bash
# Recent order summaries
curl -H "Authorization: Bearer $ORDER_LOOKUP_TOKEN" \
	https://your-domain.com/api/admin/orders

# One full order by Stripe checkout session ID
curl -H "Authorization: Bearer $ORDER_LOOKUP_TOKEN" \
	"https://your-domain.com/api/admin/orders?session_id=cs_test_123"
```

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
