# Pulse Feature - Implementation Plan

**Date:** 2026-06-03
**Status:** Planning

---

## Overview

A **Pulse** is a scheduled task that executes a saved Query, optionally exports results, emails them, and runs follow-up API calls. Pulses live under projects with `type = 'pulse'` (the project/folder scaffold already exists in the sidebar). This plan adds the missing execution and configuration layer plus a Schedule Manager that uses Postgres `pg_cron` + `pg_net` (per the scheduling reference).

### Current State (already in place)
- `projects.type = 'pulse'` enum and pulse folders in the sidebar.
- Sidebar "+" button on a Pulse folder calls `handleAddItemToFolder(projectId, 'pulse')` but the handler currently does nothing for pulse.
- Query Manager and `useQueries.testQuery()` are already used by dashboards and can be reused.
- `api-proxy` edge function exists for outbound HTTP calls.

### Missing (this plan)
- A `pulses` table and per-config tables (schedule, export, email, post-run).
- A Pulse Builder page (multi-tab) that opens in the left content area like `DashboardBuilder`.
- A `Schedule Manager` settings page driven by `pg_cron`.
- Edge functions: `pulse-runner`, `pulse-scheduler`, `cron-manager`.
- Run history (`pulse_executions`).

---

## Architecture Summary

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

## Task List

Each task is self-contained. Reference a task by its number/title (e.g., "do Task 3") when ready to implement.

---

### Task 1 — Database: `pulses` core table + RLS

Create the foundational table and RLS policies.

**Migration:** `create_pulses_table.sql`

- `pulses` (id uuid PK, company_id, project_id FK -> projects, name text, description text, is_active boolean default false, query_id FK -> queries nullable, run_mode text check in ('result_set','per_row','per_group') default 'result_set', group_by_field text nullable, created_by, created_at, updated_at, last_run_at nullable, last_run_status text nullable).
- RLS enabled. Four policies (select/insert/update/delete) restricted to company members. `delete` may further restrict to admin or creator (TBD with user — will default to any company member, following the existing dashboards pattern).
- Index on `(company_id, project_id)`.

**Acceptance:** Migration applies cleanly. RLS verified to allow only company members.

---

### Task 2 — Database: Pulse config sub-tables

Create one row per pulse for each config aspect (kept normalized so each tab edits its own row).

**Migration:** `create_pulse_config_tables.sql`

- `pulse_schedules` (pulse_id PK FK, enabled boolean default false, cron_expression text default '0 * * * *', timezone text default 'UTC', last_scheduled_at timestamptz, next_run_at timestamptz, updated_at).
- `pulse_exports` (pulse_id PK FK, enabled boolean default false, format text check in ('csv','xlsx') default 'csv', filename_template text, include_headers boolean default true, updated_at).
- `pulse_emails` (pulse_id PK FK, enabled boolean default false, to_recipients text[] default '{}', cc_recipients text[] default '{}', bcc_recipients text[] default '{}', subject_template text, body_template text, attach_export boolean default true, only_send_if_results boolean default true, updated_at).
- `pulse_post_run_steps` (id PK, pulse_id FK, sort_order int, name text, config jsonb, created_at) — placeholder shape per user note "I will add more details after".
- All four tables get RLS that joins through `pulses.company_id` so policies match Task 1.

**Acceptance:** Each table has its own SELECT/INSERT/UPDATE/DELETE policies tied to membership in `pulses.company_id`.

---

### Task 3 — Database: `pulse_executions` (run history)

Track every run for diagnostics and the Schedule Manager status panel.

**Migration:** `create_pulse_executions_table.sql`

- Columns: id, pulse_id FK, started_at, finished_at, status ('running','success','error','partial'), trigger_source ('manual','schedule'), row_count int, error_message text, result_summary jsonb, export_path text nullable.
- RLS: read by company members; insert/update by service role only (worker writes).
- Index on `(pulse_id, started_at desc)`.

**Acceptance:** Worker function (Task 11) can write rows; UI can read its own company's history.

---

### Task 4 — Database: `system_configuration` + cron functions

Foundation for the Schedule Manager (mirrors the reference architecture).

