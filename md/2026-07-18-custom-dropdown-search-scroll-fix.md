# 2026-07-18 Custom Dropdown Search Box Scroll Overlap Fix

## Problem

When scrolling through options in a searchable CustomDropdown, list items would scroll up and overlap/bleed into the sticky search input area, making it look unprofessional.

## Root Cause

1. The sticky search container lacked a `z-index`, so list items scrolling underneath were not properly hidden behind it.
2. The scrollable container had `py-1` (top and bottom padding), which created a gap above the sticky search box where scrolling items would peek through.

## Fix

- Added `z-10` to the sticky search wrapper so it always renders above scrolling list items.
- Changed `py-1` to `pb-1` on the container when `searchable` is true, removing the top padding gap that allowed items to show above the search box.

## Files Changed

- `src/components/ui/CustomDropdown.tsx`
