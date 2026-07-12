# Tabulator Grid Scroll Fix

**Date:** 2026-01-06

## Summary

Fixed an issue where Tabulator grids with more rows than visible space would not scroll, causing rows to be cut off.

## Changes Made

### File: `src/pages/DashboardViewer/DashboardCell.tsx`

1. **Added `height: '100%'` to Tabulator config** - This enables Tabulator's internal virtual scrolling mechanism

2. **Added `min-h-0` class to table container** - Critical fix for flexbox containers. Without this, flex children cannot shrink below their content size, preventing scroll from working

3. **Added `overflow-hidden` to parent container** - Prevents content overflow outside the cell bounds

## Technical Details

In CSS flexbox, `flex-1` alone doesn't constrain height for scrolling children. The `min-height` defaults to `auto` (content size), which prevents shrinking. Adding `min-h-0` overrides this, allowing the Tabulator container to respect its parent's height and enable scrolling.
