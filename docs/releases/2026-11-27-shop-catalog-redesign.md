Shop catalog redesign

Published https://sattarimusic.com/shop

Deployment: 6b0930f95f3353e84d48f09b
Rollback deployment: 6b092fc2284a2f0af8a26810
Source: branch claude/affectionate-keller-m67jwo at the commit "Redesign the shop catalog".

The 3D showroom stays as the hero. Below it the page uses the ink look of the Sattari tools: sticky category chips, then all 26 products grouped by category (cymbals, violins, guitar and bass, sticks, essentials) with a large photo, price and a visible add-to-cart button. The repair finder and the instrument and strings sections follow. This replaces the category list panel and the ten-item featured grid. Prices, stock, the cart and product pages are unchanged; category pages and product pages keep their existing look.

Started from the live shop at the owner's direction. The unpublished shop work on feat/shop-gallery-preview (gallery shelf, Pirouz filmstrip, new opening view) is not included and will conflict with this page.

Verification: 42 component test files pass, including the rewritten shop tests (26 products listed, sold-out control, colour products link to their page, quick add writes the cart). Guarded production build with the live catalog; SEO check passed on 332 pages. Manifest-preserving overlay with backend reuse: 436 files uploaded, no function uploads; 25 function digests and settings and 4 schedules match the previous deploy. Live checks: 6 routes return 200, inventory responds, /shop renders 26 cards in 5 groups on the ink background, and adding Pirouz Series Splash writes it to the cart, with no page errors.

Not verified: the 3D showroom itself in a real browser after this publish (the test browser cannot run it; its code is unchanged), and the page on a real phone.
