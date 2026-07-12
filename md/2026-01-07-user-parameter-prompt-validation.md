# User Parameter Prompt Text Validation

**Date:** 2026-01-07

## Problem

When adding a User Parameter in the Query Manager, if the user fills in the Parameter Name but leaves the Prompt Text empty, the parameter would be silently filtered out on save without any feedback to the user.

## Solution

Added validation to require prompt text for user parameters:

1. **Visual Feedback**: The Prompt Text input now shows a red border and light red background when a parameter has a name but no prompt text

2. **Warning Message**: A red warning message appears below the User Parameters section when there are incomplete parameters

3. **Save Prevention**: The "Save Step" button is disabled when user parameters are missing prompt text, with a tooltip explaining why

## Changes Made

Modified `src/pages/QueryManager/ApiEndpointQueryForm.tsx`:

1. Added `hasIncompleteUserParams` computed variable to detect parameters with names but missing prompts

2. Applied conditional styling to the prompt text input field - red border/background when invalid

3. Added validation error message below the User Parameters section

4. Disabled the Save button when `hasIncompleteUserParams` is true, with explanatory tooltip

## Result

Users now receive clear visual feedback when they need to fill in prompt text, and cannot save until all user parameters have both a name and prompt text defined.
