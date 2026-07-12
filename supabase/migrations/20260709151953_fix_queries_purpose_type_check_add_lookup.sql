/*
# Fix queries purpose_type CHECK constraint to include 'lookup'

## Problem
The `queries_purpose_type_check` constraint only allows 'query' and 'action', but 
the application UI and TypeScript types already support a 'lookup' purpose type.
Attempting to create a query with purpose_type = 'lookup' fails with:
"new row for relation "queries" violates check constraint "queries_purpose_type_check""

## Fix
Drop the existing constraint and recreate it with all three valid values:
'query', 'action', 'lookup'.

## Modified Tables
- `queries` — updated CHECK constraint on `purpose_type` column.
*/

ALTER TABLE queries DROP CONSTRAINT IF EXISTS queries_purpose_type_check;
ALTER TABLE queries ADD CONSTRAINT queries_purpose_type_check CHECK (purpose_type IN ('query', 'action', 'lookup'));