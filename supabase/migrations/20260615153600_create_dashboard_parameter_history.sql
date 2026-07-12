CREATE TABLE dashboard_parameter_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parameter_values jsonb NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_param_history_lookup
  ON dashboard_parameter_history (dashboard_id, user_id, used_at DESC);

ALTER TABLE dashboard_parameter_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_parameter_history" ON dashboard_parameter_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert_own_parameter_history" ON dashboard_parameter_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_parameter_history" ON dashboard_parameter_history
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_parameter_history" ON dashboard_parameter_history
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
