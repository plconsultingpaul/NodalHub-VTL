# Drilldown Column Width - Percentage to Pixel Conversion Fix

**Date:** 2026-01-08

## Problem

Drilldown tables were not respecting saved column widths from templates. Even when widths were stored as percentages (e.g., 82%, 9%, 9%), all columns rendered at 40px.

## Root Cause

The `setTimeout(..., 0)` used before initializing the drilldown Tabulator instance was not sufficient for the browser to complete layout calculations. When Tabulator received percentage-based width values like `"82%"`, the container element had not yet been assigned a calculated width by the browser, causing Tabulator to fall back to minimum widths.

## Solution

Changed `setTimeout` to `requestAnimationFrame` which ensures the browser has completed at least one layout pass. After layout is complete, the container's `offsetWidth` is read and percentage widths are converted to pixel values before passing to Tabulator.

## Changes Made

**File:** `src/pages/DashboardViewer/DashboardCell.tsx`

- Replaced `setTimeout(() => {...}, 0)` with `requestAnimationFrame(() => {...})`
- Added logic to read `tableContainer.offsetWidth` after layout
- Added conversion of percentage widths to pixel widths before initializing Tabulator
- Columns with percentage widths like `"82%"` are now converted to actual pixel values (e.g., `820` for a 1000px container)
