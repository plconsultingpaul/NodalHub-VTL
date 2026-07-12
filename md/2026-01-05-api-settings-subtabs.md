# API Settings Restructure with Sub-tabs

**Date:** 2026-01-05

## Summary

Restructured the API Settings section in the Settings page to use sub-tab navigation instead of displaying both sections on a single page.

## Changes Made

### 1. SettingsLayout.tsx
- Renamed the main navigation tab from "API Endpoints" to "API Settings"

### 2. ApiSettings.tsx
- Added sub-tab navigation at the top of the page with two tabs:
  - **API Endpoints** - Shows the API endpoint configuration section
  - **API Specs** - Shows the API specification upload and management section
- Content is now conditionally rendered based on the active sub-tab
- Default view is "API Endpoints"

## Navigation Structure

```
Settings
├── Company
├── Team Members
├── API Settings          <-- Renamed from "API Endpoints"
│   ├── API Endpoints     <-- Sub-tab (default)
│   └── API Specs         <-- Sub-tab
├── Office 365
├── Branding
└── My Profile
```

## Files Modified

- `src/pages/Settings/SettingsLayout.tsx`
- `src/pages/Settings/ApiSettings.tsx`
