# Query Manager API Sub-path Dropdown Fix

**Date:** 2026-01-05

## Issue

In the Query Manager "New Query" modal, after selecting an API Endpoint and HTTP Method, the API Sub-path dropdown showed "0 endpoints available from API specification" even when the selected endpoint had a linked API Spec with endpoints.

## Root Cause

The `getSpecEndpointsForEndpoint` and `getFieldsForSpecEndpoint` functions in `useQueries.ts` were not wrapped in `useCallback`. This caused them to be recreated on every render, making them unstable references when used as dependencies in the form component's `useEffect`.

## Fix

Wrapped both functions in `useCallback` with empty dependency arrays since they only use the `supabase` client which is stable.

## File Changed

- `src/hooks/useQueries.ts`
  - Wrapped `getSpecEndpointsForEndpoint` in `useCallback`
  - Wrapped `getFieldsForSpecEndpoint` in `useCallback`
