# Homepage Restructure: Drums First

## ✅ What Changed

The homepage has been simplified to do one job really well: **sell drums first, then services**.

### Before
- Hero section (strong) ✓
- **"Brand direction" section with 3-card explanation (removed)** ✗ Duplicative
- About section with founder info ✓
- Instagram feed ✓

### After
- Hero section (simplified & focused) ✓
- About section with founder info ✓
- Instagram feed ✓
- **Duplicative "Brand direction" section removed** ✓

---

## 🎯 Hero Section Changes

### Copy Simplified
**Before:**
> Sattari Music is a California-based brand built for drummers—by drummers. Shop curated gear, get expert repairs, and join a community led by international performer Mohammad Sattari.

**After:**
> Shop handcrafted cymbals, sticks, pads, and essentials. Built by drummers, for drummers.

**Why:** Direct, action-oriented. Removes secondary messaging about services—those get their own button.

### CTA Buttons Updated
- Primary: "Shop Drum Gear" (unchanged)
- Secondary: "Local Services" → **"Services & Rentals"** (clearer)

### Hero Card Simplified
**Before (4 bullets):**
- Curated drum essentials
- Founder with 30+ years' experience
- California-based, globally inspired
- Instagram & community highlights

**After (4 bullets):**
- Curated gear from pros
- 30+ years expertise
- California-based
- Direct from founder

**Why:** Shorter, punchier. Removes social media callout (Instagram is already featured later).

---

## 🗑️ What Was Removed

The "Brand direction" section that repeated the message:

```jsx
<section className="section">
  <div className="container section-header">
    <p className="eyebrow">Brand direction</p>
    <h2>Premium drum gear. Trusted local service.</h2>
    <p>Sattari Music is built for drummers first—shop handcrafted 
       cymbals, sticks, and essentials, then book reliable local 
       support for repairs, rentals, and musician services in California.</p>
  </div>

  <div className="container card-grid three-col">
    {highlights.map((item) => (
      <article className="info-card" key={item.title}>
        <h3>{item.title}</h3>
        <p>{item.text}</p>
      </article>
    ))}
  </div>
</section>
```

**Why removed:** This section explained the brand via 3 cards—but that's what the hero section does. The site structure already proves the story:
- ShopPage proves you sell instruments
- AboutSection proves you have founder expertise
- ServicesPage (separate) proves you offer services

Extra explanation adds friction without adding value.

---

## 📊 New Hierarchy

### What Matters (Immediately Visible)
1. **Hero: "Drums First. Always."** - Clear positioning
2. **Hero CTA: "Shop Drum Gear"** - Primary action
3. **Why 4 bullets** - Quick credibility

### Secondary (Below Fold)
4. **About founder** - Story & authority
5. **Instagram feed** - Social proof & community

### For Services
- User clicks "Services & Rentals" button
- Or navigates directly to `/services`
- Gets dedicated page (no confusion with shop)

---

## 🚀 Result

**Homepage now:**
- ✅ Focused on ONE job: selling drums
- ✅ Faster scanning (less text)
- ✅ Clearer CTAs (shop vs. services)
- ✅ Removed duplication
- ✅ Site structure does the heavy lifting (shop page = inventory proof, about = founder proof)

**User journey:**
1. Land on homepage
2. "Drums First. Always." makes the value clear
3. Click "Shop Drum Gear" OR "Services & Rentals"
4. Get what they came for

---

## 📁 File Changed
- `src/components/HomePage.jsx`

No new components created. Just removed the duplicative middle section and tightened copy.
