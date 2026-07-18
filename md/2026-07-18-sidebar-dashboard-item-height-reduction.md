# 2026-07-18 Sidebar Folder Item Height Reduction

## Summary

Reduced the vertical padding on sidebar folder rows to make folders more compact, allowing more to fit on screen without scrolling.

## Changes

### `src/components/layout/Sidebar.tsx`
- Changed the folder row button padding from `py-2` (8px top + 8px bottom) to `py-1` (4px top + 4px bottom)
- Reduces each folder row height by 8px total
