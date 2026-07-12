# Query Manager - Method Badge Colors

**Date:** 2026-01-05

## Summary

Updated the Query Manager method badges to use color-coded styling that matches the API Specs viewer.

## Changes Made

### Method Badge Color Scheme

Applied consistent HTTP method colors across the application:
- **GET** - Blue (bg-blue-100 text-blue-700)
- **POST** - Green (bg-green-100 text-green-700)
- **PUT** - Yellow (bg-yellow-100 text-yellow-700)
- **PATCH** - Orange (bg-orange-100 text-orange-700)
- **DELETE** - Red (bg-red-100 text-red-700)

## Files Modified

- `src/pages/QueryManager/index.tsx`
  - Added `getMethodBadgeClasses` helper function
  - Updated method badge span to use dynamic color classes based on HTTP method