**Migration:** `create_scheduler_infrastructure.sql`

- Enable `pg_cron` and `pg_net` extensions (`CREATE EXTENSION IF NOT EXISTS`).
- Create `system_configuration (config_key unique, config_value jsonb, ...)` with admin-only RLS.
- Seed two rows: `pulse_scheduler` (enabled=false, schedule='*/5 * * * *', job_name='invoke_pulse_scheduler') and `scheduler_connection` (supabase_url='', anon_key='').
- SECURITY DEFINER functions:
  - `manage_pulse_scheduler_cron(p_schedule text)` — schedules the cron job that POSTs to `/functions/v1/pulse-scheduler`.
  - `remove_pulse_scheduler_cron()` — unschedules.
  - `get_pulse_scheduler_status()` — returns json with `enabled`, `job_exists`, `schedule`, `connection_configured`, `active_pulses_count`, `last_run`, `status`.
  - `get_cron_jobs()` — debug helper.

**Acceptance:** Admin can call each function directly via SQL and get expected results.

---

### Task 5 — Types + hooks: `usePulses` and `usePulseConfig`

TypeScript types and React hooks for CRUD on the new tables.

**Files:**
- `src/types/database.ts` — add `Pulse`, `PulseSchedule`, `PulseExport`, `PulseEmail`, `PulsePostRunStep`, `PulseExecution` interfaces.
- `src/hooks/usePulses.ts` — `pulses` list, `createPulse`, `updatePulse`, `deletePulse`, `togglePulseActive` (scoped to active company).
- `src/hooks/usePulseConfig.ts` — fetch/upsert each config row by `pulse_id`.

**Acceptance:** Hooks compile and follow the existing patterns from `useDashboardConfig`/`useQueries`.

---

### Task 6 — Sidebar wiring: open Pulse Builder on "+"

Make the sidebar Pulse "+" button open the new builder.

**Files:**
- `src/contexts/ActiveDashboardsContext.tsx` — add `pulseBuilderProjectId`, `pulseBuilderPulseId`, `isPulseBuilderOpen`, `openPulseBuilder(projectId, pulseId?)`, `closePulseBuilder()`. Keep dashboard builder state separate.
- `src/components/layout/Sidebar.tsx` — in `handleAddItemToFolder`, branch `type === 'pulse'` to call `openPulseBuilder(projectId)`.
- Sidebar listing of dashboards under a pulse folder needs review — likely we render `pulses` list (not `dashboards`) when project type is `pulse`. Update `useProjects` accordingly.

**Acceptance:** Clicking "+" on a Pulse folder opens an empty Pulse Builder in the left pane.

---

### Task 7 — Pulse Builder shell + routing

Mirror the DashboardBuilder pattern.

**Files:**
- `src/pages/PulseBuilder/index.tsx` — top-level component. Reads `pulseBuilderPulseId`/`pulseBuilderProjectId` from context. Handles save (creates the pulse row on first save, then upserts config rows).
- `src/pages/PulseBuilder/PulseTabs.tsx` — internal tab nav: `Main`, `Query`, `Export`, `Email`, `Post Run`.
- `src/pages/Home.tsx` — render `<PulseBuilder />` when `isPulseBuilderOpen`, mirroring how `DashboardBuilder` is rendered.

**Acceptance:** Builder opens, tabs switch, header has a Save and Close button. No data changes yet.

---

### Task 8 — Pulse Builder: Main tab

**File:** `src/pages/PulseBuilder/MainTab.tsx`

- Fields: Name (required), Description (textarea), Active toggle.
- Saves to the `pulses` row.
- Shows created/updated timestamps and last run status (read-only).

**Acceptance:** Editing fields and saving persists to `pulses`.

---

### Task 9 — Pulse Builder: Query tab + Test panel

**File:** `src/pages/PulseBuilder/QueryTab.tsx`

- Query selector (dropdown) populated from `useQueries`.
- Run Mode radio/select: `Result Set`, `Per Row`, `Per Group`.
- When `Per Group`: Group-By Field selector populated from the last test result's column names (and from query metadata if available).
- **Test** button: calls `useQueries.testQuery()` and renders results in a bottom panel using a simple table (reuse `Tabulator` widget or a lightweight grid). Show row count, status, and full URL.
- Saves: `query_id`, `run_mode`, `group_by_field` to `pulses`.

