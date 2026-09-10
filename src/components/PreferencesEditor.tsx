import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import {
  MAX_PREFERENCES,
  PREFERENCE_SUGGESTIONS,
  describePreferences,
  getPreferences,
  savePreferences,
} from '../services/preferences';
import { useToast } from '../contexts/ToastContext';

/**
 * The things you want to see first, in the order you want them.
 *
 * Folded away by default. Most visits to a profile are not visits to change
 * this, and the summary line says everything a glance needs, so the section
 * costs one row until it is asked for.
 *
 * The order is the feature, not decoration: the list is a priority order, so
 * whatever is first outranks whatever is second when both could match. That
 * is why each row carries its position.
 *
 * The ideas below it scroll past in two directions rather than sitting in a
 * static block, because a wall of forty pills reads as a form to fill in,
 * while something moving reads as suggestions going by. Tapping one puts it
 * in the field rather than adding it outright: the idea is a starting point
 * and most of them are better once edited.
 */
interface Props {
  userId: string;
}

/** Half the list one way, half the other, so the two rows never mirror. */
function splitForMarquee(list: string[]): [string[], string[]] {
  const top: string[] = [];
  const bottom: string[] = [];
  list.forEach((item, i) => (i % 2 === 0 ? top : bottom).push(item));
  return [top, bottom];
}

