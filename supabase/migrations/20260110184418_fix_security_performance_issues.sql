/*
  # Security and Performance Fixes

  This migration addresses multiple security and performance issues flagged by Supabase.

  ## 1. Missing Foreign Key Indexes
  Adding indexes on foreign key columns that were missing indexes:
  - `fixed_values.created_by`
  - `queries.api_spec_endpoint_id`
  - `queries.created_by`

  ## 2. RLS Policy Performance Optimization
  Updating all RLS policies to use `(select auth.uid())` instead of `auth.uid()` directly.
  This prevents re-evaluation of the auth function for each row, significantly improving
  query performance at scale.

  Tables affected:
  - company_memberships (5 policies)
  - api_specs (4 policies)
  - api_spec_endpoints (3 policies)
  - api_endpoint_fields (3 policies)
  - companies (1 policy)
  - queries (4 policies)
  - fixed_values (4 policies)
  - dashboard_cells (4 policies)
  - dashboard_cell_drilldowns (4 policies)
  - grid_templates (4 policies)

  ## 3. Function Search Path Fix
  Setting immutable search_path for `ensure_single_default_template` function.

  ## Notes
  - Unused indexes are NOT removed as they may be needed for future queries
  - Auth connection strategy requires manual configuration in Supabase dashboard
  - Leaked password protection requires enabling in Supabase Auth settings
*/

-- =====================================================
-- PART 1: Add Missing Foreign Key Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_fixed_values_created_by ON public.fixed_values(created_by);
CREATE INDEX IF NOT EXISTS idx_queries_api_spec_endpoint_id ON public.queries(api_spec_endpoint_id);
CREATE INDEX IF NOT EXISTS idx_queries_created_by ON public.queries(created_by);

-- =====================================================
-- PART 2: Fix RLS Policies - company_memberships
-- =====================================================

DROP POLICY IF EXISTS "Users can read own memberships" ON public.company_memberships;
CREATE POLICY "Users can read own memberships"
  ON public.company_memberships
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can read company memberships" ON public.company_memberships;
CREATE POLICY "Admins can read company memberships"
  ON public.company_memberships
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = (select auth.uid())
      AND cm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update memberships" ON public.company_memberships;
CREATE POLICY "Admins can update memberships"
  ON public.company_memberships
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = (select auth.uid())
      AND cm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = (select auth.uid())
      AND cm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete memberships" ON public.company_memberships;
CREATE POLICY "Admins can delete memberships"
  ON public.company_memberships
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = (select auth.uid())
      AND cm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can insert memberships" ON public.company_memberships;
CREATE POLICY "Users can insert memberships"
  ON public.company_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- =====================================================
-- PART 3: Fix RLS Policies - api_specs
-- =====================================================

DROP POLICY IF EXISTS "Users can view api_specs for their companies" ON public.api_specs;
CREATE POLICY "Users can view api_specs for their companies"
  ON public.api_specs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = api_specs.company_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can insert api_specs" ON public.api_specs;
CREATE POLICY "Admins and Editors can insert api_specs"
  ON public.api_specs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = api_specs.company_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role IN ('admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can update api_specs" ON public.api_specs;
CREATE POLICY "Admins and Editors can update api_specs"
  ON public.api_specs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = api_specs.company_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role IN ('admin', 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = api_specs.company_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role IN ('admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can delete api_specs" ON public.api_specs;
CREATE POLICY "Admins and Editors can delete api_specs"
  ON public.api_specs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = api_specs.company_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role IN ('admin', 'editor')
    )
  );

-- =====================================================
-- PART 4: Fix RLS Policies - api_spec_endpoints
-- =====================================================

DROP POLICY IF EXISTS "Users can view api_spec_endpoints" ON public.api_spec_endpoints;
CREATE POLICY "Users can view api_spec_endpoints"
  ON public.api_spec_endpoints
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.api_specs
      JOIN public.company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_specs.id = api_spec_endpoints.api_spec_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can insert api_spec_endpoints" ON public.api_spec_endpoints;
CREATE POLICY "Admins and Editors can insert api_spec_endpoints"
  ON public.api_spec_endpoints
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.api_specs
      JOIN public.company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_specs.id = api_spec_endpoints.api_spec_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role IN ('admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can delete api_spec_endpoints" ON public.api_spec_endpoints;
CREATE POLICY "Admins and Editors can delete api_spec_endpoints"
  ON public.api_spec_endpoints
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.api_specs
      JOIN public.company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_specs.id = api_spec_endpoints.api_spec_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role IN ('admin', 'editor')
    )
  );

