# Branding Company Switch Sync

**Date:** 2026-01-05

## Summary

Fixed the Branding settings page to update when switching between companies in the sidebar.

## Problem

Previously, the Branding page initialized its state (primary color, secondary color, and logo) once when the component mounted. When users switched to a different company via the sidebar, the branding form continued showing the previous company's values instead of loading the new company's branding settings.

## Solution

Added a `useEffect` hook that watches the `activeCompany` and updates the local form state whenever the active company changes.

## File Changed

- `src/pages/Settings/Branding.tsx`

## Change Details

Added import for `useEffect` and a hook that syncs form state with the active company:

```tsx
useEffect(() => {
  setPrimaryColor(activeCompany?.primary_color || '#000000');
  setSecondaryColor(activeCompany?.secondary_color || '#6B7280');
  setLogoUrl(activeCompany?.logo_url || '');
}, [activeCompany]);
```

## Result

Switching companies in the sidebar now immediately updates the Branding page to show the selected company's logo, primary color, and secondary color.
