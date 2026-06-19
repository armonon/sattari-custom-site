# Premium Cart - Design System Reference

## 🎨 Color Palette

### Primary Colors
```css
--text: #f5f5f5              /* Main text color */
--muted: #a8a8b3            /* Secondary/muted text */
--accent: #d6b36d            /* Gold accent - pricing, highlights */
--success: #34c759           /* Green - success states */
--error: #ff3b30             /* Red - errors, remove actions */
```

### Background Layers
```css
/* Light overlay on dark */
rgba(50, 50, 55, 0.5)        /* Primary card background */
rgba(40, 40, 45, 0.3)        /* Secondary background */
rgba(30, 30, 35, 0.7)        /* Darker background */

/* With gradient */
linear-gradient(135deg, rgba(50, 50, 55, 0.5), rgba(40, 40, 45, 0.3))
linear-gradient(180deg, rgba(40, 40, 45, 0.9), rgba(30, 30, 35, 0.85))
```

## 🏗️ Spacing System

```css
--spacing-xs: 0.25rem        /* 4px */
--spacing-sm: 0.5rem         /* 8px */
--spacing-md: 1rem           /* 16px */
--spacing-lg: 1.5rem         /* 24px */
--spacing-xl: 2rem           /* 32px */
--spacing-2xl: 4rem          /* 64px */
```

### Applied in Cart
- Item padding: `1rem` (md)
- Section gap: `1.5rem` (lg)
- Header padding: `1.5rem` (lg)
- Action buttons gap: `0.75rem` (sm + 1/2)

## 📐 Border Radius System

```css
--radius-md: 0.375rem        /* 6px - input, small elements */
--radius-lg: 0.625rem        /* 10px - cards, medium elements */
--radius-xl: 0.875rem        /* 14px - large containers */
--radius-full: 9999px        /* Fully rounded - buttons */
```

### Usage in Cart
- Quantity adjuster: `radius-md`
- Cart items: `radius-lg`
- Summary sidebar: `radius-xl`
- Checkout button: `radius-full`

## ⏱️ Transitions

```css
--transition-fast: 0.15s ease-in-out
--transition-base: 0.25s ease-in-out
--transition-slow: 0.35s ease-in-out
```

### Animation Timings
- Quick feedback: 150ms (fast)
- Standard animations: 250-300ms (base)
- Sliding transitions: 350ms (slow)

## 🎬 Framer Motion Presets

### Stagger Animation
```jsx
staggerChildren: 0.05        /* 50ms delay between items */
delayChildren: 0.1           /* Start animation after 100ms */
```

### Item Variants
```jsx
// Enter
opacity: 0 → 1 (300ms)
y: 20px → 0

// Exit  
opacity: 1 → 0 (200ms)
y: 0 → -20px

// Easing
ease: "easeOut"
```

### Hover Effects
```css
Scale: 1 → 1.05 (250ms)
Shadow: 0 4px 12px → 0 8px 24px (250ms)
Color: var(--muted) → var(--accent) (250ms)
```

## 🎨 Premium Effects

### Glassmorphism
```css
background: rgba(40, 40, 45, 0.9);
backdrop-filter: blur(20px) saturate(1.3);
border: 1px solid rgba(214, 179, 109, 0.15);
```

### Gradient Text
```css
background: linear-gradient(135deg, #d6b36d, #e6c85f);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
```

### Shine Effect (Checkout Button)
```css
::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-100%);
  transition: transform 250ms ease-out;
}

:hover::before {
  transform: translateY(0);
}
```

### Hover Shimmer
```css
::before {
  background: linear-gradient(90deg, 
    transparent, 
    rgba(214, 179, 109, 0.05), 
    transparent);
  transform: translateX(-100%);
}

:hover::before {
  transform: translateX(100%);
}
```

## 📦 Component Token Map

### CartSidebar Premium
```
Header:
  - Font: 1.4rem / 700 weight
  - Color: var(--text)
  - Padding: 1.5rem
  - Border-bottom: 1px solid rgba(214, 179, 109, 0.1)

Items:
  - Background: rgba(50, 50, 55, 0.5) with gradient
  - Padding: 1rem
  - Radius: radius-lg
  - Gap: 0.75rem between children

Quantity Adjuster:
  - Height: 32px
  - Background: rgba(30, 30, 35, 0.7)
  - Border: 1px solid rgba(214, 179, 109, 0.15)
  - Radius: radius-md

Summary:
  - Background: Gradient 180deg
  - Padding: 1.5rem
  - Font-size: 0.9rem

Actions:
  - Gap: 0.75rem
  - Padding: 1.5rem
  - Checkout: Gradient background
  - Secondary: Border + transparent bg
```

### CartPage Premium

```
Layout:
  - Grid: 1fr 360px
  - Gap: 2rem
  - Max-width: 100%

Items:
  - Grid: 100px 1fr auto auto auto
  - Gap: 1rem
  - Padding: 1.25rem
  - Radius: radius-lg

Item Image:
  - Size: 100x100px
  - Radius: radius-md
  - Border: 1.5px solid rgba(214, 179, 109, 0.15)

Quantity Control:
  - 3-button layout (−, qty, +)
  - Each button: 32px height
  - Width flexible per button

Summary Sidebar:
  - Position: sticky top 120px
  - Width: 360px
  - Padding: 2rem
  - Radius: radius-xl
  - Backdrop: blur(20px) saturate(1.3)
  - Shadow: 0 16px 60px rgba(0, 0, 0, 0.3)

Empty State:
  - Min-height: 400px (desktop) / 300px (mobile)
  - Centered flex layout
  - Emoji: 4rem (desktop) / 3rem (mobile)
```

## 📱 Responsive Breakpoints

### Desktop (1024px+)
- Sidebar: 400px fixed width (right side)
- Cart page: 2-column grid (content + 360px sidebar)
- Item image: 100x100px
- Full layouts shown

### Tablet (768px-1024px)
- Sidebar: Full width
- Cart page: 1-column layout
- Adjusted fonts and spacing
- Summary moves below items

### Mobile (480px-768px)
- Sidebar: 85vw max-width
- Item image: 80x80px
- Compact spacing
- Adjusted font sizes

### Small Mobile (<480px)
- Sidebar: 95vw max-width
- Item image: 70x70px
- Minimal padding
- Single-column everything

## 🔧 CSS Variables Usage

### To use design tokens in custom styles:
```css
/* Colors */
color: var(--text);
background: var(--muted);
border: 1px solid var(--accent);

/* Transitions */
transition: all var(--transition-base);

/* Border Radius */
border-radius: var(--radius-lg);

/* Spacing */
padding: var(--spacing-md);
gap: var(--spacing-lg);
```

## 🎯 Key Design Principles

1. **Dark Luxury**: High contrast, gold accents
2. **Minimalist**: Clean, uncluttered layout
3. **Smooth Interactions**: Every transition feels polished
4. **Premium Feel**: Glassmorphism + gradients + shadows
5. **Accessibility**: Good contrast ratios, readable fonts
6. **Responsive**: Looks great on all devices

## 📊 Animation Performance

### GPU Accelerated Properties
✅ Used:
- `transform` (translate, scale, rotate)
- `opacity`
- `filter` (blur, saturate)

❌ Avoid:
- `left`, `top`, `width`, `height`
- `background-color` (except in transitions)
- `box-shadow` (causes repaints)

### Result
- 60fps animations on most devices
- Smooth scrolling
- No jank or stuttering

---

This design system creates a **premium, cohesive shopping experience** that feels modern and luxurious! ✨
