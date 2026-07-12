# Column Header Filter Overflow Fix

**Date:** 2026-01-08

## Issue

When resizing a dashboard cell column to be narrower, the header elements (Filter Icon, Calculation Icon, and Filter Input) would overflow into adjacent columns instead of staying contained within their own column.

## Solution

Added proper overflow handling at two levels:

### 1. Tabulator Column Header CSS (index.css)

Changed `.tabulator-col` from `overflow: visible` to `overflow: hidden` and added overflow handling to content containers:

- `.tabulator .tabulator-header .tabulator-col` - Changed to `overflow: hidden`
- `.tabulator-col-content` - Added `overflow: hidden` and `min-width: 0`
- `.tabulator-col-title-holder` - Added `overflow: hidden` and `min-width: 0`

### 2. Custom Title Formatter (DashboardCell.tsx)

Added overflow handling to the `createTitleWithFilter` function elements:

- Container element - Added `overflow:hidden`
- Title row - Added `overflow:hidden;min-width:0`
- Filter row - Added `overflow:hidden;min-width:0`

### Technical Details

- `overflow:hidden` clips any content that would extend beyond the element's bounds
- `min-width:0` is required on flex children to allow them to shrink below their intrinsic content size (default is `min-width:auto`)
- The filter input already had `min-width:0` and `flex:1` which allows it to compress as space decreases

## Files Modified

- `src/index.css`
- `src/pages/DashboardViewer/DashboardCell.tsx`