**Acceptance:** Selecting a query, hitting Test, seeing rows, choosing a group-by column, and saving works end-to-end.

---

### Task 10 — Pulse Builder: Export tab

**File:** `src/pages/PulseBuilder/ExportTab.tsx`

- Enabled toggle.
- Format: CSV / XLSX.
- Filename template (supports `{pulse_name}`, `{date}`, `{group}` tokens).
- Include headers toggle.
- Saves to `pulse_exports`.

**Note:** XLSX generation will live in the worker (Task 12). UI just stores config.

**Acceptance:** Settings persist; preview of resolved filename shown.

---

### Task 11 — Pulse Builder: Email tab

**File:** `src/pages/PulseBuilder/EmailTab.tsx`

- Enabled toggle.
- To / CC / BCC chip inputs (multi-email, validated).
- Subject template, Body template (textarea, supports tokens).
- "Attach export" toggle (disabled if Export is not enabled).
- "Only send if there are results" toggle.
- Saves to `pulse_emails`.

**Acceptance:** Settings persist; chip input rejects invalid emails.

---

### Task 12 — Pulse Builder: Post Run tab (placeholder)

**File:** `src/pages/PulseBuilder/PostRunTab.tsx`

- Empty state with note: "Coming soon — call other APIs after the email is sent, passing data from the query."
- Backed by `pulse_post_run_steps` (already created in Task 2) so structure is ready for a future expansion.

**Acceptance:** Tab renders placeholder with no errors.

---

### Task 13 — Edge function: `pulse-runner`

Executes a single pulse end-to-end.

**File:** `supabase/functions/pulse-runner/index.ts`

- POST body: `{ pulseId, triggerSource: 'manual' | 'schedule' }`.
- Steps:
  1. Insert `pulse_executions` row (status='running').
  2. Load pulse + query + export/email config.
  3. Resolve query parameters (mirror `useQueries.testQuery` logic; reuse `api-proxy` edge function via internal call or replicate logic).
  4. Branch on `run_mode`:
     - `result_set` — single result block.
     - `per_row` — iterate each row.
     - `per_group` — group rows by `group_by_field`, iterate groups.
  5. If export enabled: build CSV (native) or XLSX (use `npm:exceljs` or `npm:xlsx`) per iteration, upload to Supabase Storage bucket `pulse-exports`, capture path.
  6. If email enabled and (results exist OR `only_send_if_results=false`): send via existing Office365 settings (reuse `useO365Settings`/an edge function — may need a new `send-email` helper if none exists). Attach export when configured.
  7. Update `pulse_executions` (status, row_count, error_message, result_summary).
  8. Update `pulses.last_run_at` and `last_run_status`.

**Acceptance:** Manual run from the Pulse Builder header succeeds, writes an execution row, sends email/produces export.

---

### Task 14 — Edge function: `pulse-scheduler` (worker)

Called by `pg_cron` every N minutes.

**File:** `supabase/functions/pulse-scheduler/index.ts`

- Selects all `pulses` joined with `pulse_schedules` where `is_active=true` and `pulse_schedules.enabled=true` and `next_run_at <= now()` (or computed from cron expression).
- For each due pulse: invoke `pulse-runner` with `triggerSource='schedule'` (use `EdgeRuntime.waitUntil` to fire-and-forget).
- Update `pulse_schedules.last_scheduled_at` and compute next `next_run_at` from `cron_expression`.

**Acceptance:** When invoked manually it picks due pulses and triggers them.

---

### Task 15 — Edge function: `cron-manager`

Admin API to enable/disable the scheduler and store connection settings, mirroring the reference.

**File:** `supabase/functions/cron-manager/index.ts`

Routes:
- `GET /cron-manager/status` -> `get_pulse_scheduler_status()`.
- `POST /cron-manager/enable` `{ schedule }` -> `manage_pulse_scheduler_cron(schedule)`.
- `POST /cron-manager/disable` -> `remove_pulse_scheduler_cron()`.
- `GET /cron-manager/jobs` -> `get_cron_jobs()`.
- `GET /cron-manager/settings` -> read `scheduler_connection`.
- `POST /cron-manager/settings` `{ supabase_url, anon_key }` -> upsert.

