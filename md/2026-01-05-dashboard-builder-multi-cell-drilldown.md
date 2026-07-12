# Dashboard Builder with Multi-Cell Layout and Drill-Down Support

**Date:** 2026-01-05

## Overview

Implemented a comprehensive dashboard system that allows users to create multi-cell dashboards with drill-down query support. Users can run multiple dashboards simultaneously and switch between them.

## Changes Made

### Database

**New Tables:**
- `dashboard_cells` - Stores cell configuration within dashboards
  - Supports flexible grid layout with row/column positioning and spanning
  - Links to queries for data display
  - Includes settings JSON for cell-specific options

- `dashboard_cell_drilldowns` - Stores drill-down query configuration
  - Links cells to drill-down queries
  - Includes link field for parent-child data relationship
  - Supports ordering for multiple drilldowns per cell

**Migration:** `20260105_create_dashboard_cells_and_drilldowns.sql`

### New Files

**Contexts:**
- `src/contexts/ActiveDashboardsContext.tsx` - Manages open dashboards state, active dashboard selection, and builder state

**Hooks:**
- `src/hooks/useDashboardConfig.ts` - CRUD operations for dashboard cells and drilldowns

**Pages:**
- `src/pages/DashboardBuilder/index.tsx` - Full-sized inline dashboard configuration window
- `src/pages/DashboardBuilder/CellConfigPanel.tsx` - Cell configuration panel with query selection and drilldown management
- `src/pages/DashboardViewer/index.tsx` - Runtime dashboard view with tab-based multi-dashboard support
- `src/pages/DashboardViewer/DashboardCell.tsx` - Individual cell rendering with Tabulator and drill-down expansion

### Modified Files

- `src/types/database.ts` - Added types for dashboard_cells and dashboard_cell_drilldowns
- `src/App.tsx` - Added ActiveDashboardsProvider
- `src/pages/Home.tsx` - Conditionally renders DashboardBuilder, DashboardViewer, or default home content
- `src/components/layout/Sidebar.tsx` - Added Active Dashboards section and updated folder plus button handler

## Features

### Dashboard Builder
- Full-sized inline configuration window (opens when clicking + beside a folder)
- Defaults to one cell filling the entire window
- Top toolbar with Add Row, Split Cell, and Save buttons
- Visual grid editor for cell layout
- Cell configuration panel:
  - Title
  - Main query selection
  - Row/column span controls
  - Drill-down query management

### Dashboard Viewer
- Displays configured cells in a responsive grid layout
- Each cell renders data using Tabulator tables
- Supports pagination, sorting, and column resizing
- Header shows dashboard name with refresh and edit buttons

### Multi-Dashboard Support
- Run multiple dashboards simultaneously
- Active Dashboards section in sidebar shows open dashboards
- Click to switch between dashboards
- X button to close individual dashboards
- Tab bar when multiple dashboards are open
- Green indicator on dashboards that are currently open

### Drill-Down Functionality
- Cells with drilldowns show expand icon (>) on each row
- Clicking expand loads drill-down data inline
- Link field connects parent row to child query
- Supports multiple drill-down levels per cell
- Loading states for drilldown data

## Usage

1. **Create Dashboard:** Click the + button beside a folder in the Dashboards section
2. **Configure Layout:** Use Add Row/Split Cell to create desired grid
3. **Select Queries:** Click a cell and choose a query from the dropdown
4. **Add Drilldowns:** In cell config, click Add under Drill-Down Queries
5. **Save:** Click Save Dashboard to save and view
6. **View:** Click any dashboard to open it; multiple can be open simultaneously
7. **Switch:** Use Active Dashboards section or tabs to switch between open dashboards
