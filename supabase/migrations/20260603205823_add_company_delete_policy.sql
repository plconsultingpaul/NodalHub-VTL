/*
  # Allow company admins to delete their companies

  1. Changes
    - Adds a DELETE policy on `public.companies` for authenticated users
      who are members of that company with the `Admin` role.

  2. Security
    - Only admins of a given company can delete it.
    - All FK relationships from dependent tables already use ON DELETE
      CASCADE, so deletion cleans up memberships, dashboards, projects,
      etc. automatically.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companies'
      AND policyname = 'Admins can delete their companies'
  ) THEN
    CREATE POLICY "Admins can delete their companies"
      ON public.companies FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.company_memberships
          WHERE company_memberships.company_id = companies.id
            AND company_memberships.user_id = (SELECT auth.uid())
            AND company_memberships.role = 'Admin'
        )
      );
  END IF;
END $$;
