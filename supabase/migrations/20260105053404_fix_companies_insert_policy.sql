/*
  # Fix Companies Insert Policy

  The INSERT policy for the companies table was not included in the previous
  security optimization migration. This adds the missing policy to allow
  authenticated users to create new companies.

  ## Changes
  - Add INSERT policy for companies table allowing authenticated users to create companies
*/

DROP POLICY IF EXISTS "Authenticated users can create companies" ON companies;

CREATE POLICY "Authenticated users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);
