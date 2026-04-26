import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Plus, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { fetchRates, guessHomeCurrency, type ExchangeRates } from '../../services/currencyService';
import {
  EXPENSE_CATEGORIES,
  addExpense,
  deleteExpense,
  listTripExpenses,
  summarizeByCategory,
  type ExpenseCategory,
  type TripExpense,
} from '../../services/tripExpensesService';

interface Props {
  tripId: string;
  // Used to seed the currency picker with currencies the trip already
  // implies (one per destination), so the user doesn't scroll a 160-item
  // list every time they log a coffee.
  tripCurrencies?: string[];
}

const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'KRW', 'CHF'];

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

const BudgetSection: React.FC<Props> = ({ tripId, tripCurrencies = [] }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [homeCurrency, setHomeCurrency] = useState<string>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('homeCurrency') : null;
    return stored || guessHomeCurrency();
  });
  const [rates, setRates] = useState<ExchangeRates | null>(null);

  const currencyOptions = useMemo(() => {
    const set = new Set<string>([homeCurrency]);
    tripCurrencies.forEach((c) => c && set.add(c.toUpperCase()));
    COMMON_CURRENCIES.forEach((c) => set.add(c));
    return Array.from(set);
  }, [homeCurrency, tripCurrencies]);

  // Form state for the inline "add expense" row.
  const [draftAmount, setDraftAmount] = useState('');
  const [draftCurrency, setDraftCurrency] = useState<string>(() => tripCurrencies[0] || homeCurrency);
  const [draftCategory, setDraftCategory] = useState<ExpenseCategory>('Food');
  const [draftNote, setDraftNote] = useState('');
  const [draftDate, setDraftDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTripExpenses(tripId)
      .then((rows) => {
        if (cancelled) return;
        setExpenses(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  useEffect(() => {
    let cancelled = false;
    fetchRates(homeCurrency).then((r) => {
      if (cancelled) return;
      setRates(r);
    });
    return () => {
      cancelled = true;
    };
  }, [homeCurrency]);

  const rateLookup = useCallback(
    (currency: string): number | null => {
      const upper = currency.toUpperCase();
      if (upper === homeCurrency.toUpperCase()) return 1;
      if (!rates) return null;
      // rates.rates[X] = how many X you get per 1 home currency unit, so to
      // express X in home currency we divide.
      const r = rates.rates[upper];
      if (typeof r !== 'number' || r <= 0) return null;
      return 1 / r;
    },
    [rates, homeCurrency],
  );

  const summary = useMemo(() => summarizeByCategory(expenses, rateLookup), [expenses, rateLookup]);

  const handleAdd = async () => {
    if (!user?.id) {
      toast('Sign in to log expenses', 'error');
      return;
    }
    const amount = Number(draftAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast('Enter an amount greater than 0', 'error');
      return;
    }
    const currency = draftCurrency.trim().toUpperCase();
    if (currency.length !== 3) {
      toast('Currency must be a 3-letter code', 'error');
      return;
    }
    setBusy(true);
    const result = await addExpense({
      trip_id: tripId,
      user_id: user.id,
      amount,
      currency,
      category: draftCategory,
      note: draftNote.trim() || null,
      occurred_at: draftDate,
    });
    setBusy(false);
    if (result.error || !result.data) {
      toast(result.error || 'Could not add expense', 'error');
      return;
    }
    setExpenses((prev) => [result.data!, ...prev]);
    setDraftAmount('');
    setDraftNote('');
    setAdding(false);
    toast('Logged expense', 'success');
  };

  const handleDelete = async (expense: TripExpense) => {
    if (expense.user_id !== user?.id) {
      toast('Only the author can delete this expense', 'info');
      return;
    }
    setBusy(true);
    const result = await deleteExpense(expense.id);
    setBusy(false);
    if (result.error) {
      toast(result.error, 'error');
      return;
    }
    setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
  };

  const sortedCategories = useMemo(
    () =>
      Object.entries(summary.byCategory).sort(
        ([, a], [, b]) => b - a,
      ),
    [summary.byCategory],
  );
  const maxCategoryValue = sortedCategories[0]?.[1] || 1;

  return (
    <section
      style={{
        borderRadius: '20px',
        background: 'var(--surface-container)',
        border: '0.5px solid var(--outline)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
          >
            <Coins size={15} />
          </div>
          <div>
            <h3 className="text-[14px] font-extrabold leading-tight">Budget</h3>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {expenses.length === 0 ? 'No expenses logged yet' : `${expenses.length} entr${expenses.length === 1 ? 'y' : 'ies'}`}
            </p>
          </div>
        </div>
        <select
          value={homeCurrency}
          onChange={(e) => {
            const next = e.target.value;
            setHomeCurrency(next);
            try { window.localStorage.setItem('homeCurrency', next); } catch { /* ignore */ }
          }}
          className="text-[11px] font-bold rounded-lg px-2 py-1.5"
          style={{ background: 'var(--surface-container-high)', color: 'var(--text-primary)', border: 'none' }}
          aria-label="Home currency for the budget summary"
        >
          {currencyOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Total */}
      <div className="px-4 pb-3">
        <div className="text-[28px] font-extrabold leading-none tracking-tight">
          {rates ? formatMoney(summary.total, homeCurrency) : '—'}
        </div>
        <div className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
          Total spent in {homeCurrency}
          {summary.unconverted.length > 0 && (
            <> · {summary.unconverted.length} entr{summary.unconverted.length === 1 ? 'y' : 'ies'} pending FX</>
          )}
        </div>
      </div>

      {/* Category breakdown */}
      {sortedCategories.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5">
          {sortedCategories.map(([cat, value]) => {
            const pct = Math.max(2, (value / maxCategoryValue) * 100);
            return (
              <div key={cat} className="flex items-center gap-2">
                <div className="text-[11px] font-bold w-20 truncate" style={{ color: 'var(--text-secondary)' }}>{cat}</div>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-container-high)' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: '9999px' }} />
                </div>
                <div className="text-[11px] font-bold w-20 text-right">{formatMoney(value, homeCurrency)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add row */}
      {adding ? (
        <div className="px-4 pb-3 pt-2 space-y-2" style={{ borderTop: '0.5px solid var(--outline)' }}>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              placeholder="Amount"
              value={draftAmount}
              onChange={(e) => setDraftAmount(e.target.value)}
              className="flex-1 text-[13px] font-semibold px-3 py-2 rounded-lg"
              style={{ background: 'var(--surface-container-high)', color: 'var(--text-primary)', border: 'none' }}
            />
            <select
              value={draftCurrency}
              onChange={(e) => setDraftCurrency(e.target.value)}
              className="text-[12px] font-bold px-2 py-2 rounded-lg"
              style={{ background: 'var(--surface-container-high)', color: 'var(--text-primary)', border: 'none' }}
            >
              {currencyOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="text-[12px] px-2 py-2 rounded-lg"
              style={{ background: 'var(--surface-container-high)', color: 'var(--text-primary)', border: 'none' }}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            {EXPENSE_CATEGORIES.map((cat) => {
              const active = draftCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setDraftCategory(cat)}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0"
                  style={{
                    background: active ? 'var(--accent)' : 'var(--surface-container-high)',
                    color: active ? 'var(--on-accent)' : 'var(--text-secondary)',
                    border: 'none',
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            placeholder="Note (optional)"
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            maxLength={120}
            className="w-full text-[13px] px-3 py-2 rounded-lg"
            style={{ background: 'var(--surface-container-high)', color: 'var(--text-primary)', border: 'none' }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setAdding(false); setDraftAmount(''); setDraftNote(''); }}
              className="flex-1 text-[12px] font-bold py-2 rounded-lg"
              style={{ background: 'var(--surface-container-high)', color: 'var(--text-primary)', border: 'none' }}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="flex-[1.5] text-[12px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)', border: 'none' }}
              disabled={busy}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              Save expense
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full text-[12px] font-bold py-3 flex items-center justify-center gap-1.5"
          style={{
            borderTop: '0.5px solid var(--outline)',
            color: 'var(--accent)',
            background: 'transparent',
            border: 'none',
          }}
        >
          <Plus size={14} /> Log an expense
        </button>
      )}

      {/* Recent entries */}
      {expenses.length > 0 && (
        <div style={{ borderTop: '0.5px solid var(--outline)' }}>
          <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
            Recent
          </div>
          <ul>
            {expenses.slice(0, 8).map((e) => {
              const homeRate = rateLookup(e.currency);
              const homeAmount = homeRate != null ? Number(e.amount) * homeRate : null;
              const isMine = e.user_id === user?.id;
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderTop: '0.33px solid var(--outline)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">
                      {e.note || e.category}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {e.category} · {new Date(e.occurred_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-extrabold leading-tight">
                      {formatMoney(Number(e.amount), e.currency)}
                    </div>
                    {homeAmount != null && e.currency.toUpperCase() !== homeCurrency.toUpperCase() && (
                      <div className="text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                        ≈ {formatMoney(homeAmount, homeCurrency)}
                      </div>
                    )}
                  </div>
                  {isMine && (
                    <button
                      onClick={() => handleDelete(e)}
                      className="flex items-center justify-center w-7 h-7 rounded-full"
                      style={{ background: 'transparent', color: 'var(--text-tertiary)', border: 'none' }}
                      aria-label="Delete expense"
                      disabled={busy}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {loading && expenses.length === 0 && (
        <div className="px-4 py-3 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          Loading expenses…
        </div>
      )}
    </section>
  );
};

export default BudgetSection;
