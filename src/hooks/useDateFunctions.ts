import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { DateFunction, DateFunctionBaseDate } from '../types/database';

export function useDateFunctions() {
  const { activeCompany } = useAuth();
  const [dateFunctions, setDateFunctions] = useState<DateFunction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDateFunctions = useCallback(async () => {
    if (!activeCompany?.id) {
      setDateFunctions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('date_functions')
      .select('*')
      .eq('company_id', activeCompany.id)
      .order('name');

    if (error) {
      console.error('[useDateFunctions] Error:', error);
    } else {
      setDateFunctions(data || []);
    }
    setLoading(false);
  }, [activeCompany?.id]);

  useEffect(() => {
    fetchDateFunctions();
  }, [fetchDateFunctions]);

  const createDateFunction = async (fn: {
    name: string;
    description?: string;
    base_date: DateFunctionBaseDate;
    string_format: string;
    adjust_years: number;
    adjust_months: number;
    adjust_days: number;
  }) => {
    if (!activeCompany?.id) return null;
    const { data, error } = await supabase
      .from('date_functions')
      .insert({ ...fn, company_id: activeCompany.id })
      .select()
      .maybeSingle();

    if (error) {
      console.error('[useDateFunctions] Create error:', error);
      return null;
    }
    await fetchDateFunctions();
    return data;
  };

  const updateDateFunction = async (id: string, updates: Partial<Omit<DateFunction, 'id' | 'company_id' | 'created_at' | 'updated_at'>>) => {
    const { error } = await supabase
      .from('date_functions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[useDateFunctions] Update error:', error);
      return false;
    }
    await fetchDateFunctions();
    return true;
  };

  const deleteDateFunction = async (id: string) => {
    const { error } = await supabase
      .from('date_functions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[useDateFunctions] Delete error:', error);
      return false;
    }
    await fetchDateFunctions();
    return true;
  };

  return { dateFunctions, loading, fetchDateFunctions, createDateFunction, updateDateFunction, deleteDateFunction };
}
