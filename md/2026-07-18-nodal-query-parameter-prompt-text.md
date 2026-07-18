# Nodal Connect Query - Parameter Prompt Text

**Date:** 2026-07-18

## Summary

Added the ability to customize the prompt description for user parameters in Nodal Connect queries. Previously, the prompt text was auto-generated from the parameter name (e.g., `@Vendor_id` would always prompt "Vendor_id"). Now users can specify a custom prompt (e.g., "Enter the Vendor ID to search") that will be shown when the dashboard prompts for parameter values.

## Changes

### `src/pages/QueryManager/NodalConnectQueryForm.tsx`

- Added a "Prompt text" input field below each parameter name in the Parameters section.
- Changed the auto-prompt behavior: the prompt is only auto-generated from the parameter name if the user has not manually edited it. Once a custom prompt is entered, renaming the parameter will not overwrite it.

## Behavior

- The prompt text field placeholder reads: "Prompt text shown to user (e.g. Enter the Vendor ID)"
- When a new parameter is added, the prompt defaults to the parameter name without the `@` prefix.
- If the user customizes the prompt and later renames the parameter, the custom prompt is preserved.
- The dashboard "Enter Parameters" dialog displays the prompt text from this field.
