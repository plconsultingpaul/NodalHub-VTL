# Pulse Feature - Complete

**Date:** 2026-06-04
**Status:** Shipped

---

## Overview

A **Pulse** is a scheduled task that runs a saved Query, optionally exports the
results to CSV/XLSX, emails them via Office 365, and (eventually) runs follow-up
API calls. Pulses live under projects with `type = 'pulse'` in the sidebar.

This document summarizes the data model, runtime, and UI surface that ship the
feature.

---

## Data flow

```
Pulse Builder (UI)  ->  pulses + pulse_* config tables (DB)
                                     |
                                     v
Schedule Manager (UI)  ->  cron-manager edge fn  ->  pg_cron job
                                                          |
                                                          v
                                            pulse-scheduler edge fn (worker)
                                                          |
                                                          v
                                       pulse-runner (per pulse, per row/group)
                                          |        |        |
                                          v        v        v
                                       Query    Export    Email    Post Run APIs
```

---

## Database

| Table | Purpose |
| --- | --- |
| `pulses` | Pulse definition (name, query, run mode, group field, active). |
| `pulse_schedules` | One row per pulse: cron expression, timezone, enabled flag, next/last run. |
| `pulse_exports` | One row per pulse: CSV/XLSX format, filename template, headers toggle. |
| `pulse_emails` | One row per pulse: To/Cc/Bcc, subject/body templates, attach toggle. |
| `pulse_post_run_steps` | Placeholder for future post-run API calls. |
| `pulse_executions` | Run history: started/finished, status, row_count, error_message, export_path. |
| `system_configuration` | Holds the `pulse_scheduler` enabled flag and `scheduler_connection` (URL + anon key). |

All tables are RLS-restricted to members of the owning company. Reads on
`pulse_executions` are limited to company members; writes are limited to the
service role (the runner uses it).

### Storage

Bucket `pulse-exports` (private). Path convention:
`<pulse_id>/<execution_id>-<safe_filename>`. Read access is granted to
authenticated members of the pulse's company; writes are service-role only.

---

## Edge functions

- `pulse-runner` (`verify_jwt=false`): receives `{ pulseId, triggerSource }`,
  inserts a `pulse_executions` row, fetches the query, branches on
  `run_mode` (`result_set` / `per_row` / `per_group`), generates exports,
  uploads to the bucket, sends Office 365 mail, finalizes the execution row.
- `pulse-scheduler` (`verify_jwt=false`): selects all enabled pulse schedules
  whose `next_run_at <= now()`, recomputes `next_run_at` from the cron
  expression, and fires `pulse-runner` per due pulse.
- `cron-manager` (`verify_jwt=true`, admin-gated): exposes `/status`,
  `/enable`, `/disable`, `/jobs`, `/settings`, `/test-connection`. Used by the
  Schedule Manager page.

---

## UI surface

- **Sidebar**
  - Pulse folders show their pulses with rename / duplicate / delete actions.
  - The "+" button on a pulse folder opens the Pulse Builder.
- **Pulse Builder** (`src/pages/PulseBuilder/`): five tabs (Main, Query, Export,
  Email, Post Run). Header offers Save, Close, Run Now, Duplicate. Status
  footer shows the last execution.
- **Schedule Manager** (`/settings/schedule`, admin-only): scheduler status,
  frequency picker, connection settings modal, per-pulse table with Run Now,
  Edit Cron, and Enable/Disable schedule actions.

---

## Suggested follow-ups

- Build out `pulse_post_run_steps` configuration and runner support.
- Add a retention sweep that deletes `pulse-exports` objects older than 30 days.
- Surface a downloadable link for the most recent export from the Pulse Builder
  status footer (signed URL via the storage RLS policy).
