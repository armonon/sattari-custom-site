export const categories = [
  {
    title: 'Cymbals',
    description: 'Signature Sattari cymbals, hi-hats, and splashes for every style and level.',
    key: 'cymbals',
  },
  {
    title: 'Sticks',
    description: 'Classic hickory drumsticks, bundles, and specialty sticks for all drummers.',
    key: 'sticks',
  },
  {
    title: 'Essentials & Accessories',
    description: 'Practice pads, cymbal felts, bags, and must-have accessories for your kit.',
    key: 'essentials',
  },
  {
    title: 'Violins',
    description:
      'Handcrafted SATTARI acoustic, electric, and silent violins — individually fitted and tuned in California.',
    key: 'violins',
  },
  {
    title: 'Guitar & Bass',
    description:
      'Electric and acoustic guitars, bass, and guitar accessories — set up and shipped from California.',
    key: 'guitar-bass',
  },
];

export const products = [
  {
    id: 'pirouz-series-cymbals',
    name: 'Pirouz Series Cymbals',
    slug: 'pirouz-series-cymbals',
    category: 'cymbals',
    description:
      'A handcrafted crash cymbal from the Sattari Pirouz Series — forged for drummers who want a cymbal with character, not just volume. Warm attack, medium sustain, and a controlled decay that cuts through a mix without overpowering it. Built and finished by hand in small batches, so each one carries a slightly different voice. A strong choice for rock, jazz, and studio work.',
    price: 80.0,
    image: '/sattari site/crash.png',
    specs: [
      'Type: crash cymbal',
      'Series: Pirouz',
      'Construction: handcrafted, hand-hammered and lathed',
      'Finish: hand-buffed traditional finish',
    ],
  },
  {
    id: 'pirouz-series-splash',
    name: 'Pirouz Series Splash',
    slug: 'pirouz-series-splash',
    category: 'cymbals',
    description:
      'The Pirouz Series Splash is a handcrafted accent cymbal built for quick, articulate response. Fast attack and short sustain make it ideal for punctuating fills, ghost notes, and anything that calls for a sharp accent without lingering overtones. Pairs naturally with the Pirouz crash for a matched set.',
    price: 45.0,
    image: '/sattari site/crash.png',
    specs: [
      'Type: splash cymbal',
      'Series: Pirouz',
      'Construction: handcrafted, hand-hammered and lathed',
      'Character: fast attack, short sustain',
    ],
  },
  {
    id: '4-pair-drumsticks-free-bag',
    name: '4 Pairs of Drumsticks +FREE BAG',
    slug: '4-pair-drumsticks-free-bag',
    category: 'sticks',
    description:
      'Buy 4 Pairs of any SATTARI Drumsticks and get a FREE bag. Includes American Hickory 5A, American Hickory 7A, Premium Maple Blue 5A, Premium Maple Purple 7A, Premium Maple Nylon 5A.',
    price: 29.99,
    image: '/sattari site/sticks.png',
    specs: [],
  },
  {
    id: 'classic-american-hickory-a7',
    name: 'Classic American Hickory A7',
    slug: 'classic-american-hickory-a7',
    category: 'sticks',
    description:
      'A7 drumsticks turned from American hickory — a dense, durable hardwood with excellent rebound and low flex. The 7A taper is slimmer and lighter than a 5A, making it a popular choice for jazz, lighter rock, and drummers who want better control and less fatigue over a long set. Sharp cymbal definition without excessive volume.',
    price: 7.0,
    image: '/sattari site/sticks.png',
    specs: [
      'Size: 7A',
      'Wood: American hickory',
      'Tip: wood tip',
      'Best for: jazz, lighter playing styles, high cymbal definition',
    ],
  },
  {
    id: 'classic-american-hickory-a5',
    name: 'Classic American Hickory A5',
    slug: 'classic-american-hickory-a5',
    category: 'sticks',
    description:
      'A5 drumsticks turned from American hickory — the most versatile and widely used size in drumming. Balanced weight and length make these suitable across rock, pop, funk, and everything in between. American hickory absorbs shock well, which means less fatigue and a more consistent feel through long sessions. A dependable all-around choice.',
    price: 7.0,
    image: '/sattari site/sticks.png',
    specs: [
      'Size: 5A',
      'Wood: American hickory',
      'Tip: wood tip',
      'Best for: rock, pop, funk, all-around use',
    ],
  },
  {
    id: 'classic-maple-5a-nylon-tip',
    name: 'Classic Maple 5A w/Nylon Tips',
    slug: 'classic-maple-5a-nylon-tip',
    category: 'sticks',
    description:
      'Maple 5A drumsticks with nylon tips. Maple is lighter than hickory, which makes these sticks faster and easier to play at higher tempos — and the nylon tip adds a brighter, more articulate response on cymbals compared to a wood tip. A favourite for drummers who want quick movement and crisp ride/hi-hat definition. Available in color finishes.',
    price: 7.99,
    image: '/sattari site/sticks.png',
    specs: [
      'Size: 5A',
      'Wood: North American maple',
      'Tip: nylon',
      'Best for: fast playing, bright cymbal response, jazz and pop',
    ],
  },
  {
    id: 'cymbal-felts',
    name: 'Cymbal Felts',
    slug: 'cymbal-felts',
    category: 'essentials',
    description:
      'SATTARI cymbal felts in a distinctive red finish — the felt washers that sit between your cymbal and the stand wing nut, protecting the bell and letting the cymbal move freely. Worn felts muffle sustain and can crack a cymbal over time; fresh ones restore the natural swing. A simple upgrade most drummers forget until something breaks.',
    price: 6.99,
    image: '/sattari site/drums/cymbal-felts.jpg',
    gallery: [
      '/sattari site/drums/cymbal-felts.jpg',
      '/sattari site/drums/cymbal-felts-2.jpg',
      '/sattari site/drums/cymbal-felts-3.jpg',
    ],
    specs: [
      'Color: red',
      'Use: cymbal stand felts (between cymbal and wing nut)',
      'Fits: standard cymbal stands',
    ],
  },
  {
    id: 'sattari-effect-cymbal',
    name: 'SATTARI effect CYMBAL',
    slug: 'sattari-effect-cymbal',
    category: 'cymbals',
    description:
      'A handcrafted Sattari effect cymbal designed to add texture and color to your kit. Available in three sizes — 15", 16", and 17" — so you can dial in the amount of cut and sustain that fits your setup. Aggressive attack with a trashy, raw character that sits well alongside crashes and rides without competing with them. A natural choice for drummers looking to add something unexpected.',
    sizes: [
      { size: '15"', price: 100 },
      { size: '16"', price: 90 },
      { size: '17"', price: 80 },
    ],
    image: '/sattari site/efx.png',
    specs: [
      'Type: effect cymbal',
      'Sizes available: 15", 16" and 17"',
      'Construction: handcrafted, hand-hammered',
      'Character: aggressive attack, raw trashy sustain',
    ],
  },
  {
    id: 'sattari-hand-crafted-hi-hat',
    name: 'Hi-Hat Pirouz Series',
    slug: 'sattari-hand-crafted-hi-hat',
    category: 'cymbals',
    description:
      'Pirouz Series hi-hats, handcrafted to deliver a tight, cutting chick and a rich, washy open sound. The matched pair is balanced for consistent feel whether you are playing closed, half-open, or riding the edge. At home in jazz, rock, and studio sessions — responsive at low volume, assertive when pushed.',
    price: 130.0,
    image: '/sattari site/hihat.png',
    specs: [
      'Type: hi-hat pair (top and bottom)',
      'Series: Pirouz',
      'Construction: handcrafted, hand-hammered and lathed',
      'Sold as: matched pair',
    ],
  },
  {
    id: 'cremona-handmade-acoustic-violin',
    name: 'CREMONA - Handmade Acoustic Violin',
    slug: 'cremona-handmade-acoustic-violin',
    category: 'violins',
    description:
      "The Cremona is SATTARI's fully handmade acoustic violin — hand-carved, shaped, and finished with fine traditional varnishes, each one treated as its own instrument rather than a production unit. Full-size (4/4), individually workshop-fitted and tuned at SATTARI Musical Instruments in California before it ships. A step up from factory instruments at an honest price — for students taking the next serious step and adults who want a real acoustic violin without paying for a collector's piece.",
    price: 250.0,
    image: '/sattari site/violins/cremona-acoustic.jpg',
    gallery: [
      '/sattari site/violins/cremona-acoustic.jpg',
      '/sattari site/violins/cremona-acoustic-2.jpg',
      '/sattari site/violins/cremona-acoustic-3.jpg',
      '/sattari site/violins/cremona-acoustic-4.jpg',
      '/sattari site/violins/cremona-acoustic-5.jpg',
      '/sattari site/violins/cremona-acoustic-6.jpg',
      '/sattari site/violins/cremona-acoustic-7.jpg',
    ],
    specs: [
      'Size: 4/4 (full size)',
      'Construction: hand-carved and shaped',
      'Finish: hand-applied varnish',
      'Setup: individually workshop-fitted in California',
    ],
  },
  {
    id: 'chiara-wooden-electric-violin',
    name: 'CHIARA - Wooden Electric Silent Violin',
    slug: 'chiara-wooden-electric-violin',
    category: 'violins',
    description:
      'SATTARI wooden electric SILENT violin, 4/4 (full size). Hand-carved solid spruce top with solid maple back and sides, plus volume and tone control. Includes a Brazilwood bow with genuine Mongolian horsehair, a lightweight foam hard case, chinrest, bridge, high-quality SATTARI rosin, and a 9V battery. Practice silently, or connect the output jack to an amplifier to perform on stage.',
    price: 250.0,
    image: '/sattari site/violins/chiara-electric.jpg',
    gallery: [
      '/sattari site/violins/chiara-electric.jpg',
      '/sattari site/violins/chiara-electric-2.jpg',
      '/sattari site/violins/chiara-electric-3.jpg',
      '/sattari site/violins/chiara-electric-4.jpg',
      '/sattari site/violins/chiara-electric-5.jpg',
      '/sattari site/violins/chiara-electric-6.jpg',
      '/sattari site/violins/chiara-electric-7.jpg',
      '/sattari site/violins/chiara-electric-8.jpg',
      '/sattari site/violins/chiara-electric-9.jpg',
    ],
    specs: [
      'Size: 4/4 (full size)',
      'Top: hand-carved solid spruce',
      'Back and sides: solid maple',
      'Controls: volume and tone; output jack for an amplifier',
      'Included: Brazilwood horsehair bow, foam hard case, chinrest, bridge, rosin and 9V battery',
    ],
  },
  {
    id: 'miami-electric-violin',
    name: 'MIAMI - Electric Violin',
    slug: 'miami-electric-violin',
    category: 'violins',
    description:
      'SATTARI electric violin, 4/4. Perfect for amplifying your sound in live performance or practicing quietly at home. Features a 1/4" jack for amplified use and a 3.5mm headphone jack for private practice, with a piezo pickup mounted under a maple bridge; maple body, neck, and scroll; and ebony pegs, fingerboard, and chinrest. Reverb on/off, volume, and aux controls, plus a 9V battery panel. Includes custom strings, a Brazilwood and horsehair bow, high-grade rosin, a triangular foam case, cable, and headphones. Available in red, white, blue, and black.',
    price: 120.0,
    image: '/sattari site/violins/miami-electric.jpg',
    gallery: [
      '/sattari site/violins/miami-electric.jpg',
      '/sattari site/violins/miami-electric-2.jpg',
      '/sattari site/violins/miami-electric-3.jpg',
      '/sattari site/violins/miami-electric-4.jpg',
      '/sattari site/violins/miami-electric-5.jpg',
      '/sattari site/violins/miami-electric-6.jpg',
      '/sattari site/violins/miami-electric-7.jpg',
      '/sattari site/violins/miami-electric-8.jpg',
      '/sattari site/violins/miami-electric-9.jpg',
      '/sattari site/violins/miami-electric-10.jpg',
    ],
    colors: [
      { name: 'Black', hex: '#111111' },
      { name: 'Red', hex: '#d21f2a' },
      { name: 'White', hex: '#f5f5f2' },
      { name: 'Blue', hex: '#1f49d2' },
    ],
    specs: [
      'Size: 4/4 (full size)',
      'Connections: 1/4-inch amplifier jack and 3.5 mm headphone jack',
      'Pickup: piezo, mounted under a maple bridge',
      'Body, neck and scroll: maple; pegs, fingerboard and chinrest: ebony',
      'Controls: reverb on/off, volume and aux; 9V battery panel',
      'Included: strings, Brazilwood horsehair bow, rosin, triangular foam case, cable and headphones',
    ],
  },
  {
    id: 'brescia-acoustic-violin',
    name: 'BRESCIA - Acoustic Violin',
    slug: 'brescia-acoustic-violin',
    category: 'violins',
    description:
      'SATTARI acoustic violin, 4/4. Beautiful and uncompromising, reminiscent of 17th-century masterpieces. Made from select American woods and finished with hand-applied traditional varnishes, featuring the deeper arching of many European styles in a warm golden base color. Highly figured maple back, ribs, and neck; redwood fingerboard and pegs; and a composite tailpiece with built-in tuners. Includes custom strings, a Brazilwood and horsehair bow, high-grade rosin, and a triangular foam case. Individually workshop-fitted and tuned at SATTARI Musical Instruments in California, USA.',
    price: 160.0,
    image: '/sattari site/violins/brescia-acoustic.jpg',
    gallery: [
      '/sattari site/violins/brescia-acoustic.jpg',
      '/sattari site/violins/brescia-acoustic-2.jpg',
      '/sattari site/violins/brescia-acoustic-3.jpg',
      '/sattari site/violins/brescia-acoustic-4.jpg',
      '/sattari site/violins/brescia-acoustic-5.jpg',
      '/sattari site/violins/brescia-acoustic-6.jpg',
      '/sattari site/violins/brescia-acoustic-7.jpg',
      '/sattari site/violins/brescia-acoustic-8.jpg',
      '/sattari site/violins/brescia-acoustic-9.jpg',
      '/sattari site/violins/brescia-acoustic-10.jpg',
    ],
    specs: [
      'Size: 4/4 (full size)',
      'Back, ribs and neck: maple',
      'Fingerboard and pegs: redwood',
      'Tailpiece: composite with built-in tuners',
      'Included: strings, Brazilwood horsehair bow, rosin and triangular foam case',
      'Setup: individually workshop-fitted and tuned in California',
    ],
  },
  {
    id: 'five-string-bass-guitar',
    name: '5 String Bass Guitar',
    slug: 'five-string-bass-guitar',
    category: 'guitar-bass',
    description:
      'A five-string electric bass with a glossy finish, built for players who need the extended low B string for drop tunings, extended-range playing, or added versatility in the studio. Full-bodied tone with comfortable action, set up and shipped from California. A solid instrument at an accessible price point for intermediate players or anyone adding a second bass to their rig.',
    price: 280.0,
    image: '/sattari site/guitars/bass-guitar.jpg',
    gallery: [
      '/sattari site/guitars/bass-guitar.jpg',
      '/sattari site/guitars/bass-guitar-2.jpg',
      '/sattari site/guitars/bass-guitar-3.jpg',
    ],
    specs: [
      'Strings: 5 (BEADG)',
      'Finish: gloss',
      'Setup: individually set up and shipped from California',
    ],
  },
  {
    id: 'classic-nylon-string-guitar',
    name: 'Classic Nylon String Guitar',
    slug: 'classic-nylon-string-guitar',
    category: 'guitar-bass',
    description:
      'A 40-inch classical guitar with a spruce top for warm, resonant projection and sapele back and sides for balanced, nuanced tone. Nylon strings are gentler on fingertips than steel — the natural choice for beginners, classical music, fingerstyle, and Latin guitar styles. Rosewood bridge and fingerboard for smooth playability. Set up and shipped from California.',
    price: 280.0,
    image: '/sattari site/guitars/nylon-guitar.jpg',
    gallery: [
      '/sattari site/guitars/nylon-guitar.jpg',
      '/sattari site/guitars/nylon-guitar-2.jpg',
      '/sattari site/guitars/nylon-guitar-3.jpg',
      '/sattari site/guitars/nylon-guitar-4.jpg',
      '/sattari site/guitars/nylon-guitar-5.jpg',
      '/sattari site/guitars/nylon-guitar-6.jpg',
      '/sattari site/guitars/nylon-guitar-7.jpg',
    ],
    specs: [
      'Instrument: nylon-string classical guitar',
      'Overall size: 40 inches',
      'Top: spruce',
      'Back and sides: sapele',
      'Bridge and fingerboard: rosewood',
    ],
  },
  {
    id: 'violin-strings',
    name: 'Violin Strings',
    slug: 'violin-strings',
    category: 'violins',
    description:
      'Replacement violin strings with ball ends, compatible with both 4/4 and 3/4 violins. A fresh set restores brightness, improves intonation, and makes the instrument easier and more rewarding to play — old strings lose tension and go false over time. Straightforward to install and a reliable option for students and teachers who need dependable replacements on hand.',
    price: 10.0,
    image: '/sattari site/violins/violin-strings.jpg',
    gallery: [
      '/sattari site/violins/violin-strings.jpg',
      '/sattari site/violins/violin-strings-2.jpg',
      '/sattari site/violins/violin-strings-3.jpg',
    ],
    specs: ['Fit: 4/4 and 3/4 violins', 'String ends: ball end'],
  },
  {
    id: 'sattari-darbuka',
    name: 'SATTARI Darbuka',
    slug: 'sattari-darbuka',
    category: 'essentials',
    description:
      'A goblet-shaped hand drum — widely known as the doumbek or darbuka in North African, Middle Eastern, and Mediterranean music traditions. Lightweight body with a synthetic head tuned for a clear, cutting sound. Loud for its size: the high tek and deep doum tones carry well in group settings, drum circles, and open performances. A natural choice for percussionists adding a hand drum to their setup, and accessible enough for a curious beginner.',
    price: 69.99,
    image: '/sattari site/drums/darbuka.jpg',
    gallery: [
      '/sattari site/drums/darbuka.jpg',
      '/sattari site/drums/darbuka-2.jpg',
      '/sattari site/drums/darbuka-3.jpg',
    ],
    specs: [
      'Type: goblet hand drum (darbuka / dumbek)',
      'Weight: lightweight',
      'Head: synthetic, tuned for a clear, tight sound',
    ],
  },
  {
    id: 'sattari-practice-pad-12',
    name: '12" Drummer Practice Pad',
    slug: 'sattari-practice-pad-12',
    category: 'essentials',
    description:
      'A 12-inch rubber practice pad — the same diameter as a standard snare drum, making it the closest desk-safe substitute for playing on a real head. Work through rudiments, paradiddles, and pattern work in near silence. Non-slip base works on any surface; fits inside a standard snare basket if you want to practice at kit height. Available in black, grey, and green.',
    price: 25.0,
    image: '/sattari site/drums/practice-pad-12.jpg',
    gallery: [
      '/sattari site/drums/practice-pad-12.jpg',
      '/sattari site/drums/practice-pad-12-2.jpg',
      '/sattari site/drums/practice-pad-12-3.jpg',
      '/sattari site/drums/practice-pad-12-4.jpg',
      '/sattari site/drums/practice-pad-12-5.jpg',
      '/sattari site/drums/practice-pad-12-6.jpg',
    ],
    colors: [
      { name: 'Black', hex: '#111111' },
      { name: 'Grey', hex: '#808080' },
      { name: 'Green', hex: '#2e7d32' },
    ],
    specs: [
      'Diameter: 12 inches',
      'Surface: rubber practice pad',
      'Non-slip base: works on carpet, table, lap or inside a snare basket',
      'Colors: black, grey, green',
    ],
  },
  {
    id: 'sattari-practice-pad-8',
    name: '8" Drummer Practice Pad',
    slug: 'sattari-practice-pad-8',
    category: 'essentials',
    description:
      'An 8-inch rubber practice pad — compact enough to fit in a stick bag or backpack, quiet enough to use at a desk or table, and the right starting size for most beginners building stroke consistency and rudiment speed. Non-slip base holds it in place on any surface. A natural first pad before moving to a full kit. Available in grey and green.',
    price: 15.0,
    image: '/sattari site/drums/practice-pad-8.jpg',
    gallery: [
      '/sattari site/drums/practice-pad-8.jpg',
      '/sattari site/drums/practice-pad-8-2.jpg',
      '/sattari site/drums/practice-pad-8-3.jpg',
      '/sattari site/drums/practice-pad-8-4.jpg',
      '/sattari site/drums/practice-pad-8-5.jpg',
      '/sattari site/drums/practice-pad-8-6.jpg',
      '/sattari site/drums/practice-pad-8-7.jpg',
    ],
    colors: [
      { name: 'Grey', hex: '#808080' },
      { name: 'Green', hex: '#2e7d32' },
      { name: 'Blue', hex: '#1f49d2' },
    ],
    specs: [
      'Diameter: 8 inches',
      'Surface: rubber practice pad',
      'Non-slip base: works on carpet, table, lap or inside a snare basket',
      'Colors: grey, green, blue',
    ],
  },
  {
    id: 'flame-stratocaster-electric-guitar',
    name: 'Flame Stratocaster Electric Guitar',
    slug: 'flame-stratocaster-electric-guitar',
    category: 'guitar-bass',
    description:
      'A Stratocaster-style electric guitar with a figured flame maple top — the kind of visual that usually costs twice the price. Versatile single-coil tone that handles clean playing, light overdrive, and everything between. Set up and shipped from California. An accessible entry point for players who want a real electric without compromising on looks.',
    price: 150.0,
    image: '/sattari site/guitars/flame-stratocaster.jpg',
    specs: [
      'Body style: Stratocaster',
      'Top: figured flame maple',
      'Setup: individually set up and shipped from California',
    ],
  },
  {
    id: 'steel-string-acoustic-guitar',
    name: 'Steel String Acoustic Guitar',
    slug: 'steel-string-acoustic-guitar',
    category: 'guitar-bass',
    description:
      'A steel-string acoustic guitar built for practice, songwriting, and performing. Warm, balanced tone with enough projection to fill a room unplugged. A reliable instrument for beginners working through their first songs and intermediate players who want a dependable acoustic on hand. Set up and ships from California.',
    price: 200.0,
    image: '/sattari site/guitars/steel-acoustic.jpg',
    gallery: [
      '/sattari site/guitars/steel-acoustic.jpg',
      '/sattari site/guitars/steel-acoustic-2.jpg',
      '/sattari site/guitars/steel-acoustic-3.jpg',
      '/sattari site/guitars/steel-acoustic-4.jpg',
    ],
    specs: [
      'Strings: steel',
      'Sound: warm, balanced acoustic projection',
      'Setup: individually set up and shipped from California',
    ],
  },
  {
    id: 'matilde-electric-violin',
    name: 'Matilde - Electric Violin',
    slug: 'matilde-electric-violin',
    category: 'violins',
    description:
      'A 4/4 electric/silent violin in a metallic red mahogany varnish. Hand-carved solid maple body with ebony fingerboard, pegs, chin rest, and tailpiece, plus four detachable nickel-plated fine tuners. Powered by a 9V battery. Includes a lightweight hard case, a Brazilwood bow with genuine Mongolian horsehair, quality rosin, a bridge, an aux cable, and headphones.',
    price: 590.99,
    image: '/sattari site/violins/matilde-electric.jpg',
    gallery: [
      '/sattari site/violins/matilde-electric.jpg',
      '/sattari site/violins/matilde-electric-2.jpg',
      '/sattari site/violins/matilde-electric-3.jpg',
      '/sattari site/violins/matilde-electric-4.jpg',
      '/sattari site/violins/matilde-electric-5.jpg',
      '/sattari site/violins/matilde-electric-6.jpg',
    ],
    specs: [
      'Size: 4/4 electric/silent violin',
      'Body: hand-carved solid maple',
      'Fingerboard, pegs, chinrest and tailpiece: ebony',
      'Fine tuners: four detachable, nickel-plated tuners',
      'Power: 9V battery',
      'Included: hard case, Brazilwood horsehair bow, rosin, bridge, aux cable and headphones',
    ],
  },
  {
    id: 'violin-pickup-bridge',
    name: 'Violin Pickup w/Bridge',
    slug: 'violin-pickup-bridge',
    category: 'violins',
    description:
      'A piezo pickup mounted in a replacement bridge — the simplest way to amplify an acoustic violin without permanent modification. Plug directly into an amp, PA, or audio interface for live performance or studio recording. Ships with the bridge pre-fitted and ready to install. Ships from California.',
    price: 25.0,
    image: '/sattari site/violins/violin-pickup.jpg',
    gallery: [
      '/sattari site/violins/violin-pickup.jpg',
      '/sattari site/violins/violin-pickup-2.jpg',
      '/sattari site/violins/violin-pickup-3.jpg',
      '/sattari site/violins/violin-pickup-4.jpg',
    ],
    specs: [
      'Pickup type: piezo',
      'Mounting: integrated bridge (pre-fitted)',
      'Output: standard 1/4-inch jack',
      'Installation: no permanent modification required',
    ],
  },
  {
    id: 'sattari-rosin',
    name: 'Rosin',
    slug: 'sattari-rosin',
    category: 'violins',
    description:
      'SATTARI rosin, well suited for violin, viola, and cello. Delivers maximized projection and clear bow articulation with great grip, for steel and synthetic bow hair alike. Low-dust formula; comes in a protective cloth wrap and ships in a crush-proof box.',
    price: 7.9,
    image: '/sattari site/violins/rosin.jpg',
    gallery: [
      '/sattari site/violins/rosin.jpg',
      '/sattari site/violins/rosin-2.jpg',
      '/sattari site/violins/rosin-3.jpg',
      '/sattari site/violins/rosin-4.jpg',
    ],
    specs: [
      'Use: violin, viola and cello bows',
      'Formula: low dust',
      'Packaging: protective cloth wrap and crush-proof box',
    ],
  },
  {
    id: 'wireless-transmitter-receiver',
    name: 'Wireless Transmitter/Receiver System',
    slug: 'wireless-transmitter-receiver',
    category: 'essentials',
    description:
      'A compact wireless transmitter/receiver system that cuts the cable between your instrument and amp on stage. Plug the transmitter into your instrument, the receiver into your amp or pedalboard, and move freely without tripping over leads or limiting your position. USB rechargeable. Includes one transmitter, one receiver, USB charger, and case.',
    price: 39.99,
    image: '/sattari site/accessories/wireless-transmitter.jpg',
    gallery: [
      '/sattari site/accessories/wireless-transmitter.jpg',
      '/sattari site/accessories/wireless-transmitter-2.jpg',
      '/sattari site/accessories/wireless-transmitter-3.jpg',
      '/sattari site/accessories/wireless-transmitter-4.jpg',
      '/sattari site/accessories/wireless-transmitter-5.jpg',
    ],
    specs: ['Included: one transmitter, one receiver, USB charger and case'],
  },
  {
    id: 'drum-stick-bag',
    name: 'Drum Stick Bag',
    slug: 'drum-stick-bag',
    category: 'essentials',
    description:
      'A compact drumstick bag that clips to your hi-hat stand or snare rim — keeping your sticks, brushes, and mallets close during a set. Fits up to four pairs. Available in black. Buy four pairs of sticks and get one free.',
    price: 5.99,
    image: '/sattari site/accessories/drum-stick-bag.jpg',
    gallery: [
      '/sattari site/accessories/drum-stick-bag.jpg',
      '/sattari site/accessories/drum-stick-bag-2.jpg',
    ],
    specs: [
      'Capacity: up to 4 pairs of sticks',
      'Color: black',
      'Mount: clips to hi-hat stand or snare rim',
    ],
  },
];