const PreferencesEditor: React.FC<Props> = ({ userId }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPreferences(userId)
      .then((list) => { if (!cancelled) setItems(list); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  // The placeholder cycles, so the field itself keeps suggesting. Only while
  // the section is open and the field is empty, nothing should be moving
  // behind something someone is typing into.
  useEffect(() => {
    if (!open || draft.length > 0) return;
    const timer = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PREFERENCE_SUGGESTIONS.length);
    }, 2200);
    return () => clearInterval(timer);
  }, [open, draft.length]);

  const persist = async (next: string[]) => {
    setItems(next);
    setSaving(true);
    const result = await savePreferences(userId, next);
    setSaving(false);
    if (!result.ok) {
      toast(result.error || 'Could not save your preferences', 'error');
      // Show what the server still has, rather than leaving the screen
      // claiming something that was never stored.
      getPreferences(userId).then(setItems).catch(() => {});
    }
  };

  const add = (value: string) => {
    const clean = value.trim().replace(/\s+/g, ' ');
    if (clean.length < 2) return;
    if (items.length >= MAX_PREFERENCES) {
      toast(`${MAX_PREFERENCES} is the limit, it is a priority list`, 'info');
      return;
    }
    if (items.some((i) => i.toLowerCase() === clean.toLowerCase())) {
      setDraft('');
      return;
    }
    setDraft('');
    void persist([...items, clean]);
  };

  const remove = (index: number) => void persist(items.filter((_, i) => i !== index));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    void persist(next);
  };

  /** A tapped idea lands in the field, ready to keep or change. */
  const suggest = (value: string) => {
    setDraft(value);
    inputRef.current?.focus();
  };

  const unused = useMemo(
    () => PREFERENCE_SUGGESTIONS.filter(
      (s) => !items.some((i) => i.toLowerCase() === s.toLowerCase()),
    ),
    [items],
  );
  const [topRow, bottomRow] = useMemo(() => splitForMarquee(unused), [unused]);

  // Read back as a sentence, because this sits on a profile and a profile
  // says who someone is. A row of chips would only say what was configured.
  const summary = loading
    ? 'Loading...'
    : items.length === 0
      ? 'Tell Nearby what to put first'
      : describePreferences(items);

  const pill = (value: string) => (
    <button
      key={value}
      type="button"
      onClick={() => suggest(value)}
      className="px-3 py-1.5 rounded-full text-[11.5px] font-semibold whitespace-nowrap flex-shrink-0 transition-transform active:scale-95"
      style={{
        background: 'var(--surface-container)',
        color: 'var(--text-secondary)',
        border: '0.5px solid var(--outline)',
      }}
    >
      {value}
    </button>
  );

  return (
    // No card of its own: this lives inside the profile badge, and a card
    // inside a card is how a badge turns back into a form.
    <div className="relative">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1"
            style={{ color: 'var(--accent)' }}
          >
            What I want to see first
          </div>
          <p
            className="text-[12.5px] leading-relaxed"
            style={{ color: items.length > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
          >
            {summary}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Close preferences' : 'Edit what I want to see first'}
          className="flex items-center justify-center rounded-full flex-shrink-0 transition-transform active:scale-90"
          style={{
            width: '34px',
            height: '34px',
            minHeight: '34px',
            background: open ? 'var(--surface-container-high)' : 'var(--accent)',
            color: open ? 'var(--text-secondary)' : 'var(--on-accent)',
            border: 'none',
          }}
        >
          {open ? <X size={15} /> : <Plus size={16} />}
        </button>
      </div>

      {open && (
        <div className="mt-3">
          <p className="text-[11.5px] leading-relaxed mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Nearby puts these first, in this order. If nothing here is actually
            nearby, nothing gets promoted, you will never be shown something
            adjacent pretending to be a match.
          </p>

          {items.length > 0 && (
            <ol className="space-y-2 mb-3">
              {items.map((item, index) => (
                <li
                  key={item}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2"
                  style={{ background: 'var(--surface-container)' }}
                >
                  <span
                    className="text-[11px] font-extrabold tabular-nums w-4 text-center flex-shrink-0"
                    style={{ color: 'var(--accent)' }}
                  >
                    {index + 1}
                  </span>
                  <span className="text-[13px] font-semibold flex-1 truncate">{item}</span>
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${item} up`}
                    className="flex items-center justify-center rounded-lg disabled:opacity-30"
                    style={{ width: '28px', height: '28px', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}
                  >
                    <GripVertical size={13} style={{ transform: 'rotate(90deg)' }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Remove ${item}`}
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: '28px', height: '28px', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ol>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); add(draft); }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={PREFERENCE_SUGGESTIONS[placeholderIndex]}
              maxLength={40}
              className="flex-1 min-w-0 rounded-xl px-3 text-[13px]"
              style={{
                height: '44px',
                background: 'var(--surface-container)',
                border: '0.5px solid var(--outline)',
                color: 'var(--text-primary)',
              }}
              aria-label="Add a preference"
            />
            <button
              type="submit"
              disabled={draft.trim().length < 2 || saving}
              className="flex items-center justify-center rounded-xl disabled:opacity-40 flex-shrink-0"
              style={{
                width: '44px',
                height: '44px',
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                border: 'none',
              }}
              aria-label="Add"
            >
              <Plus size={17} />
            </button>
          </form>

          {items.length < MAX_PREFERENCES && unused.length > 0 && (
            <div
              className="mt-3 space-y-2"
              style={{
                // Fade at both ends, so the rows read as passing through
                // rather than being cut off.
                maskImage:
                  'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
                WebkitMaskImage:
                  'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
              }}
            >
              {/* Duplicated content and a -50% travel: the house marquee, so
                  the loop has no seam. */}
              <div className="overflow-hidden">
                <div
                  className="flex gap-1.5 marquee-scroll-left"
                  style={{ ['--marquee-speed' as string]: '96s' }}
                >
                  {[...topRow, ...topRow].map((s, i) => (
                    <React.Fragment key={`${s}-${i}`}>{pill(s)}</React.Fragment>
                  ))}
                </div>
              </div>
              <div className="overflow-hidden">
                <div
                  className="flex gap-1.5 marquee-scroll-right"
                  style={{ ['--marquee-speed' as string]: '112s' }}
                >
                  {[...bottomRow, ...bottomRow].map((s, i) => (
                    <React.Fragment key={`${s}-${i}`}>{pill(s)}</React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PreferencesEditor;
