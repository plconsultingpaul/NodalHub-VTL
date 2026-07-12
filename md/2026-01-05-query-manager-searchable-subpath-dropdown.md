# Query Manager - Searchable API Sub-path Dropdown

**Date:** 2026-01-05

## Summary

Added a search/filter capability to the API Sub-path dropdown in the Query Manager "New Query" form. This allows users to quickly find endpoints by typing to filter the list.

## Changes Made

### File: `src/pages/QueryManager/ApiEndpointQueryForm.tsx`

- Replaced the native `<select>` element for API Sub-path with a custom searchable dropdown component
- Added state variables for search term (`subPathSearch`) and dropdown visibility (`subPathDropdownOpen`)
- Added click-outside detection to close the dropdown when clicking elsewhere
- Implemented search filtering that matches against both the endpoint path and summary/description

## Features

- Search input appears at the top of the dropdown when opened
- Search input auto-focuses when dropdown opens
- Filters endpoints in real-time as user types
- Matches against both path and summary text (case-insensitive)
- Shows "No matching endpoints" message when search yields no results
- Currently selected endpoint is highlighted
- Dropdown closes automatically on selection or click-outside
- Search term clears when dropdown opens or after selection
