# Query Manager Test Button

**Date:** 2026-01-05

## Summary

Added a test button to each query row in the Query Manager, allowing users to quickly test queries without opening the edit modal.

## Changes Made

### File Modified: `src/pages/QueryManager/index.tsx`

1. **Added new icon imports:** `Play`, `Loader2`, `CheckCircle`, `XCircle` from lucide-react

2. **Added new state variables:**
   - `testingQuery` - tracks which query is being tested
   - `testResult` - stores the API response (status, data, error)
   - `testLoading` - loading state during test execution

3. **Added test handler function (`handleTest`):**
   - Builds the full URL from endpoint base URL + subpath + query string
   - Configures authentication headers based on endpoint auth type (bearer, api_key, basic)
   - Executes the HTTP request with the query's method
   - Handles JSON body for POST/PUT/PATCH requests
   - Parses response based on content type
   - Captures errors gracefully

4. **Added test button to Actions column:**
   - Green Play icon button positioned before Edit button
   - Hover state with green highlight

5. **Added Test Results Modal:**
   - Displays query name, method badge, and subpath
   - Shows loading spinner during request
   - Displays success/error status with colored icons
   - Shows formatted JSON response in a dark code block
   - Includes "Run Again" button for quick re-testing

## UI Behavior

- Click the Play button on any query row to test it
- Modal opens showing loading state while request executes
- Results display with status code and formatted response data
- Green checkmark for 2xx responses, red X for errors
- "Run Again" button allows re-testing without closing the modal
