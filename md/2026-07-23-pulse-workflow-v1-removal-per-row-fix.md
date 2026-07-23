# Pulse Workflow V1 Removal & Per-Row Email Fix

**Date:** 2026-07-23

## Summary

Consolidated the Pulse execution engine to use only the V2 ReactFlow workflow path. Removed all V1 legacy execution code and dead frontend files. Fixed the per-row/per-group email processing mode that was not working in the V2 workflow.

## Problem

- The V2 workflow email step ignored the `runMode` setting from the Query step config
- When "Per Row" was selected as the processing mode, the system still sent a single email with all rows (behaving like "Per Result Set")
- The V1 legacy execution path (which did support per-row) was dead code since all pulses were already V2

## Changes

### Edge Function: `pulse-runner/index.ts`

1. **Removed V1 legacy execution block** (~370 lines deleted)
   - The entire `V1 LEGACY EXECUTION` section that handled `pulse.query_id` + iterating via `pulse.run_mode` is gone
   - The V2 workflow path is now the only execution path
   - If a pulse has no `canvas_data`/`step_configs`, it throws a clear error

2. **Added per-row/per-group iteration to the V2 email step**
   - The email step now looks up the upstream query node's `runMode` from `stepConfigs`
   - If `runMode === "per_row"`: wraps each row in its own iteration and sends one email per row
   - If `runMode === "per_group"`: groups rows by the specified `groupByField` and sends one email per group
   - If `runMode === "result_set"` (default): sends one email with all rows (existing behavior)
   - Recipient token resolution (`{{column}}`) is done per-iteration so each email can target a different recipient based on row data

### Frontend: `src/pages/PulseBuilder/`

1. **Deleted dead V1 files:**
   - `QueryTab.tsx` - was not imported anywhere
   - `EmailTab.tsx` - was not imported anywhere
   - `ExportTab.tsx` - was not imported anywhere
   - `PostRunTab.tsx` - was not imported anywhere
   - `LegacyMigration.tsx` - conversion wizard no longer needed (no V1 pulses exist)

2. **Simplified `index.tsx`:**
   - Default view is now `'workflow'` (was `'info'`)
   - Removed `'migrate'` view mode and the "Convert to Workflow" button
   - Removed `Sparkles` icon import (was only for the convert button)
   - Removed `LegacyMigration` import
   - Save logic no longer writes `query_id`, `run_mode`, or `group_by_field` to the pulses table
   - `workflow_version` is now always set to `2` (was conditional on having canvas nodes)

### Database

- No schema changes (V1 columns remain in the table but are no longer written to)
- All 5 existing pulses were already `workflow_version = 2` with canvas data

## Testing

- Set a Pulse query step to "Per Row" processing mode
- Run the pulse -- it should now send one email per row from the query results
- "Per Group" mode should group by the configured field and send one email per group
- "Per Result Set" (default) continues to send one email with all data
