# API Spec Viewer Scroll Fix

**Date:** 2026-01-05

## Issue

The endpoints list (left panel) and fields list (right panel) in the API Spec Viewer modal were not scrollable, preventing users from viewing all available content when lists exceeded the visible area.

## Root Cause

Flex containers with `overflow-y-auto` require their parent to have a constrained height. Without `min-h-0`, flex items default to `min-height: auto`, which prevents them from shrinking below their content size and breaks overflow scrolling. This needed to be applied at multiple levels of the flex hierarchy.

## Fix

Added `min-h-0` class to the content area and both panel container divs in `src/pages/Settings/ApiSettings.tsx`:

- Line 874: Content area wrapper
- Line 876: Left panel (Available Endpoints)
- Line 941: Right panel (Fields)

## Changes

**File:** `src/pages/Settings/ApiSettings.tsx`

Content area changed from:
```
<div className="flex-1 overflow-hidden p-6">
```

To:
```
<div className="flex-1 overflow-hidden p-6 min-h-0">
```

Both panel containers changed from:
```
<div className="flex flex-col overflow-hidden">
```

To:
```
<div className="flex flex-col overflow-hidden min-h-0">
```
