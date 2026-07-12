# Header Column Right Padding Reduction

## Date
2026-01-08

## Summary
Reduced the right padding on Tabulator header column content so that the filter icon, calculation icon, and filter input field extend closer to the column boundary (next field).

## Change
**File:** `src/index.css`

**Before:**
```css
.tabulator .tabulator-header .tabulator-col .tabulator-col-content {
  padding: 6px 12px;
}
```

**After:**
```css
.tabulator .tabulator-header .tabulator-col .tabulator-col-content {
  padding: 6px 0px 6px 12px;
}
```

## Details
- Changed horizontal padding from symmetric `12px` to asymmetric `12px left / 0px right`
- This moves the filter icon, calculation (sigma) icon, and filter input as close as possible to the right edge of each column header
- The left padding remains at `12px` to maintain proper spacing from the column title text
- The filter input field now extends almost to the column border for maximum width utilization
