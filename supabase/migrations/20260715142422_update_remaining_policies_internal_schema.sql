/*
# Update remaining RLS policies to use internal schema functions

## Summary
Updates all remaining RLS policies that still reference unqualified public helper
functions (is_company_admin, is_company_member, can_edit_company) to use the
schema-qualified internal.* versions.

## Tables affected
- dashboards (read, create, delete)
- pulses (delete)
- api_endpoints (all CRUD)
- dashboard_widgets (all CRUD)
- pulse_schedules (all CRUD)
- pulse_exports (all CRUD)
- pulse_emails (all CRUD)
- pulse_post_run_steps (all CRUD)
- pulse_executions (read)
- system_configuration (all CRUD)
*/

-- dashboards
DROP POLICY IF EXISTS "Members can read dashboards" ON public.dashboards;
CREATE POLICY "Members can read dashboards"
  ON public.dashboards FOR SELECT
  TO authenticated
  USING (internal.is_company_member(company_id));

DROP POLICY IF EXISTS "Editors can create dashboards" ON public.dashboards;
CREATE POLICY "Editors can create dashboards"
  ON public.dashboards FOR INSERT
  TO authenticated
  WITH CHECK (internal.can_edit_company(company_id));

DROP POLICY IF EXISTS "Editors can delete dashboards" ON public.dashboards;
CREATE POLICY "Editors can delete dashboards"
  ON public.dashboards FOR DELETE
  TO authenticated
  USING (internal.can_edit_company(company_id));

-- pulses
DROP POLICY IF EXISTS "Editors can delete pulses" ON public.pulses;
CREATE POLICY "Editors can delete pulses"
  ON public.pulses FOR DELETE
  TO authenticated
  USING (internal.can_edit_company(company_id));

-- api_endpoints
DROP POLICY IF EXISTS "Members can read endpoints" ON public.api_endpoints;
CREATE POLICY "Members can read endpoints"
  ON public.api_endpoints FOR SELECT
  TO authenticated
  USING (internal.is_company_member(company_id));

DROP POLICY IF EXISTS "Editors can create endpoints" ON public.api_endpoints;
CREATE POLICY "Editors can create endpoints"
  ON public.api_endpoints FOR INSERT
  TO authenticated
  WITH CHECK (internal.can_edit_company(company_id));

DROP POLICY IF EXISTS "Editors can update endpoints" ON public.api_endpoints;
CREATE POLICY "Editors can update endpoints"
  ON public.api_endpoints FOR UPDATE
  TO authenticated
  USING (internal.can_edit_company(company_id))
  WITH CHECK (internal.can_edit_company(company_id));

DROP POLICY IF EXISTS "Editors can delete endpoints" ON public.api_endpoints;
CREATE POLICY "Editors can delete endpoints"
  ON public.api_endpoints FOR DELETE
  TO authenticated
  USING (internal.can_edit_company(company_id));

-- dashboard_widgets
DROP POLICY IF EXISTS "Members can read widgets" ON public.dashboard_widgets;
CREATE POLICY "Members can read widgets"
  ON public.dashboard_widgets FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dashboards WHERE dashboards.id = dashboard_widgets.dashboard_id AND internal.is_company_member(dashboards.company_id)));

DROP POLICY IF EXISTS "Editors can create widgets" ON public.dashboard_widgets;
CREATE POLICY "Editors can create widgets"
  ON public.dashboard_widgets FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.dashboards WHERE dashboards.id = dashboard_widgets.dashboard_id AND internal.can_edit_company(dashboards.company_id)));

DROP POLICY IF EXISTS "Editors can update widgets" ON public.dashboard_widgets;
CREATE POLICY "Editors can update widgets"
  ON public.dashboard_widgets FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dashboards WHERE dashboards.id = dashboard_widgets.dashboard_id AND internal.can_edit_company(dashboards.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.dashboards WHERE dashboards.id = dashboard_widgets.dashboard_id AND internal.can_edit_company(dashboards.company_id)));

DROP POLICY IF EXISTS "Editors can delete widgets" ON public.dashboard_widgets;
CREATE POLICY "Editors can delete widgets"
  ON public.dashboard_widgets FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dashboards WHERE dashboards.id = dashboard_widgets.dashboard_id AND internal.can_edit_company(dashboards.company_id)));

-- pulse_schedules
DROP POLICY IF EXISTS "Members can read pulse_schedules" ON public.pulse_schedules;
CREATE POLICY "Members can read pulse_schedules"
  ON public.pulse_schedules FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_schedules.pulse_id AND internal.is_company_member(p.company_id)));

DROP POLICY IF EXISTS "Editors can insert pulse_schedules" ON public.pulse_schedules;
CREATE POLICY "Editors can insert pulse_schedules"
  ON public.pulse_schedules FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_schedules.pulse_id AND internal.can_edit_company(p.company_id)));

DROP POLICY IF EXISTS "Editors can update pulse_schedules" ON public.pulse_schedules;
CREATE POLICY "Editors can update pulse_schedules"
  ON public.pulse_schedules FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_schedules.pulse_id AND internal.can_edit_company(p.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_schedules.pulse_id AND internal.can_edit_company(p.company_id)));

