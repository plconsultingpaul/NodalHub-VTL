/*
# Fix fixed_values value_type CHECK constraint

1. Modified Tables
   - `fixed_values`
     - Drops and recreates the `fixed_values_value_type_check` CHECK constraint
     - Now allows: 'date', 'datetime', 'integer', 'double', 'text', 'lookup'
     - Previously missing 'double' and 'lookup' types

2. Notes
   - The 'double' type was added in an earlier migration but the CHECK was never updated
   - The 'lookup' type was added for dynamic lookup fixed values but the CHECK was never updated
   - This was causing "new row violates check constraint" errors when creating lookup or double fixed values
*/

ALTER TABLE fixed_values DROP CONSTRAINT IF EXISTS fixed_values_value_type_check;
ALTER TABLE fixed_values ADD CONSTRAINT fixed_values_value_type_check
  CHECK (value_type = ANY (ARRAY['date', 'datetime', 'integer', 'double', 'text', 'lookup']));
