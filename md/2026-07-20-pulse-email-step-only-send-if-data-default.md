# 2026-07-20 Pulse Email Step Only-Send-If-Data Default True

## Problem

When adding a new Email step in the Pulse Workflow, the "Only send if data exists" toggle defaulted to off. In practice, users almost always want emails to be suppressed when there is no data, so this should default to on.

## Changes

### `src/pages/PulseBuilder/panels/EmailConfigPanel.tsx`

- Added `onlySendIfResults: true` to the `baseConfig` defaults (before the `...config` spread), so new Email steps start with this toggle enabled. Existing saved pulses that explicitly set the field to `false` will still override the default.
