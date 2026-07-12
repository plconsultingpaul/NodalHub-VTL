import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { FixedValue, FixedValueType, FixedValueListItem } from '../types/database';

export function useFixedValues() {
  const { activeCompany, user } = useAuth();
  const [fixedValues, setFixedValues] = useState<FixedValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFixedValues = useCallback(async () => {
    if (!activeCompany?.id) {
      setFixedValues([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('fixed_values')
        .select('*')
        .eq('company_id', activeCompany.id)
        .order('name');

      if (fetchError) throw fetchError;
      setFixedValues((data as FixedValue[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch fixed values');
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id]);

  useEffect(() => {
    fetchFixedValues();
  }, [fetchFixedValues]);

  const createFixedValue = async (
    fixedValue: Omit<FixedValue, 'id' | 'created_at' | 'updated_at' | 'company_id' | 'created_by'>
  ) => {
    if (!activeCompany?.id || !user?.id) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('fixed_values')
      .insert({
        ...fixedValue,
        company_id: activeCompany.id,
        created_by: user.id
      })
      .select()
      .single();

    if (error) return { error: error.message };
    await fetchFixedValues();
    return { data };
  };

  const updateFixedValue = async (id: string, updates: Partial<FixedValue>) => {
    const { data, error } = await supabase
      .from('fixed_values')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };
    await fetchFixedValues();
    return { data };
  };

  const deleteFixedValue = async (id: string) => {
    const { error } = await supabase
      .from('fixed_values')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };
    await fetchFixedValues();
    return { error: null };
  };

  const getFixedValuesByType = useCallback((type: FixedValueType | 'all') => {
    if (type === 'all') return fixedValues;
    return fixedValues.filter(fv => fv.value_type === type);
  }, [fixedValues]);

  const getResolvedValue = useCallback((fixedValue: FixedValue): string => {
    if (fixedValue.is_list) {
      const listItems = (fixedValue.list_values as FixedValueListItem[]) || [];
      if (fixedValue.default_value) {
        return fixedValue.default_value;
      }
      return listItems[0]?.value || '';
    }
    return fixedValue.single_value || '';
  }, []);

  return {
    fixedValues,
    loading,
    error,
    refetch: fetchFixedValues,
    createFixedValue,
    updateFixedValue,
    deleteFixedValue,
    getFixedValuesByType,
    getResolvedValue
  };
}
