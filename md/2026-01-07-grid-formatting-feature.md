# Grid Formatting Feature

**Date**: 2026-01-07

## Overview

Added a Grid Formatting feature that allows users to customize the appearance of grid cells in dashboard viewers. Formatting settings are stored per template, so different templates can have different visual styles.

## Changes Made

### New Files

1. **`src/pages/DashboardViewer/GridFormattingModal.tsx`**
   - Modal component with two tabs: "Basic Properties" and "Conditional Formatting" (placeholder)
   - Left panel: Tree view to select Grid (all rows) or individual columns
   - Right panel: Formatting options
     - Display Name (column rename, for individual columns only)
     - Background Color (color picker + hex input)
     - Text Color (color picker + hex input)
     - Font Family dropdown
     - Font Size dropdown
     - Bold/Italic/Underline toggles
     - Live preview of formatting
     - Reset to Default button

### Modified Files

1. **`src/types/database.ts`**
   - Added `GridColumnFormatting` interface for individual formatting properties
   - Added `GridFormattingRules` interface with `grid` and `columns` properties
   - Updated `GridTemplate` interface to use typed `formatting_rules`

2. **`src/hooks/useGridTemplates.ts`**
   - Added `updateFormattingRules` method to save formatting rules to a template

3. **`src/pages/DashboardViewer/index.tsx`**
   - Added Palette icon button to cell headers (left of filter button)
   - Added state for formatting modal and cell columns
   - Added handlers for opening modal, saving formatting, and detecting columns
   - Integrated GridFormattingModal component
   - Pass formatting rules and onColumnsDetected to DashboardCell

4. **`src/pages/DashboardViewer/DashboardCell.tsx`**
   - Added `onColumnsDetected` and `formattingRules` props
   - Implemented cell formatter that applies grid and column-level formatting
   - Column formatting overrides grid formatting
   - Applied custom display names to column headers
   - Re-renders when formatting rules change

## How It Works

1. User clicks the palette icon in a cell header
2. GridFormattingModal opens showing available columns
3. User selects "Grid" (applies to all rows) or a specific column
4. User configures formatting options (colors, fonts, styles)
5. Preview updates in real-time
6. User clicks "Apply" to save formatting to the current template
7. Grid updates with the new formatting

## Template Integration

- Formatting is stored in the `formatting_rules` JSONB column of `grid_templates`
- When switching templates, formatting automatically changes
- Each template can have completely different formatting settings

## Formatting Structure

```typescript
interface GridFormattingRules {
  grid?: GridColumnFormatting;  // Applies to all rows/columns
  columns?: Record<string, GridColumnFormatting>;  // Per-column overrides
}

interface GridColumnFormatting {
  displayName?: string;      // Column header rename
  backgroundColor?: string;  // Cell background color
  textColor?: string;        // Text color
  fontFamily?: string;       // Font family
  fontSize?: number;         // Font size in pixels
  bold?: boolean;            // Bold text
  italic?: boolean;          // Italic text
  underline?: boolean;       // Underlined text
}
```

## Bug Fix: Grid Flickering

Fixed an issue where grids would flicker repeatedly after the initial implementation. The cause was that `formattingRules` was an object prop that created a new reference on every render, causing the Tabulator useEffect to trigger repeatedly.

**Fix**: Changed the useEffect dependency from `formattingRules` (object) to `formattingRulesKey` (JSON string), which only changes when the actual formatting content changes.

## Future Work

- Conditional Formatting tab (currently placeholder)
- More formatting options (alignment, number formatting, etc.)
