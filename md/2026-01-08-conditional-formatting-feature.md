# Conditional Formatting Feature

**Date:** 2026-01-08

## Overview

Added a comprehensive conditional formatting feature to the Grid Formatting modal, allowing users to create rules that dynamically style cells and rows based on data conditions.

## Changes Made

### 1. New Types (database.ts)

Added the following TypeScript types to support conditional formatting:

- `ConditionalDataType` - Data types for conditions: Text, Date, Integer, Double (with Fixed variants)
- `ConditionalComparison` - Comparison operators: Equals, Not Equals, Greater Than, Less Than, Contains, Starts With, Is Null or Empty, Is Like, etc.
- `BlinkSpeed` - Animation speeds: slow, medium, fast
- `ConditionalFormattingCondition` - Individual condition with column, data type, comparison, and value
- `ConditionalFormattingAppearance` - Formatting options extending basic formatting with blinking and image placeholder
- `ConditionalFormattingRule` - Named rule with sequence, enabled state, condition type (AND/OR), conditions, and formatting
- `ConditionalFormatting` - Target (grid or column) with associated rules

### 2. New Component (ConditionalFormattingTab.tsx)

Created a new component for the Conditional Formatting tab with three panels:

**Left Panel - Target Selection:**
- Grid (All Rows) option
- Expandable Columns list

**Center Panel - Rules List:**
- Add, Remove, Move Up, Move Down, Copy buttons
- Checkbox to enable/disable rules
- Rule name display

**Right Panel - Rule Configuration:**
- Rule Name input
- Condition Type selector (AND/OR)
- Conditions grid with:
  - Column dropdown (all grid columns)
  - Data Type dropdown (8 options with Fixed variants)
  - Comparison dropdown (13 operators)
  - Value input or Fixed Value picker
- Appearance section with:
  - Background Color picker
  - Text Color picker
  - Font selector
  - Bold, Italic, Underline toggles
  - Blinking toggle with speed selector (Slow/Medium/Fast)
  - Image placeholder checkbox (coming soon)
- Live preview

### 3. Updated GridFormattingModal.tsx

- Imported and integrated the ConditionalFormattingTab component
- Replaced placeholder content with the new tab component

### 4. CSS Animations (index.css)

Added blinking animations with three speeds:
- `blink-slow` - 2 second cycle
- `blink-medium` - 1 second cycle
- `blink-fast` - 0.5 second cycle

### 5. Updated DashboardCell.tsx

Enhanced the cell formatter to apply conditional formatting:

- `evaluateCondition()` - Evaluates a single condition against row data
- `evaluateRule()` - Evaluates all conditions in a rule (AND/OR logic)
- `findMatchingRule()` - Finds the first matching rule (by sequence order)
- `applyFormattingToElement()` - Applies formatting including blinking classes
- Updated `buildCellFormatter()` to apply conditional formatting after basic formatting

## Rule Evaluation Order

1. Basic grid formatting applied first
2. Basic column formatting applied (overrides grid)
3. Conditional grid rules evaluated (first match by sequence wins)
4. Conditional column rules evaluated (first match by sequence wins)

## Supported Comparisons

| Comparison | Text | Date | Integer/Double |
|------------|------|------|----------------|
| Equals | Yes | Yes | Yes |
| Not Equals | Yes | Yes | Yes |
| Greater Than | - | Yes | Yes |
| Greater Than or Equal | - | Yes | Yes |
| Less Than | - | Yes | Yes |
| Less Than or Equal | - | Yes | Yes |
| Contains | Yes | - | - |
| Not Contains | Yes | - | - |
| Starts With | Yes | - | - |
| Doesn't Start With | Yes | - | - |
| Is Null or Empty | Yes | Yes | Yes |
| Is Like | Yes | - | - |
| Is Not Like | Yes | - | - |

## Fixed Value Integration

When selecting a Data Type with "(Fixed)" suffix (e.g., "Text (Fixed)"), the Value input becomes a dropdown populated with Fixed Values of the matching type from the company's Fixed Values configuration.

## Files Modified

- `src/types/database.ts` - Added conditional formatting types
- `src/pages/DashboardViewer/GridFormattingModal.tsx` - Integrated new tab, increased modal size to 2xl (max-w-6xl) and height to 600px
- `src/pages/DashboardViewer/DashboardCell.tsx` - Added conditional formatting evaluation
- `src/index.css` - Added blinking animations
- `src/components/ui/Modal.tsx` - Added '2xl' size option (max-w-6xl)

## Files Created

- `src/pages/DashboardViewer/ConditionalFormattingTab.tsx` - New conditional formatting UI