DROP POLICY IF EXISTS "Editors can delete pulse_schedules" ON public.pulse_schedules;
CREATE POLICY "Editors can delete pulse_schedules"
  ON public.pulse_schedules FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_schedules.pulse_id AND internal.can_edit_company(p.company_id)));

-- pulse_exports
DROP POLICY IF EXISTS "Members can read pulse_exports" ON public.pulse_exports;
CREATE POLICY "Members can read pulse_exports"
  ON public.pulse_exports FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_exports.pulse_id AND internal.is_company_member(p.company_id)));

DROP POLICY IF EXISTS "Editors can insert pulse_exports" ON public.pulse_exports;
CREATE POLICY "Editors can insert pulse_exports"
  ON public.pulse_exports FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_exports.pulse_id AND internal.can_edit_company(p.company_id)));

DROP POLICY IF EXISTS "Editors can update pulse_exports" ON public.pulse_exports;
CREATE POLICY "Editors can update pulse_exports"
  ON public.pulse_exports FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_exports.pulse_id AND internal.can_edit_company(p.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_exports.pulse_id AND internal.can_edit_company(p.company_id)));

DROP POLICY IF EXISTS "Editors can delete pulse_exports" ON public.pulse_exports;
CREATE POLICY "Editors can delete pulse_exports"
  ON public.pulse_exports FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_exports.pulse_id AND internal.can_edit_company(p.company_id)));

-- pulse_emails
DROP POLICY IF EXISTS "Members can read pulse_emails" ON public.pulse_emails;
CREATE POLICY "Members can read pulse_emails"
  ON public.pulse_emails FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_emails.pulse_id AND internal.is_company_member(p.company_id)));

DROP POLICY IF EXISTS "Editors can insert pulse_emails" ON public.pulse_emails;
CREATE POLICY "Editors can insert pulse_emails"
  ON public.pulse_emails FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_emails.pulse_id AND internal.can_edit_company(p.company_id)));

DROP POLICY IF EXISTS "Editors can update pulse_emails" ON public.pulse_emails;
CREATE POLICY "Editors can update pulse_emails"
  ON public.pulse_emails FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_emails.pulse_id AND internal.can_edit_company(p.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_emails.pulse_id AND internal.can_edit_company(p.company_id)));

DROP POLICY IF EXISTS "Editors can delete pulse_emails" ON public.pulse_emails;
CREATE POLICY "Editors can delete pulse_emails"
  ON public.pulse_emails FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_emails.pulse_id AND internal.can_edit_company(p.company_id)));

-- pulse_post_run_steps
DROP POLICY IF EXISTS "Members can read pulse_post_run_steps" ON public.pulse_post_run_steps;
CREATE POLICY "Members can read pulse_post_run_steps"
  ON public.pulse_post_run_steps FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_post_run_steps.pulse_id AND internal.is_company_member(p.company_id)));

DROP POLICY IF EXISTS "Editors can insert pulse_post_run_steps" ON public.pulse_post_run_steps;
CREATE POLICY "Editors can insert pulse_post_run_steps"
  ON public.pulse_post_run_steps FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_post_run_steps.pulse_id AND internal.can_edit_company(p.company_id)));

DROP POLICY IF EXISTS "Editors can update pulse_post_run_steps" ON public.pulse_post_run_steps;
CREATE POLICY "Editors can update pulse_post_run_steps"
  ON public.pulse_post_run_steps FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_post_run_steps.pulse_id AND internal.can_edit_company(p.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_post_run_steps.pulse_id AND internal.can_edit_company(p.company_id)));

DROP POLICY IF EXISTS "Editors can delete pulse_post_run_steps" ON public.pulse_post_run_steps;
CREATE POLICY "Editors can delete pulse_post_run_steps"
  ON public.pulse_post_run_steps FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_post_run_steps.pulse_id AND internal.can_edit_company(p.company_id)));

-- pulse_executions
DROP POLICY IF EXISTS "Members can read pulse_executions" ON public.pulse_executions;
CREATE POLICY "Members can read pulse_executions"
  ON public.pulse_executions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pulses p WHERE p.id = pulse_executions.pulse_id AND internal.is_company_member(p.company_id)));

-- system_configuration
DROP POLICY IF EXISTS "Admins can read system_configuration" ON public.system_configuration;
CREATE POLICY "Admins can read system_configuration"
  ON public.system_configuration FOR SELECT
  TO authenticated
  USING (internal.is_company_admin());

DROP POLICY IF EXISTS "Admins can insert system_configuration" ON public.system_configuration;
CREATE POLICY "Admins can insert system_configuration"
  ON public.system_configuration FOR INSERT
  TO authenticated
  WITH CHECK (internal.is_company_admin());

DROP POLICY IF EXISTS "Admins can update system_configuration" ON public.system_configuration;
CREATE POLICY "Admins can update system_configuration"
  ON public.system_configuration FOR UPDATE
  TO authenticated
  USING (internal.is_company_admin())
  WITH CHECK (internal.is_company_admin());

DROP POLICY IF EXISTS "Admins can delete system_configuration" ON public.system_configuration;
CREATE POLICY "Admins can delete system_configuration"
  ON public.system_configuration FOR DELETE
  TO authenticated
  USING (internal.is_company_admin());
