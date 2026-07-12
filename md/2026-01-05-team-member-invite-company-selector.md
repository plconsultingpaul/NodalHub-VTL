# Team Member Invite Company Selector

**Date:** 2026-01-05

## Summary

Added the ability to select which company a user is invited to when using the Invite Member feature in Team Members settings.

## Problem

Previously, when inviting a team member, the invitation was automatically tied to the currently active company. There was no way to explicitly choose which company the invited user would have access to.

## Changes Made

### File: `src/pages/Settings/TeamMembers.tsx`

1. Added `inviteCompanyId` state to track the selected company for invitation
2. Added `adminCompanies` filter to show only companies where the current user is an Admin
3. Added a Company dropdown selector in the invite modal
4. Updated the invite logic to use the selected company ID instead of automatically using the active company
5. Added helper text clarifying that "The user will only have access to this company"

## Behavior

- When opening the invite modal, the company selector defaults to the currently active company
- The dropdown only shows companies where the current user has Admin role (since only admins can invite users)
- The Send Invite button is disabled until both email and company are selected
- Each user-company relationship is explicit - users must be invited to each company separately

## Existing Security

The existing implementation in `CompanySettings.tsx` already ensures that when creating a new company, only the creator receives membership. Existing users do not automatically gain access to newly created companies.
