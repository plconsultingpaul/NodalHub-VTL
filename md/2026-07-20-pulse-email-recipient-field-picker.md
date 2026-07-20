# Pulse Email Recipient Field Picker

## Summary

Added a `{ }` field picker button to the To, CC, and BCC fields in the Pulse Email step configuration. This allows users to select a column from an upstream query's results as a dynamic email recipient. At runtime, the pulse-runner resolves those field tokens into actual email addresses extracted from the query result rows.

## Changes

### `src/pages/PulseBuilder/panels/EmailConfigPanel.tsx`

- Added `availableColumns` prop to `CompactChipsInput` component.
- Added a `{ }` (Braces icon) button next to the existing Users picker on To, CC, and BCC fields.
- Clicking the button opens a dropdown listing all columns from the selected data source query.
- Selecting a column inserts a `{{column_name}}` token as a chip, styled distinctly (indigo background, monospace font) to differentiate from static emails.
- Email validation is skipped for `{{...}}` tokens so they can coexist with regular email addresses.
- Added a `useEffect` that fetches column names from the data source query (`last_known_columns` or `api_endpoint_fields` fallback) and stores them in `recipientColumns` state.
- Added outside-click dismissal for the field picker dropdown.

### `supabase/functions/pulse-runner/index.ts`

- Added `resolveRecipientTokens()` helper function inside the email step execution block.
- For each recipient entry matching `{{column_name}}`, the function iterates over all query result rows, extracts unique values from that column that contain `@` (basic email validation), and adds them to the resolved list.
- Static email addresses pass through unchanged.
- All downstream references (`to`, `cc`, `bcc` sent to the email provider, step results logging) now use the resolved arrays.

## Behavior

- A user can mix static emails, team member selections, and `{{field}}` tokens in the same To/CC/BCC field.
- At runtime, if the query returns 5 rows with an `email` column, `{{email}}` resolves to up to 5 unique email addresses merged into the recipient list.
- If the query returns no rows and `onlySendIfResults` is true, the email is skipped as before.
- If a `{{column}}` token references a column that doesn't exist in the results or contains no valid emails, it simply resolves to nothing (no error, no send failure).

## No Database Migration Required

The `step_configs` JSONB column already stores recipient arrays as `string[]`. The `{{column_name}}` tokens are just strings stored alongside normal email addresses.
