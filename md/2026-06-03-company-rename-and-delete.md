# Company Settings: Rename and Delete

Date: 2026-06-03

## Summary

Adds inline rename and delete actions for each company in the
**Settings → Company** page. Users must always have at least one
company, so delete is disabled when only one company remains.

## Database

Migration: `add_company_delete_policy`

- Adds a DELETE policy on `public.companies` that allows authenticated
  users to delete a company **only if** they have an `Admin` membership
  for that company.
- All foreign keys pointing to `companies` already use
  `ON DELETE CASCADE`, so deletion automatically cleans up:
  memberships, dashboards, projects, queries, API endpoints, API specs,
  fixed values, and Office 365 settings.

## Frontend (`src/pages/Settings/CompanySettings.tsx`)

- Each company row in "Your Companies" now shows two icon buttons:
  - **Rename** (pencil): opens a modal pre-filled with the current
    name. Save is disabled when the name is unchanged or empty.
  - **Delete** (trash): opens a confirmation modal that requires the
    user to type the company's exact name to confirm.
- Both buttons are only visible when the user is `Admin` of that
  specific company.
- Delete is disabled (greyed out, with tooltip) when the user only
  belongs to one company.
- After deleting the currently active company, the active company
  switches to another remaining company automatically.
- Reuses the existing top-level "Save Changes" rename for the active
  company; the new per-row controls cover renaming **any** company the
  user administers, including non-active ones.

## Notes

- No new components were created. The existing `Modal` and `Button`
  primitives (with the existing `danger` variant) are reused.
- Cascade deletes are relied on for cleanup; no manual ordering of
  deletes is needed in app code.
