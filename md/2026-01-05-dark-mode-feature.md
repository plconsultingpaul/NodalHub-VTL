# Dark Mode Feature

**Date:** 2026-01-05

## Summary

Added dark mode support throughout the application with user preference persistence.

## Changes Made

### Database
- Added `theme` column to `profiles` table (values: 'light' | 'dark', default: 'light')

### Configuration
- Updated `tailwind.config.js` with `darkMode: 'class'`

### Theme Context (`src/contexts/ThemeContext.tsx`)
- Added `isDark` state and `toggleTheme()` function
- Loads user preference from profile on authentication
- Saves preference to database when changed
- Applies/removes `dark` class on `<html>` element

### Sidebar (`src/components/layout/Sidebar.tsx`)
- Added Moon/Sun toggle button above collapse button
- Collapsed state shows icon only
- Expanded state shows icon and "Dark Mode" / "Light Mode" label

### UI Components Updated
- `Modal.tsx` - dark backgrounds, borders, and text colors
- `Button.tsx` - dark variants for primary, secondary, and ghost
- `Dropdown.tsx` - dark backgrounds, borders, and item hover states

### Pages Updated
- `MainLayout.tsx` - dark background for main content area
- `Home.tsx` - all cards, stats, and dashboard list
- `Dashboard.tsx` - header, empty states, and loading states
- `Login.tsx` - form, inputs, buttons, and links
- `Register.tsx` - form, inputs, buttons, and links
- `Settings/SettingsLayout.tsx` - header and navigation tabs
- `Settings/CompanySettings.tsx` - cards and form inputs
- `Settings/ProfileSettings.tsx` - cards and form inputs
- `Settings/ApiSettings.tsx` - tabs, cards, and form elements

## How It Works

1. User clicks the Moon/Sun icon in the sidebar
2. Theme toggles between light and dark mode instantly
3. Preference is saved to the user's profile in the database
4. On next login, the preference is restored automatically

## Dark Mode Color Scheme

- Background: `bg-gray-900` (main) / `bg-gray-800` (cards)
- Text: `text-white` (headings) / `text-gray-400` (secondary)
- Borders: `border-gray-700`
- Inputs: `bg-gray-700` with `border-gray-600`
- Primary buttons invert to white background with black text
