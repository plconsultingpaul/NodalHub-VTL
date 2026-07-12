# Tabulator Compact Row Height

**Date:** 2026-01-07

## Summary

Reduced vertical padding in Tabulator grid rows to create a more compact, data-dense display. This eliminates whitespace between rows so colored cell backgrounds are only separated by the border line.

## Changes Made

### `src/index.css`

1. **Header cell padding** - Reduced from `10px 12px` to `6px 12px`
2. **Data cell padding** - Reduced from `10px 12px` to `4px 12px`
3. **Removed `background: transparent !important`** from cells to allow cell backgrounds to fill properly

## Result

- Rows are more compact, showing more data in the same space
- Colored cell backgrounds extend edge-to-edge with only the separator line visible between rows
- More efficient use of screen real estate for data grids