Auth: service role OR authenticated admin (`profiles.is_admin`). CORS per project standard.

**Acceptance:** All routes return expected JSON. Errors are surfaced.

---

### Task 16 — Settings: Schedule Manager page

Listing of pulses with per-pulse schedule controls plus master scheduler status.

**Files:**
- `src/pages/Settings/ScheduleManager.tsx` — new page.
- `src/pages/Settings/SettingsLayout.tsx` — add nav entry `/settings/schedule` (admin-only) using the existing `navItems` pattern.
- `src/App.tsx` — register the new route under settings.

UI:
- Top card: "Scheduler Status" — Active/Stopped/Misconfigured pill, Enable/Disable buttons, Frequency dropdown (1/2/5/10/15/30/60 min options mapped to cron), Connection Settings button (modal).
- Connection Settings modal: Supabase URL, Anon Key, Test Connection button.
- Table: every pulse in the active company with columns Name, Project, Active, Cron, Next Run, Last Run, Last Status, Actions (Enable/Disable schedule, Edit schedule, Run Now).

**Acceptance:** Admin can configure connection, enable scheduler, and toggle each pulse's schedule independently.

---

### Task 17 — Pulse Builder header: Run Now + Save state

Add a "Run Now" button to the builder header that calls `pulse-runner` with `triggerSource='manual'`. Show a toast/inline status while running and refresh the latest execution once complete. Reuse the same component on the Schedule Manager row actions.

**Acceptance:** Pressing Run Now executes the pulse and reflects status in the builder and Schedule Manager.

---

### Task 18 — Pulse Builder: list + delete + duplicate

In the sidebar, replace the placeholder "dashboards" listing under pulse folders with the actual `pulses` list. Add edit/delete via the existing folder dropdown pattern and a duplicate action that copies the pulse + all four config rows.

**Acceptance:** Pulses appear under their pulse folders with the same UX feel as dashboards.

---

### Task 19 — Storage bucket + cleanup

- Create `pulse-exports` storage bucket (private). Migration or Storage policy file.
- Policy: company members can read their pulse's exports; service role writes.
- Optional retention job: delete exports older than 30 days (extend `pulse-scheduler` or separate function).

**Acceptance:** Exports written to bucket; signed URL flow works for downloads.

---

### Task 20 — Polish + docs

- README/MD entry summarizing the Pulse feature and its data flow.
- Verify all RLS policies via test cases (member sees own, non-member sees nothing).
- Add empty-state UI everywhere (no pulses yet, no executions yet, no schedule yet).

**Acceptance:** Feature is production-ready and documented.

---

## Suggested Order

Foundation first, then top-down UI, then the scheduler:

1. Tasks 1, 2, 3, 5 — schema + types + hooks.
2. Tasks 6, 7 — sidebar + builder shell.
3. Tasks 8-12 — builder tabs.
4. Task 13 — runner (manual run works end-to-end).
5. Task 17 — Run Now wiring.
6. Task 4 — scheduler infrastructure (cron functions).
7. Tasks 14, 15 — scheduler + cron-manager edge functions.
8. Task 16 — Schedule Manager UI.
9. Tasks 18, 19, 20 — polish.

---

## Open Questions (please confirm before implementing)

1. **Email transport** — there's already an `useO365Settings` hook. Should `pulse-runner` send via the user's Office 365 mailbox, or should we add a generic SMTP/Resend/SendGrid path? (Default plan: Office 365 first, fall back to none if not configured.)
2. **Per-row run mode behavior** — should each row produce its own email/export, or one email with the row data inlined? (Default plan: per-row produces N emails/exports; per-group produces one per group; result_set produces one combined.)
3. **Admin gating** — Schedule Manager admin-only is consistent with existing settings; pulse create/edit follows dashboard rules (any company member). OK?
4. **Cron resolution** — the scheduler tick determines minimum frequency. OK to default the master cron to every 5 minutes?

Pick a task number to start when ready.
