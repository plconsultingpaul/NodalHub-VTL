# 2026-07-18 Custom Dropdown Search/Scroll Fix

## Summary

Fixed the hover state on dropdown menu items (3-dot menus) being visually clipped at the top and bottom edges of the dropdown panel.

## Problem

The dropdown container used `rounded-lg` for rounded corners but did not set `overflow-hidden`. When hovering over the first or last menu item, its rectangular background fill extended beyond the container's border-radius, causing a visual cut-off effect.

## Changes

### `src/components/ui/Dropdown.tsx`
- Added `overflow-hidden` to the dropdown panel's className so item hover backgrounds are properly clipped to the container's rounded corners
