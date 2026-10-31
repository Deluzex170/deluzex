# Deluzex UI/UX Design Standards & Intelligence Rule

> **Mandatory Rule for All AI Coding Agents**:
> Whenever designing, redesigning, building, or modifying any UI/UX interfaces, pages, components, forms, tables, carousels, or layouts in the Deluzex codebase, you MUST reference and adhere to the `.agents/skills/ui-ux-pro-max` design system and luxury e-commerce rules.

---

## 1. Form Inputs & Controls (No Bloated Sizes)
* **Standard Control Height**:
  * Desktop inputs, selects, and text fields MUST be **40px to 44px** in height (`padding: 0 14px; font-size: 14px;`).
  * Never render oversized 55px+ bulky input boxes that waste vertical viewport space.
  * Mobile inputs: **42px to 44px** for comfortable, WCAG-compliant touch targets.
* **Borders & Radii**:
  * Clean, refined borders: `1px solid #DDD6CD` (warm luxury stone/taupe).
  * Modern border radius: `8px` (compact, sleek).
  * Focus states: Subtle gold ring `border-color: #C49A45; box-shadow: 0 0 0 3px rgba(196, 154, 69, 0.15); outline: none;`.
* **Field Labels**:
  * Concise, professional naming: font-size `12.5px to 13px`, font-weight `600`, color `#3A3A44`.
  * Avoid long sentence labels. Use clean labels with subtle helper text where necessary.

---

## 2. Buttons & Calls-to-Action
* **Primary CTAs**:
  * Height: **46px to 50px** (proportional, punchy, confident).
  * Luxury Gold Theme: `background: linear-gradient(135deg, #D4AF37 0%, #C49A45 50%, #B58B35 100%); color: #FFFFFF; font-weight: 700;`.
  * Subtle hover lift: `transform: translateY(-1px); box-shadow: 0 6px 20px rgba(196, 154, 69, 0.35);`.
* **Secondary / Outline Buttons**:
  * Height: **38px to 42px**, `border: 1.5px solid #C49A45; color: #C49A45; background: transparent;`.
* **Inline / Utility Buttons (e.g. Apply Coupon, Quantity Stepper)**:
  * Height: **36px to 40px** matching the adjacent input control.

---

## 3. Layout, Spacing & Viewport Optimization
* **E-Commerce Checkout & Form Layouts**:
  * Desktop: Multi-column grid (e.g., Form 1.5fr / Sticky Order Summary 1fr).
  * Form cards must be neatly grouped (`background: #FFFFFF; border: 1px solid #EAE5DE; border-radius: 16px; padding: 24px to 28px;`).
  * Order Summary should stick on scroll (`position: sticky; top: 90px;`).
  * No horizontal overflow or dead blank white voids on ultrawide screens.
* **Full Responsiveness**:
  * Mobile (360px - 480px): Single-column stacked, edge-to-edge padding (14px - 16px), full touch swipe.
  * Tablet (768px - 1024px): Balanced centered container, readable typography.
  * Desktop (1024px - 1440px+): Balanced two-column grid with max-width 1240px.

---

## 4. UI/UX Pro Max Skill Tooling
* For palette lookups, component patterns, and typography recommendations:
  `python .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system`

