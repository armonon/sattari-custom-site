Showroom experience overhaul

The store image remains visible during download and preparation, then crossfades into the live Gaussian scene. Loading uses a small truthful progress pill instead of an obstructive modal with implementation details.

The visual system uses system sans typography, neutral frosted glass, rounded touch targets and a lighter catalog. Selected instrument details include a sticky four-way switcher; changing instruments no longer forces a page scroll. Back restores category focus without scrolling the focused element into view and smoothly returns to the scene.

Wheel and touch gestures scroll the page instead of zooming or panning the camera. Camera movement remains driven by selection and return. The removed playback/zoom toolbar remains absent. Reduced motion, loading retry, inventory, cart and keyboard navigation remain supported.

Validation:53 focused tests, including direct switching without recreating the scene or scrolling the page, and a renderer regression asserting wheel gestures are not prevented. Types and targeted lint pass. Desktop1440x900 and phone390x844 visually checked. Production build passed:91 canonical routes and service-worker generation. Published deployment6b08cf4cc8a32d5e551a978e at https://sattarimusic.com/shop. Rollback deployment6b08ccb48002d6f724ba8aaa. Verified87 changed assets/page files and2368 retained static files;25 backend function digests,4 schedules and edge bundle preserved. Live browser reports no console errors; inventory remains healthy with strong consistency.
