# Filter Row Negative Margin Edge Extension

## Date
2026-01-08

## Summary
Added a negative right margin to the filter row in column headers so the filter input extends closer to the column edge/border.

## Changes

**File:** `src/pages/DashboardViewer/DashboardCell.tsx`

### Filter Row (line ~293)
**Before:**
```javascript
filterRow.style.cssText = 'display:flex;width:100%;gap:0;align-items:stretch;overflow:hidden;min-width:0;';
```

**After:**
```javascript
filterRow.style.cssText = 'display:flex;width:100%;gap:0;align-items:stretch;overflow:hidden;min-width:0;margin-right:-8px;';
```

### Container (line ~70)
**Before:**
```javascript
container.style.cssText = 'display:flex;flex-direction:column;width:100%;gap:4px;overflow:hidden;';
```

**After:**
```javascript
container.style.cssText = 'display:flex;flex-direction:column;width:100%;gap:4px;';
```

## Details
- Added `margin-right:-8px` to the filter row to extend it into the column resize handle area
- Removed `overflow:hidden` from the parent container to allow the negative margin to take effect
- This makes the filter input visually extend closer to the column boundary
