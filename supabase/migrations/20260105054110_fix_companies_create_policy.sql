/*
  # Fix Companies Insert Policy
  
  1. Changes
    - Drop and recreate the INSERT policy for companies table
    - Allow authenticated users to create new companies
  
  2. Security
    - Authenticated users can create companies
    - The policy uses a simple TRUE check to allow any authenticated user to insert
*/

DROP POLICY IF EXISTS "Authenticated users can create companies" ON companies;

CREATE POLICY "Authenticated users can create companies"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);