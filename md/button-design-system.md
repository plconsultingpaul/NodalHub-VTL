# Button Design System

This document defines the **Gold Standard** for buttons to ensure a premium, consistent SaaS aesthetic across the platform.

---

## 1. Core Foundation (Global)

All buttons, regardless of variant, must adhere to these base physical properties:

- **Height:** `h-9` (Standard)
- **Corners:** `rounded-lg`
- **Typography:** `text-sm font-medium`
- **Outer Shadow:** `shadow-[0_1px_2px_rgba(0,0,0,0.05)]`
- **Icon Specs:** `w-4 h-4`, perfectly centered with text using `flex items-center gap-2`.

---

## 2. The Style Hierarchy

### Primary (Action)

- **Usage:** Main page actions like "New Template" or "Save".
- **Classes:** `bg-blue-600 text-white hover:bg-blue-500 border border-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all active:scale-[0.98]`

### Success (Semantic)

- **Usage:** Positive state changes like "Activate" or "Enable".
- **Classes:** `bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all`

### Secondary (Outlined)

- **Usage:** Common actions like "Filters", "Test Workflow", or "Edit".
- **Classes:** `bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all`

### Ghost (Utility)

- **Usage:** Muted actions like "Export", "Refresh", or "Cancel". Should feel like a button only on hover.
- **Base Text Color:** `text-slate-600` (Never lighter than `slate-500` for accessibility).
- **Hover State:** `hover:bg-slate-100 hover:text-slate-900`
- **Classes:** `px-3 bg-transparent transition-all flex items-center justify-center`

---

## 3. Layout Guidelines

- **Toolbars:** When grouping buttons (e.g., Refresh, Export, Filters), wrap them in a `flex items-center gap-1`.
- **Alignment:** Ensure all buttons in a row share the `h-9` height to maintain a consistent horizontal baseline.
- **Hitboxes:** Ghost buttons must have `px-3` padding to ensure a visible rounded rectangle appears on hover.

---

## 4. Specific Button Recipes

### Test Function Button

- **Icon:** Use the `Zap` icon from `lucide-react`, sized at `w-4 h-4`, with a `text-amber-500` tint to add a professional pop against the slate button text.
- **Button Style:** Secondary (Outlined) variant: `h-9 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm rounded-lg`
- **Layout:** `flex items-center gap-2 px-4` for perfect centering.
- **Cancel Link (Footer):** The Cancel action below should be a clean, muted text link: `text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors`

---

> **Note to AI:** Refer to this file whenever generating new UI components or pages to ensure the TradeWeave design language is maintained.
