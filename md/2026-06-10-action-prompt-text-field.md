# Action Parameter Prompt Text Field

**Date:** 2026-06-10

## Problem

When a Cell Action parameter was set to "Prompt" type, the prompt dialog shown to the user at execution time displayed the raw `@parameterName` as the label. There was no way to configure a user-friendly prompt message.

## Solution

Added a `promptText` field to the prompt mapping configuration so admins can enter custom text that will be shown to the user when the action executes.

## Changes

### `src/types/database.ts`
- Added `promptText?: string` to the `ActionParameterMapping` interface.

### `src/pages/DashboardViewer/ActionsConfigModal.tsx`
- Added `handleMappingPromptTextChange` handler function.
- Added a text input field (placeholder: "Prompt text shown to user") that appears when target is set to "Prompt", positioned between the Type dropdown and the value type dropdown.

### `src/pages/DashboardViewer/DashboardCell.tsx`
- Changed the prompt dialog label from `{m.parameterName}` to `{m.promptText || m.parameterName}`, so it shows the custom prompt text if configured and falls back to the parameter name if not.

## Notes
- No database migration needed -- `parameter_mappings` is stored as JSONB, so the new key is backwards-compatible with existing data.
