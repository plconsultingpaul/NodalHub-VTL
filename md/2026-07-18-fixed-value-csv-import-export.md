# 2026-07-18 Fixed Values - CSV Import and Export

## Summary

Added Import CSV and Export CSV buttons to the Fixed Value list editor toolbar, allowing users to bulk-populate or export fixed value lists without manual entry.

## Features

### Import CSV
- Opens a file picker for `.csv` files
- Reads the first two columns of each row as Value and Description
- Handles quoted fields (commas and double-quotes inside values)
- Appends imported rows to the existing list (non-destructive)

### Export CSV
- Downloads all current list values as a CSV file
- File is named after the fixed value (e.g. `Status Codes.csv`)
- Includes a header row: `Value,Description`
- Properly escapes fields containing commas or quotes

## Changes

### `src/pages/QueryManager/FixedValueEditor.tsx`
- Added `useRef` import and `csvInputRef` for the hidden file input
- Added `Upload` and `Download` icons from lucide-react
- Added `parseCsvLine` helper for RFC-4180-compliant CSV parsing
- Added `handleImportCsv` handler that reads a file and appends parsed rows to listValues
- Added `handleExportCsv` handler that generates and downloads a CSV blob
- Added Import CSV and Export CSV buttons to the toolbar with a separator
- Added hidden `<input type="file">` triggered by the Import button
