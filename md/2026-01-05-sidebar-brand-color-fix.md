# Sidebar Brand Color Fix

**Date:** 2026-01-05

## Problem

When changing the Brand Color in Settings > Branding and clicking "Save Branding", the sidebar color did not update. The preview showed the correct color, but the actual sidebar remained black.

## Root Cause

The sidebar had a hardcoded `bg-black` Tailwind class that overrode the dynamic brand color stored in the database.

**Before:** `Sidebar.tsx` line 305
```tsx
<aside className={`fixed top-0 left-0 h-screen bg-black flex flex-col ...`}>
```

## Solution

Replaced the hardcoded background class with dynamic inline styling that reads from `activeCompany.primary_color`.

**After:**
```tsx
<aside
  className={`fixed top-0 left-0 h-screen flex flex-col ...`}
  style={{ backgroundColor: activeCompany?.primary_color || '#000000' }}
>
```

## Files Changed

- `src/components/layout/Sidebar.tsx` - Removed `bg-black` class, added dynamic `style` attribute

## Result

The sidebar now uses the saved primary brand color from company settings. Changes take effect immediately after saving branding settings.
