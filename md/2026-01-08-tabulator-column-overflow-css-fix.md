# Tabulator Column Overflow CSS Fix

**Date:** 2026-01-08

## Issue

When resizing dashboard grid columns to be narrower, the Filter Icon, Calculation Icon, and Filter Input would overflow into adjacent columns instead of staying within their own column boundaries.

## Root Cause

In `src/index.css`, the Tabulator column header had `overflow: visible` explicitly set, which allowed content to extend beyond the column boundaries.

## Changes Made

**File:** `src/index.css`

1. Changed `.tabulator .tabulator-header .tabulator-col` from `overflow: visible` to `overflow: hidden`

2. Added to `.tabulator .tabulator-header .tabulator-col .tabulator-col-content`:
   - `overflow: hidden`
   - `min-width: 0`

3. Added to `.tabulator .tabulator-header .tabulator-col .tabulator-col-content .tabulator-col-title-holder`:
   - `overflow: hidden`
   - `min-width: 0`

## Result

Column header content (icons, filter inputs) now stays contained within its column boundaries when columns are resized smaller.