-- =====================================================
-- PART 5: Fix RLS Policies - api_endpoint_fields
-- =====================================================

DROP POLICY IF EXISTS "Users can view api_endpoint_fields" ON public.api_endpoint_fields;
CREATE POLICY "Users can view api_endpoint_fields"
  ON public.api_endpoint_fields
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.api_spec_endpoints
      JOIN public.api_specs ON api_specs.id = api_spec_endpoints.api_spec_id
      JOIN public.company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_spec_endpoints.id = api_endpoint_fields.api_spec_endpoint_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can insert api_endpoint_fields" ON public.api_endpoint_fields;
CREATE POLICY "Admins and Editors can insert api_endpoint_fields"
  ON public.api_endpoint_fields
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.api_spec_endpoints
      JOIN public.api_specs ON api_specs.id = api_spec_endpoints.api_spec_id
      JOIN public.company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_spec_endpoints.id = api_endpoint_fields.api_spec_endpoint_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role IN ('admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can delete api_endpoint_fields" ON public.api_endpoint_fields;
CREATE POLICY "Admins and Editors can delete api_endpoint_fields"
  ON public.api_endpoint_fields
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.api_spec_endpoints
      JOIN public.api_specs ON api_specs.id = api_spec_endpoints.api_spec_id
      JOIN public.company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_spec_endpoints.id = api_endpoint_fields.api_spec_endpoint_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role IN ('admin', 'editor')
    )
  );

-- =====================================================
-- PART 6: Fix RLS Policies - companies
-- =====================================================

DROP POLICY IF EXISTS "Members can read their companies" ON public.companies;
CREATE POLICY "Members can read their companies"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = companies.id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- PART 7: Fix RLS Policies - queries
-- =====================================================

DROP POLICY IF EXISTS "Users can view queries for their companies" ON public.queries;
CREATE POLICY "Users can view queries for their companies"
  ON public.queries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = queries.company_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can insert queries" ON public.queries;
