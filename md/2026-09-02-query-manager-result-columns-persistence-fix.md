# Query Manager — Result Columns persistence fix (NodalConnect Detect)

Date: 2026-09-02

## Symptom

In Query Manager, clicking **Detect** would populate the Result Columns chips. Clicking **Save Changes** appeared to succeed, but reopening the query showed an empty Result Columns list.

## Root cause

The NodalConnect Detect endpoint (`PUT .../executables/manage/{name}/detect-result-columns`) returns `resultColumns` as a **JSON-encoded string** — e.g.:

```
'[{"name":"BILL_NUMBER","type":"STRING"},{"name":"SHIPPER","type":"STRING"},...]'
```

`NodalConnectQueryForm.tsx` had two parsing sites (the Detect handler and the post-save re-detect helper) that both did:

```ts
typeof resp.resultColumns === 'string'
  ? resp.resultColumns.split(',').map(s => s.trim())
  : ...
```

That naive comma-split shredded the JSON into ~36 broken fragments like `'[{"name":"BILL_NUMBER"'`, `'"type":"STRING"}'`, `'{"name":"SHIPPER"'`, etc. Those fragments were then:

1. Written to `queries.last_known_columns` on save (the DB write itself succeeded — the data was already garbage before it arrived).
2. Written a second time by the fire-and-forget post-save re-detect (same corruption).
3. Dropped in their entirety on reopen, because the initial-state hydration filter rejected every string starting with `[`, `{`, or `"`. Result: empty chips.

The React "duplicate key" warnings for `"type":"STRING"}` / `"type":"DECIMAL"}` were the same fragments being rendered as chips.

## Fix

Introduced a single `normalizeToColumnNames(raw)` helper in `NodalConnectQueryForm.tsx` that handles every shape the endpoint or DB may return:

- JSON-string of an array of objects → parse and extract `name`.
- JSON-string of an array of strings → parse and trim.
- Array of objects with `.name` → map to names.
- Array of plain strings → pass through trimmed.
- Array whose first entry is a JSON fragment starting with `[` (**legacy corrupted rows written before this fix**) → re-join with `,` and JSON-parse the reconstituted string, then recurse.
- Bare CSV string → split on comma.

Three call sites now go through the helper:

1. `useState<string[]>(...)` initializer for `resultColumns` — heals legacy corrupted rows on next open. No filter needed.
2. `handleDetectParams` result-column branch (inline detect).
3. `detectResultColumns` post-save helper (writes cleaned names to `queries.last_known_columns` via Supabase).

## Persistence

Unchanged: `queries.last_known_columns` (jsonb) on Supabase. Both writes now store a clean `string[]` of column names.

## Also removed

All `[DIAG …]` and stale `[detect-result-columns] …`/`[QueryManager.handleSave] …` diagnostic `console.log` statements added during triage, from `NodalConnectQueryForm.tsx`, `useQueries.ts`, and `QueryManager/index.tsx`. The `updateQuery` return shape (`{ data, error: null }`) is preserved.

## Verification

- `npm run build` clean.
- Detect → chips populated with clean column names.
- Save → Supabase row now contains `["BILL_NUMBER", "SHIPPER", ...]` instead of JSON fragments.
- Reopen → chips render from the clean row.
- Existing rows with the fragmented data render correctly on next open thanks to the legacy re-join branch in the helper; the next save rewrites them cleanly.
