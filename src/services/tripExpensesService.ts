import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type TripExpense = Database['public']['Tables']['trip_expenses']['Row'];
export type TripExpenseInsert = Database['public']['Tables']['trip_expenses']['Insert'];
export type TripExpenseUpdate = Database['public']['Tables']['trip_expenses']['Update'];

// Default category set. Free-form `category` strings are still stored as-is
// so a user can type "Massage" or "Souvenir" and we keep it; this list just
// drives the picker chips and the default donut breakdown.
export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Lodging',
  'Activities',
  'Shopping',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number] | string;

export async function listTripExpenses(tripId: string): Promise<TripExpense[]> {
  const { data, error } = await supabase
    .from('trip_expenses')
    .select('*')
    .eq('trip_id', tripId)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('listTripExpenses failed', error);
    return [];
  }
  return data || [];
}

export async function addExpense(
  expense: Omit<TripExpenseInsert, 'id' | 'created_at'>,
): Promise<{ data: TripExpense | null; error: string | null }> {
  const { data, error } = await supabase
    .from('trip_expenses')
    .insert(expense)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('addExpense failed', error);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

export async function updateExpense(
  id: string,
  patch: TripExpenseUpdate,
): Promise<{ data: TripExpense | null; error: string | null }> {
  const { data, error } = await supabase
    .from('trip_expenses')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('updateExpense failed', error);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

export async function deleteExpense(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('trip_expenses').delete().eq('id', id);
  if (error) {
    console.error('deleteExpense failed', error);
    return { error: error.message };
  }
  return { error: null };
}

// Sum a list of expenses by category, normalized to a single home currency.
// rateLookup(currency) -> rate-of-1-unit-of-currency in home currency, or
// null when we can't convert (in which case the entry is excluded from the
// total and counted in `unconverted`).
export interface CategoryBreakdown {
  byCategory: Record<string, number>;
  total: number;
  unconverted: TripExpense[];
}

export function summarizeByCategory(
  expenses: TripExpense[],
  rateLookup: (currency: string) => number | null,
): CategoryBreakdown {
  const byCategory: Record<string, number> = {};
  let total = 0;
  const unconverted: TripExpense[] = [];
  for (const e of expenses) {
    const rate = rateLookup(e.currency);
    if (rate == null) {
      unconverted.push(e);
      continue;
    }
    const value = Number(e.amount) * rate;
    const cat = e.category || 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + value;
    total += value;
  }
  return { byCategory, total, unconverted };
}