CREATE POLICY "Admins and Editors can insert queries"
  ON public.queries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = queries.company_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role IN ('admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can update queries" ON public.queries;
CREATE POLICY "Admins and Editors can update queries"
  ON public.queries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = queries.company_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role IN ('admin', 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = queries.company_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role IN ('admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can delete queries" ON public.queries;
CREATE POLICY "Admins and Editors can delete queries"
  ON public.queries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = queries.company_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role IN ('admin', 'editor')
    )
  );

-- =====================================================
-- PART 8: Fix RLS Policies - fixed_values
-- =====================================================

DROP POLICY IF EXISTS "Users can view fixed values for their companies" ON public.fixed_values;
CREATE POLICY "Users can view fixed values for their companies"
  ON public.fixed_values
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = fixed_values.company_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create fixed values for their companies" ON public.fixed_values;
CREATE POLICY "Users can create fixed values for their companies"
  ON public.fixed_values
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = fixed_values.company_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update fixed values for their companies" ON public.fixed_values;
CREATE POLICY "Users can update fixed values for their companies"
  ON public.fixed_values
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = fixed_values.company_id
      AND company_memberships.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = fixed_values.company_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete fixed values for their companies" ON public.fixed_values;
CREATE POLICY "Users can delete fixed values for their companies"
  ON public.fixed_values
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_memberships.company_id = fixed_values.company_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- PART 9: Fix RLS Policies - dashboard_cells
-- =====================================================

DROP POLICY IF EXISTS "Users can view dashboard cells" ON public.dashboard_cells;
CREATE POLICY "Users can view dashboard cells"
  ON public.dashboard_cells
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboards.id = dashboard_cells.dashboard_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert dashboard cells" ON public.dashboard_cells;
CREATE POLICY "Users can insert dashboard cells"
  ON public.dashboard_cells
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboards
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboards.id = dashboard_cells.dashboard_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update dashboard cells" ON public.dashboard_cells;
CREATE POLICY "Users can update dashboard cells"
  ON public.dashboard_cells
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboards.id = dashboard_cells.dashboard_id
      AND company_memberships.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboards
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboards.id = dashboard_cells.dashboard_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete dashboard cells" ON public.dashboard_cells;
CREATE POLICY "Users can delete dashboard cells"
  ON public.dashboard_cells
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboards.id = dashboard_cells.dashboard_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- PART 10: Fix RLS Policies - dashboard_cell_drilldowns
-- =====================================================

DROP POLICY IF EXISTS "Users can view cell drilldowns" ON public.dashboard_cell_drilldowns;
CREATE POLICY "Users can view cell drilldowns"
  ON public.dashboard_cell_drilldowns
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_cells
      JOIN public.dashboards ON dashboards.id = dashboard_cells.dashboard_id
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboard_cells.id = dashboard_cell_drilldowns.cell_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert cell drilldowns" ON public.dashboard_cell_drilldowns;
CREATE POLICY "Users can insert cell drilldowns"
  ON public.dashboard_cell_drilldowns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboard_cells
      JOIN public.dashboards ON dashboards.id = dashboard_cells.dashboard_id
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboard_cells.id = dashboard_cell_drilldowns.cell_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update cell drilldowns" ON public.dashboard_cell_drilldowns;
CREATE POLICY "Users can update cell drilldowns"
  ON public.dashboard_cell_drilldowns
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_cells
      JOIN public.dashboards ON dashboards.id = dashboard_cells.dashboard_id
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboard_cells.id = dashboard_cell_drilldowns.cell_id
      AND company_memberships.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboard_cells
      JOIN public.dashboards ON dashboards.id = dashboard_cells.dashboard_id
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboard_cells.id = dashboard_cell_drilldowns.cell_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete cell drilldowns" ON public.dashboard_cell_drilldowns;
CREATE POLICY "Users can delete cell drilldowns"
  ON public.dashboard_cell_drilldowns
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_cells
      JOIN public.dashboards ON dashboards.id = dashboard_cells.dashboard_id
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboard_cells.id = dashboard_cell_drilldowns.cell_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- PART 11: Fix RLS Policies - grid_templates
-- =====================================================

DROP POLICY IF EXISTS "Users can view grid templates" ON public.grid_templates;
CREATE POLICY "Users can view grid templates"
  ON public.grid_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboards.id = grid_templates.dashboard_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert grid templates" ON public.grid_templates;
CREATE POLICY "Users can insert grid templates"
  ON public.grid_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboards
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboards.id = grid_templates.dashboard_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update grid templates" ON public.grid_templates;
CREATE POLICY "Users can update grid templates"
  ON public.grid_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboards.id = grid_templates.dashboard_id
      AND company_memberships.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboards
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboards.id = grid_templates.dashboard_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete grid templates" ON public.grid_templates;
CREATE POLICY "Users can delete grid templates"
  ON public.grid_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards
      JOIN public.projects ON projects.id = dashboards.project_id
      JOIN public.company_memberships ON company_memberships.company_id = projects.company_id
      WHERE dashboards.id = grid_templates.dashboard_id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- PART 12: Fix Function Search Path
-- =====================================================

CREATE OR REPLACE FUNCTION public.ensure_single_default_template()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.grid_templates
    SET is_default = false
    WHERE dashboard_id = NEW.dashboard_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;
