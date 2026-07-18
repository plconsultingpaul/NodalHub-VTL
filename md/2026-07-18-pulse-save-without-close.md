# Pulse Save Without Close

**Date:** 2026-07-18

## Summary

Changed the Pulse Builder "Save" button so it only saves the record without automatically closing the builder. Previously, saving a newly created pulse would close the builder immediately after the first save. Now the builder stays open after save, and the user must explicitly click "Close" to exit.

## Changes

### `src/pages/PulseBuilder/index.tsx`
- After saving a new pulse, instead of calling `closePulseBuilder()`, the code now calls `openPulseBuilder(projectId, pulseId)` to update the context with the newly created pulse ID. This keeps the builder open and allows subsequent saves to function as updates.
- Added `openPulseBuilder` to the destructured values from `useActiveDashboards()`.
