import { supabase } from './supabase';

type EventType = 'login' | 'dashboard_open' | 'action_execute' | 'action_failed' | 'pulse_trigger' | 'csv_export' | 'csv_email' | 'user_deactivated' | 'user_activated';

export async function logActivity(
  eventType: EventType,
  companyId: string,
  resourceName?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !companyId) return;

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    company_id: companyId,
    event_type: eventType,
    resource_name: resourceName || null,
    resource_id: resourceId || null,
    metadata: metadata || {},
  });
}
