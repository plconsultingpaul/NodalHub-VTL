# Parameter Modal Deferred Apply Fix

**Date:** 2026-01-07

## Issue

When opening the Parameters modal from the main Parameters button in the Dashboard Viewer, changing a parameter value would immediately update the grid before clicking the "Continue" button. Users expected changes to only apply when explicitly submitting.

## Solution

Added a pending state pattern for the global parameter modal, mirroring the existing implementation for individual cell parameter editing.

## Changes Made

**File:** `src/pages/DashboardViewer/index.tsx`

1. Added new state `pendingGlobalParamValues` to hold parameter values while the modal is open
2. Updated `handleEditAllParameters` to copy current `parameterValues` into `pendingGlobalParamValues` when opening the modal
3. Updated `handleParamChange` to write to `pendingGlobalParamValues` instead of `parameterValues`
4. Updated `handleParamSubmit` to commit `pendingGlobalParamValues` to `parameterValues` when "Continue" is clicked
5. Updated `renderParamInput` to read from `pendingGlobalParamValues` instead of `parameterValues`
6. Updated `allParamsValid` validation to check against `pendingGlobalParamValues`
7. Updated initial setup useEffect to also initialize `pendingGlobalParamValues`

## Behavior

- Parameter changes in the modal are now staged in a pending state
- The grid only updates when the user clicks "Continue"
- Closing the modal without submitting discards pending changes
