# Global CustomDropdown Migration

**Date:** 2026-06-10

## Summary

Migrated all remaining native `<select>` elements across the entire codebase to use the `CustomDropdown` component. After this change, zero native selects remain in `src/`.

## Files Changed (13 files, 28 selects replaced)

### QueryManager
| File | Selects Replaced | Context |
|------|-----------------|---------|
| `src/pages/QueryManager/index.tsx` | 1 | Test parameter values (fixed value list) |
| `src/pages/QueryManager/FixedValueEditor.tsx` | 5 | Base Date (x2), String Format (x2), Default Value |
| `src/pages/QueryManager/FixedValuesModal.tsx` | 1 | Filter by type |

### Settings
| File | Selects Replaced | Context |
|------|-----------------|---------|
| `src/pages/Settings/ApiSpecs.tsx` | 2 | Filter endpoint, Upload endpoint selector |
| `src/pages/Settings/TeamMembers.tsx` | 2 | Invite company, Invite role |
| `src/pages/Settings/ApiEndpoints.tsx` | 1 | Authentication type |
| `src/pages/Settings/ScheduleManager.tsx` | 1 | Schedule frequency |

### Dashboard Viewer
| File | Selects Replaced | Context |
|------|-----------------|---------|
| `src/pages/DashboardViewer/DashboardCell.tsx` | 1 | Boolean parameter prompt |
| `src/pages/DashboardViewer/GridFormattingModal.tsx` | 2 | Font Family, Font Size |
| `src/pages/DashboardViewer/ConditionalFormattingTab.tsx` | 7 | Condition Type, Column, Data Type, Comparison, Fixed Value, Font Family, Blinking Speed |

### Dashboard Builder
| File | Selects Replaced | Context |
|------|-----------------|---------|
| `src/pages/DashboardBuilder/CellConfigPanel.tsx` | 2 | Main Query, Drilldown Query |

### Layout / Components
| File | Selects Replaced | Context |
|------|-----------------|---------|
| `src/components/layout/Sidebar.tsx` | 1 | Project selector in new dashboard modal |
| `src/components/dashboard/AddWidgetModal.tsx` | 2 | API Endpoint, Rows per page |

## Additional Cleanup
- Removed unused `ChevronDown` import from `ApiSpecs.tsx` (was used for manual dropdown arrow)

## Notes
- All dropdowns now use portal-based rendering (via `CustomDropdown`) which prevents clipping inside overflow containers
- Consistent styling and interaction patterns across the entire application
- No database changes required
