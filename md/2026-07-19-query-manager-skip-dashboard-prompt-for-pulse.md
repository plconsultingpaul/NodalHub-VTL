# 2026-07-19 Query Manager Skip Dashboard Prompt for Pulse Queries

## Problem

When creating a new query in the Query Manager with the Application set to "Pulse", the system still prompted the user to create a Dashboard from that query. This is incorrect since pulse-targeted queries are not intended for dashboards.

## Changes

### `src/pages/QueryManager/index.tsx`

- Added `&& data.app_target !== 'pulse'` to the condition that triggers the "Create Dashboard from Query" modal after saving a new query. Queries with `app_target` set to `'pulse'` now skip this prompt entirely.