export function getProductBySlug(slug) {
  return products.find((p) => p.slug === slug);
}

// Unique key for a cart line: a product plus its selected size and color.
export function buildCartKey(slug, size, color) {
  return `${slug}::${size || 'default'}::${color || 'any'}`;
}

export function resolveSelectedOption(product, selectedSize) {
  if (!product) return { size: null, unitPrice: null };

  if (!product.sizes || product.sizes.length === 0) {
    return { size: null, unitPrice: product.price };
  }

  const selected = product.sizes.find((opt) => opt.size === selectedSize) ?? product.sizes[0];
  return { size: selected.size, unitPrice: selected.price };
}

export function formatPrice(value) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

// Display title for a category key (used for card kickers, the "Shop all"
// page, etc.). Falls back to a neutral label for unknown keys.
export function categoryTitle(key) {
  return categories.find((category) => category.key === key)?.title || 'Shop';
}

// Price label for a product card: a single price, or a low–high range for
// multi-size products (collapses to one price when every size costs the same).
export function formatPriceRange(product) {
  const prices = product.sizes?.length ? product.sizes.map((size) => size.price) : [product.price];
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? formatPrice(low) : `${formatPrice(low)} - ${formatPrice(high)}`;
}

// Lowest numeric price for a product (the size floor for multi-size items).
// Used for price sorting in the shop.
export function getMinPrice(product) {
  return product.sizes?.length
    ? Math.min(...product.sizes.map((size) => size.price))
    : product.price;
}
