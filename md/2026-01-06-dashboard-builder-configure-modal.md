# Dashboard Builder - Cell Configuration Modal

**Date:** 2026-01-06

## Summary

Moved the Cell Configuration panel from a permanent sidebar to a modal dialog accessed via a Configure button in the toolbar.

## Changes Made

### Dashboard Builder (`src/pages/DashboardBuilder/index.tsx`)

1. Added `Settings` icon import from lucide-react
2. Added `Modal` component import
3. Added `configModalOpen` state to control modal visibility
4. Added "Configure" button to the header toolbar (disabled when no cell is selected)
5. Removed the permanent sidebar containing the Cell Configuration panel
6. Added Modal component that displays CellConfigPanel when opened

### Cell Config Panel (`src/pages/DashboardBuilder/CellConfigPanel.tsx`)

1. Removed "Select a cell to configure" placeholder message (returns null instead)
2. Simplified container styling for modal context

## User Experience

- The dashboard grid now uses the full available width
- Users click a cell to select it, then click "Configure" to open the configuration modal
- The Configure button is disabled when no cell is selected
- All configuration options (title, query, row/column span, drilldowns) remain available in the modal
