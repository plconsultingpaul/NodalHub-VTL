# Dashboard Cell Record Count in Header

## Date
2026-01-06

## Summary
Added record count display to the dashboard cell header, showing the total number of records returned from the API query.

## Changes Made

### DashboardCell.tsx
- Added optional `onRecordCount` callback prop to the component interface
- Modified `fetchData` function to call the callback with the record count after data is successfully fetched
- Note: `onRecordCount` is intentionally excluded from the `useCallback` dependency array to prevent infinite re-render loops

### DashboardViewer/index.tsx
- Added `cellRecordCounts` state to track record counts per cell ID
- Added `handleRecordCount` callback function to update the state when a cell reports its count
- Updated cell header rendering to display the count in format: "Title - X records"
- Passed `onRecordCount` callback prop to each `DashboardCell` component

## Display Format
The record count is displayed in the cell header as:
```
Driver - 25 records
```

The count appears in a lighter font weight and color to differentiate it from the cell title.
