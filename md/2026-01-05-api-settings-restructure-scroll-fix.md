# API Settings Restructure and Spec Viewer Scroll Fix

**Date:** 2026-01-05

## Summary

Restructured the API Settings page by splitting it into separate, focused components and fixed the scrolling issue in the API Spec Viewer modal.

## Problem

1. The `ApiSettings.tsx` file was over 1000 lines containing all API Endpoints logic, API Specs logic, and the Spec Viewer modal
2. The API Spec Viewer modal did not allow scrolling in either the endpoints list (left panel) or the fields list (right panel), even with 815+ fields
3. Previous attempts to fix scrolling with `min-h-0` on flex containers failed because CSS Grid with `h-full` doesn't properly inherit height constraints from flex parents

## Solution

### File Structure Changes

**Before:**
```
src/pages/Settings/
  ApiSettings.tsx (1080 lines - everything in one file)
```

**After:**
```
src/pages/Settings/
  ApiSettings.tsx (41 lines - simple wrapper with subtabs)
  ApiEndpoints.tsx (new - API endpoint management)
  ApiSpecs.tsx (new - API spec management)

src/components/
  ApiSpecViewerModal.tsx (new - standalone modal component)
```

### Scroll Fix Details

The root cause was using CSS Grid with `h-full` inside a flex container. The grid doesn't properly receive height constraints from the flex parent.

**Fix applied in ApiSpecViewerModal.tsx:**
1. Changed modal to use explicit height: `h-[85vh]` instead of `max-h-[90vh]`
2. Used `flex-1 grid grid-cols-2` directly on content area with `min-h-0`
3. Each panel column uses `flex flex-col min-h-0`
4. Header sections use `flex-shrink-0` to prevent compression
5. Scrollable areas use `flex-1 overflow-y-auto`

This ensures:
- Modal has a fixed viewport-relative height
- Grid receives a concrete height value to work with
- Panels can flex and scroll independently
- Both endpoints list and fields list are now scrollable

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/pages/Settings/ApiSettings.tsx` | Modified | Reduced to 41 lines, now just renders subtabs and child components |
| `src/pages/Settings/ApiEndpoints.tsx` | Created | Contains all API endpoint CRUD logic (~350 lines) |
| `src/pages/Settings/ApiSpecs.tsx` | Created | Contains API spec upload/view/delete logic (~280 lines) |
| `src/components/ApiSpecViewerModal.tsx` | Created | Standalone modal with fixed scrolling (~290 lines) |

## Benefits

1. **Single Responsibility** - Each file handles one concern
2. **Maintainability** - Smaller files are easier to understand and modify
3. **Testability** - Components can be tested in isolation
4. **Scroll Fix** - Both panels in the spec viewer now scroll correctly
