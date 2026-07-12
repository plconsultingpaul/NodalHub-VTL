# Dashboard Cell Actions Feature - Implementation Plan

## Overview

Add the ability to configure "Action" type queries on Dashboard Cells that can be triggered via right-click context menu or header buttons. Actions execute queries (typically POST/PUT/DELETE) against API endpoints, passing row data as parameters.

---

## Task 1: Database Schema - Cell Actions Table

**Create `dashboard_cell_actions` table:**

```sql
CREATE TABLE dashboard_cell_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id UUID NOT NULL REFERENCES dashboard_cells(id) ON DELETE CASCADE,
  query_id UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  display_mode TEXT NOT NULL DEFAULT 'context_menu' CHECK (display_mode IN ('context_menu', 'button')),
  parameter_mappings JSONB DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**`parameter_mappings` JSONB structure:**
```json
[
  {
    "parameterName": "@vendorId",
    "target": "column",
    "columnName": "VendorID"
  }
]
```

- `parameterName`: The user_parameter name from the Action query
- `target`: Currently "column" (maps to a column in the parent query results)
- `columnName`: The column field name from the parent query results to pull the value from

**RLS Policies:** Restrict to authenticated users who are members of the company that owns the dashboard.

---

## Task 2: Action Configuration UI (Dashboard Builder)

**Location:** New button in `CellConfigPanel.tsx` (or the DashboardCell header area in DashboardViewer)

**UI Flow:**
1. Add a new "Actions" button next to existing formatting/drilldown buttons in the cell config
2. Clicking opens an **Actions Configuration Modal** with:
   - List of currently configured actions (sortable)
   - "Add Action" button
3. Each action row shows:
   - **Display Name** (text input)
   - **Action Query** (dropdown - filtered to queries where `purpose_type = 'action'`)
   - **Display Mode** (dropdown: "Context Menu" or "Button")
   - **Parameter Mappings** section:
     - For each `user_parameter` on the selected action query, show:
       - Parameter name (read-only label)
       - Target dropdown: "Column" (future: could add "Fixed Value", "Prompt User")
       - Column picker: dropdown of columns from the parent cell's query results
   - Delete button per action
4. Save persists to `dashboard_cell_actions` table

**Key considerations:**
- Need to fetch available columns from the parent cell's query (similar to how drilldown parameter mappings work today)
- Query dropdown should only show action-type queries for the current company
- Multiple actions can be configured per cell

---

## Task 3: Right-Click Context Menu Integration (DashboardCell.tsx)

**Current state:** `cellContextMenu` already exists with Copy Cell/Row/Column options.

**Changes:**
1. After loading cell data, also fetch `dashboard_cell_actions` for the cell (where `display_mode = 'context_menu'`)
2. If actions exist, add a separator + "Actions" menu item to `cellContextMenu`
3. If only one action: clicking "Actions" directly executes it
4. If multiple actions: "Actions" shows a submenu with each action name (Tabulator supports nested menus via `menu` property on menu items)
5. On action selection:
   - Get the clicked row's data
   - Map parameter values from row columns using `parameter_mappings`
   - If row selection is enabled AND multiple rows are selected:
     - Execute the action query for each selected row (sequential or parallel with concurrency limit)
     - Show progress/results feedback
   - If single row: execute once with that row's mapped values
6. After execution, show success/error toast notification

**Tabulator submenu structure:**
```typescript
{
  label: "Actions",
  menu: [
    { label: "Approve Vendor", action: (e, cell) => executeAction(actionId, cell) },
    { label: "Delete Record", action: (e, cell) => executeAction(actionId, cell) }
  ]
}
```

---

## Task 4: Header Button Display Mode (DashboardCell.tsx)

**For actions with `display_mode = 'button'`:**

1. Render action buttons in the cell header bar (near existing buttons like filter/format)
2. Button shows the `display_name` text
3. On click:
   - If row selection is enabled AND rows are selected: execute action for all selected rows
   - If row selection is NOT enabled or no rows selected: show a message prompting row selection (or execute with no parameters if the action has none)
4. Same parameter mapping logic as context menu actions
5. Visual feedback during execution (loading spinner on button, disable button)

---

## Task 5: Action Execution Logic

**Shared execution function** used by both context menu and button triggers:

```typescript
async function executeAction(
  action: DashboardCellAction,
  rows: RowData[]  // single row or multiple selected rows
): Promise<void>
```

**Steps per row:**
1. Build parameter values by mapping `action.parameter_mappings` against row data
2. Call the action query's API endpoint via the existing `apiProxy` system:
   - Substitute path parameters (`{@paramName}` in URL)
   - Substitute query string parameters
   - Substitute request body field mappings
3. Collect results (success/failure per row)
4. Display summary (e.g., "3 of 5 actions completed successfully")

**Multi-row execution:**
- Execute sequentially with a small delay (avoid overwhelming the API)
- Show progress indicator
- Continue on individual failures, report at end

---

## Task 6: Query Manager - Action Parameter UX

**Location:** `ApiEndpointQueryForm.tsx`

**Changes:**
- When `purpose_type === 'action'` and the query has `user_parameters`:
  - Show parameters in a read-only info panel
  - Display an info banner/note: "Action parameters are configured in the Dashboard Cell where this action is used. Parameters will be mapped to grid column values at execution time."
  - Remove the "Test" button's parameter prompt for action queries (or keep it with manual input for testing purposes)
- The parameter definition UI (name, dataType) should still be editable so the user can define what parameters the action expects

---

## Task 7: Hook for Data Refresh After Action

**After an action executes:**
- Optionally refresh the parent cell's data (re-run the main query)
- Could be a toggle in the action config: "Refresh cell after execution" (default: true)
- This ensures the grid reflects any changes made by the action (e.g., deleted row disappears)

---

## Implementation Order

| Step | Task | Dependencies |
|------|------|--------------|
| 1 | Task 1 - Database migration | None |
| 2 | Task 6 - Query Manager action parameter UX | None (can be parallel with Task 1) |
| 3 | Task 2 - Action Configuration UI | Task 1 |
| 4 | Task 5 - Action Execution Logic | Task 1 |
| 5 | Task 3 - Right-click context menu | Tasks 2, 4, 5 |
| 6 | Task 4 - Header button mode | Tasks 2, 4, 5 |
| 7 | Task 7 - Post-action refresh | Tasks 5, 6 |

---

## Files to Create/Modify

**New files:**
- `src/hooks/useCellActions.ts` - Hook to fetch/save cell actions
- `src/pages/DashboardViewer/ActionsConfigModal.tsx` - Action configuration modal
- `src/pages/DashboardViewer/actionExecutor.ts` - Shared action execution logic

**Modified files:**
- `src/pages/DashboardViewer/DashboardCell.tsx` - Context menu integration, button rendering, action fetching
- `src/pages/DashboardBuilder/CellConfigPanel.tsx` - Actions button to open config modal
- `src/pages/QueryManager/ApiEndpointQueryForm.tsx` - Action parameter info banner
- `src/types/database.ts` - New type definitions for cell actions
- Migration file for `dashboard_cell_actions` table

---

## Type Definitions

```typescript
export interface DashboardCellAction {
  id: string;
  cell_id: string;
  query_id: string;
  display_name: string;
  display_mode: 'context_menu' | 'button';
  parameter_mappings: ActionParameterMapping[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ActionParameterMapping {
  parameterName: string;  // matches user_parameter.name on the action query
  target: 'column';       // extensible: could add 'fixed_value', 'prompt' later
  columnName: string;     // column field from parent query results
}

export type DashboardCellActionWithQuery = DashboardCellAction & {
  queries?: Query | null;
};
```
