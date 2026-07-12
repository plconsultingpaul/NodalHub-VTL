# Login Screen Redesign - Split Panel Layout

**Date:** 2026-06-03

## Summary

Redesigned the Login page to match the split-panel reference layout from `2026-06-03-login-screen-reference.md`. The new screen has a dark branded panel on the left with feature highlights and a clean white login card on the right.

## Changes

### `src/pages/Login.tsx` (rewrite)

Replaced the single-column login form with a two-panel layout:

**Left panel (hidden below `lg`):**
- Dark slate gradient background (`#1e293b -> #0f172a -> #1e293b`)
- Subtle dot grid overlay at 24px spacing
- Animated background ambiance built without third-party WebGL dependencies:
  - Three slow-floating blurred radial color blooms (cyan, pink, green) using existing CSS keyframes
  - SVG sine-wave lines with a horizontal gradient stroke for depth
- Branding header with a gradient logo tile, large title, and animated gradient subtitle ("Welcome back") using `background-clip: text` over an 8s animated linear gradient
- Three feature cards at the bottom (Custom Dashboards, API Integration, Pulse Monitoring) using `lucide-react` icons in slate-tinted tiles

**Right panel:**
- Light slate gradient background (dark mode aware)
- Centered login card with rounded-2xl corners and subtle ring/shadow
- Mobile-only condensed logo above the card for `< lg` viewports
- Icon-prefixed inputs (Mail and Lock icons, 20px) using `pl-11` for spacing and `rounded-xl` corners
- Password show/hide toggle with Eye/EyeOff icons on the right
- "Remember me" checkbox paired with "Forgot Password?" link (routes to existing `/forgot-password` page)
- Inline red error banner with rounded corners
- Primary submit button: blue-600 with darker border and inset top highlight, transitions to blue-500 on hover, shows a spinner and "Signing in..." while loading
- Footer copyright row with the current year

### `src/index.css`

Added shared keyframes used by the login screen:

- `@keyframes gradient` and `.animate-gradient` (8s loop) for the animated text gradient
- `@keyframes float-slow` (14s) and `@keyframes float-medium` (10s) plus matching utility classes for the ambient blurred color blooms

## Notes

- The reference document mentions a `three.js`-based `FloatingLines` WebGL background. To avoid adding the heavy `three` dependency, the same visual feel was approximated with pure CSS/SVG (animated blurred radial gradients and gradient-stroked sine waves).
- The existing `signIn` flow from `AuthContext` still drives authentication; field, validation, and routing behavior are unchanged.
- "Forgot Password?" continues to use the existing `/forgot-password` route, so no modal component was added.
- Dark mode classes were added throughout so the right-side card and inputs continue to look correct when the theme is toggled.

## Result

- Modern, polished split-panel login that matches the reference layout.
- Branding panel showcases product value with feature cards and animated background.
- Right-side card focuses the user on the sign-in action with clear hierarchy and accessible inputs.
- No new npm dependencies were added.
