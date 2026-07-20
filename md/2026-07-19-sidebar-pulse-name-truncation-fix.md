# 2026-07-19 Sidebar Pulse Name Truncation Fix

## Problem

When a pulse name is too long, it pushes the action buttons (status dot, dropdown menu) off-screen because the button element has no minimum-width constraint, preventing the inner `truncate` class from activating.

## Changes

### `src/components/layout/Sidebar.tsx`

- Added `min-w-0` to the pulse item button (line ~458) so the flex child can shrink below its content width, allowing the existing `truncate` class on the name span to take effect.
- Added `title={pulse.name}` to the name span so users can hover to see the full pulse name in a native tooltip.
