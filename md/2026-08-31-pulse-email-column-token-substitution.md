# Pulse Email Column Token Substitution

Date: 2026-08-31

## Problem

In the V2 Pulse email step, per-group emails resolved the recipient's `{{COLUMN}}` tokens (e.g. `{{EMAIL}}`) from that group's rows, but the subject and body only resolved a fixed token set (`{pulse_name}`, `{date}`, `{group}`, `{row_count}`, `{results_table}`) plus cell-action input variables. Templates that used `{AGENT_NAME}` (or `{{AGENT_NAME}}`) referring to a query result column came through as literal text.

## Fix

Edited `supabase/functions/pulse-runner/index.ts` in the per-iteration email loop:

- After the fixed-token and input-variable substitutions, build a `rowContext` from the iteration's representative row (`rows[0]`). For per-group iterations this uses the first row of the group; for per-row iterations it uses that row.
- Added `substituteRowColumns(text)` which replaces both `{ColumnName}` (single-brace) and `{{ColumnName}}` (double-brace) with `rowContext[ColumnName]`, skipping reserved token names (`pulse_name`, `date`, `group`, `row_count`, `results_table`) so those keep their built-in meaning.
- Applied the substitution to both `finalSubject` and `finalBody`.

Result: the email subject and body now show the column value for that specific group / row, matching the behavior of the recipient field.

## Deploy

`pulse-runner` edge function redeployed.
