# Dashboard Parameter Persistence When Switching Between Dashboards

**Date:** 2026-01-10

## Problem

When users had multiple dashboards open and switched between tabs, they were repeatedly prompted to enter parameters even though they had already submitted them. This created a poor user experience when working with multiple dashboards that require parameters.

## Root Cause

The `DashboardViewer` component had a RESET EFFECT that cleared all parameter state (including `initialParamsSetRef`) whenever `activeDashboardId` changed. This caused the PARAM EFFECT to re-run and show the parameter modal for dashboards that had already been configured.

## Solution

Added a persistent ref (`submittedDashboardParamsRef`) that stores submitted parameter values per-dashboard ID. When switching to a dashboard:

1. The PARAM EFFECT checks if that dashboard ID has previously submitted parameters
2. If yes, restores those values and sets `parametersReady=true` without showing the modal
3. If no, shows the parameter modal as before

## Changes Made

### `/src/pages/DashboardViewer/index.tsx`

1. Added new ref to track submitted parameters per-dashboard:
   ```typescript
   const submittedDashboardParamsRef = useRef<Record<string, Record<string, string>>>({});
   ```

2. Modified PARAM EFFECT to check for previously submitted params before showing modal:
   ```typescript
   const previouslySubmittedParams = activeDashboardId
     ? submittedDashboardParamsRef.current[activeDashboardId]
     : null;

   if (previouslySubmittedParams && allParams.length > 0) {
     // Restore previously submitted params
     setParameterValues(previouslySubmittedParams);
     setPendingGlobalParamValues(previouslySubmittedParams);
     setParametersReady(true);
   } else if (allParams.length > 0) {
     // Show modal for new dashboards
     setShowParamModal(true);
     setParametersReady(false);
   }
   ```

3. Updated `handleParamSubmit` to save submitted params to the ref:
   ```typescript
   if (activeDashboardId) {
     submittedDashboardParamsRef.current[activeDashboardId] = { ...pendingGlobalParamValues };
   }
   ```

4. Fixed typo in Cancel button: `setPendingParamValues` -> `setPendingGlobalParamValues`

## Behavior

- First time opening a dashboard with parameters: Shows the parameter modal
- Switching away and back to the same dashboard: Restores saved parameters without modal
- Canceling the parameter modal: Closes the dashboard (no parameters saved)
- Parameters persist for the session duration (until page refresh)
