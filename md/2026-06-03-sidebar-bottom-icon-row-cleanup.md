# Sidebar Bottom Section Cleanup - Single Icon Row

**Date:** 2026-06-03

## Summary

Consolidated the bottom section of the sidebar from four stacked rows into a single horizontal row of icon-only buttons. This frees up vertical space for the Dashboards and Pulse sections above.

## Problem

The sidebar footer previously contained four separate stacked rows:
1. Settings nav link (icon + label)
2. Help link (icon + label)
3. CompanySwitcher block with user avatar, full name, and email
4. Theme toggle button (Sun/Moon)
5. Collapse chevron button

This took up significant vertical real estate (~5 rows / ~240px) and looked visually disjointed, with the user block separated from the other footer items.

## Changes

### `src/components/layout/CompanySwitcher.tsx`

- Added an `iconOnly` prop to support rendering just the avatar circle without the full name and email text.
- Introduced a `compact` flag that is true when either `iconOnly` is passed or the sidebar is collapsed.
- The trigger now hides the name/email text and shrinks the avatar to a 32px circle when in compact mode, allowing it to fit alongside the other footer icons.

### `src/components/layout/Sidebar.tsx`

Replaced the entire footer block (previously lines 585-636) with a tighter layout:

- **Expanded sidebar:** A single row containing the user avatar (CompanySwitcher in `iconOnly` mode), Settings, Help, and the theme toggle, distributed evenly with `justify-around`. Each item is a 36x36 square button with hover state.
- **Collapsed sidebar:** Only the user avatar icon is shown, centered.
- **Collapse/expand chevron:** Kept on its own centered row underneath the icon row, separated by a thin divider, matching the requested screenshot layout.

Removed the stacked `nav` block, the bordered CompanySwitcher wrapper, and the standalone theme toggle row.

## Result

- Footer height reduced from ~240px to ~96px when expanded.
- More vertical space for Dashboards and Pulse lists.
- Cleaner, single-line visual that matches the reference screenshot exactly: `[PL] [gear] [?] [moon]` on top, `[<]` chevron underneath.
- When collapsed, only the user icon plus the expand chevron are visible.
