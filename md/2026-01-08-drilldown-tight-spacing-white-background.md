# Drilldown Tight Spacing and White Background

## Summary
Updated the inline drilldown display in DashboardCell to have tighter spacing between cells and a white background instead of grey.

## Changes Made

### File: `src/pages/DashboardViewer/DashboardCell.tsx`

1. **Background color changed from grey to white**
   - Changed `background:#f9fafb` to `background:#fff` on the drilldown container `td` element

2. **Wrapper padding reduced**
   - Changed from `padding:12px 16px 12px 40px` to `padding:4px 8px 4px 24px`

3. **Section margin reduced**
   - Changed from `margin-bottom:12px` to `margin-bottom:4px`

4. **Table header cell padding reduced**
   - Changed from `padding:6px 10px` to `padding:2px 6px`

5. **Table data cell padding reduced**
   - Changed from `padding:6px 10px` to `padding:2px 6px`

## Result
The drilldown table now displays with minimal spacing between cells (just a sliver of space) and uses a clean white background, matching the reference application design.
