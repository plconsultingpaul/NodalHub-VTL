# Sidebar Text Color Setting

**Date:** 2026-01-05

## Overview

Added a new "Sidebar Text Color" option to the Branding settings, allowing users to customize the color of text and icons displayed in the sidebar.

## Changes Made

### Database

- Added `sidebar_text_color` column to the `companies` table (default: `#FFFFFF`)

### Branding Settings (`src/pages/Settings/Branding.tsx`)

- Added state management for sidebar text color
- Added a new color picker section "Sidebar Text Color" with preset colors ranging from white to black
- Updated the preview section to reflect the sidebar text color
- Updated save function to persist the sidebar text color

### Sidebar Component (`src/components/layout/Sidebar.tsx`)

- Company name uses the sidebar text color
- Navigation items (Home, Dashboards, Pulse, Settings, Help) use the sidebar text color with opacity variations for active/inactive states
- Project folders and dashboard items use the sidebar text color
- Border colors are derived from the text color with transparency
- Toggle button uses the sidebar text color

### Company Switcher (`src/components/layout/CompanySwitcher.tsx`)

- User avatar background uses the text color with transparency
- User name and email use the sidebar text color

### Type Definitions (`src/types/database.ts`)

- Added `sidebar_text_color` field to the Company type definitions

## Usage

1. Navigate to Settings > Branding
2. Scroll to the "Sidebar Text Color" section
3. Choose a color using the color picker or select from presets
4. Preview the changes in the Preview section
5. Click "Save Branding" to apply

## Files Changed

- `src/pages/Settings/Branding.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/CompanySwitcher.tsx`
- `src/types/database.ts`
- `supabase/migrations/[timestamp]_add_sidebar_text_color_to_companies.sql`
