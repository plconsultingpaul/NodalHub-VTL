# 2026-07-18 Sidebar Dashboard/Pulse Item Height Reduction

## Summary

Reduced the vertical height of dashboard and pulse items listed under folders in the sidebar, making them more compact so more items fit on screen.

## Changes

### `src/components/layout/Sidebar.tsx`
- Changed dashboard item padding from `py-1.5` to `py-0.5` (reduces vertical padding from 6px to 2px per item)
- Changed pulse item padding from `py-1.5` to `py-0.5` (same reduction)
- Changed containing div spacing from `space-y-0.5` to `space-y-0` for both dashboard and pulse lists (removes 2px gap between items)

## Result

Sidebar items under folders are now significantly tighter together, allowing more dashboards and pulses to be visible without scrolling.
