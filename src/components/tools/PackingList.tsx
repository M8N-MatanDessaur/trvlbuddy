import React, { useState, useEffect } from 'react';
import { Luggage, Loader2, Check, RotateCcw, Shirt, Droplets, Smartphone, FileText, HeartPulse, Watch, Package } from 'lucide-react';
import { useContextEngine } from '../../contexts/ContextEngineContext';
import { useTravel } from '../../contexts/TravelContext';
import { generatePackingList, type PackingItem } from '../../services/aiService';
import type { LucideIcon } from 'lucide-react';

const categoryIcons: Record<PackingItem['category'], LucideIcon> = {
  clothing: Shirt,
  toiletries: Droplets,
  electronics: Smartphone,
  documents: FileText,
  health: HeartPulse,
  accessories: Watch,
  other: Package,
};

const STORAGE_KEY = 'trvlbuddy-packing-list';
const CHECKED_KEY = 'trvlbuddy-packing-checked';

const PackingList: React.FC = () => {
  const { moment } = useContextEngine();
  const { currentPlan, activities } = useTravel();
  const [items, setItems] = useState<PackingItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(CHECKED_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // Only show pre-trip
  if (moment.tripPhase !== 'pre-trip') return null;
  if (!currentPlan) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const destinations = currentPlan.destinations?.map((d) => `${d.name}, ${d.country}`) ??
        [currentPlan.destination ? `${currentPlan.destination.name}, ${currentPlan.destination.country}` : 'destination'];
      const activityNames = activities.slice(0, 15).map((a) => a.name);

      // Simple weather summary from destination coordinates
      const weatherParts: string[] = [];
      for (const dest of currentPlan.destinations ?? []) {
        try {
          const res = await fetch(`https://wttr.in/${encodeURIComponent(dest.name)}?format=j1`);
          if (res.ok) {
            const data = await res.json();
            const cur = data.current_condition?.[0];
            if (cur) weatherParts.push(`${dest.name}: ${cur.temp_C}C, ${cur.weatherDesc[0].value}`);
          }
        } catch {
          // skip
        }
      }

      const result = await generatePackingList(
        destinations,
        currentPlan.startDate,
        currentPlan.endDate,
        activityNames,
        weatherParts.join('; ') || 'Weather data unavailable',
      );

      setItems(result);
      setCheckedItems(new Set());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      localStorage.setItem(CHECKED_KEY, '[]');
    } catch {
      // silently fail
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleCheck = (itemName: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemName)) next.delete(itemName);
      else next.add(itemName);
      localStorage.setItem(CHECKED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  // Group items by category
  const grouped = items.reduce<Record<string, PackingItem[]>>((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const totalItems = items.length;
  const checkedCount = checkedItems.size;
  const progress = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Luggage size={16} style={{ color: 'var(--accent)' }} />
          <span className="text-[13px] font-bold">Packing List</span>
        </div>
        {items.length > 0 && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1 text-[11px] font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            <RotateCcw size={11} />
            Regenerate
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl transition-transform active:scale-[0.98] disabled:opacity-60"
          style={{ background: 'var(--accent-container)' }}
        >
          {isGenerating ? (
            <>
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <span className="text-[14px] font-semibold" style={{ color: 'var(--accent)' }}>
                Generating your packing list...
              </span>
            </>
          ) : (
            <>
              <Luggage size={20} style={{ color: 'var(--accent)' }} />
              <div className="text-left">
                <div className="text-[14px] font-bold" style={{ color: 'var(--accent)' }}>
                  Generate Packing List
                </div>
                <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  AI-powered list based on your trip, activities, and weather
                </div>
              </div>
            </>
          )}
        </button>
      ) : (
        <>
          {/* Progress bar */}
          <div className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {checkedCount} of {totalItems} packed
              </span>
              <span className="text-[12px] font-bold" style={{ color: 'var(--accent)' }}>
                {progress}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-container-high)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'var(--accent)' }}
              />
            </div>
          </div>

          {/* Items by category */}
          {Object.entries(grouped).map(([category, catItems]) => {
            const CatIcon = categoryIcons[category as PackingItem['category']] || Package;
            return (
              <div key={category} className="space-y-1">
                <div className="flex items-center gap-1.5 px-1 mb-1">
                  <CatIcon size={12} style={{ color: 'var(--accent)' }} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.05em]" style={{ color: 'var(--text-tertiary)' }}>
                    {category}
                  </span>
                </div>
                {catItems.map((item) => {
                  const isChecked = checkedItems.has(item.item);
                  return (
                    <button
                      key={item.item}
                      onClick={() => toggleCheck(item.item)}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all"
                      style={{ background: 'var(--surface-container)', opacity: isChecked ? 0.5 : 1 }}
                    >
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                        style={{
                          background: isChecked ? 'var(--accent)' : 'transparent',
                          border: isChecked ? 'none' : '2px solid var(--outline)',
                        }}
                      >
                        {isChecked && <Check size={12} color="white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[13px] font-semibold"
                          style={{
                            color: 'var(--text-primary)',
                            textDecoration: isChecked ? 'line-through' : 'none',
                          }}
                        >
                          {item.item}
                          {item.essential && (
                            <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}>
                              Essential
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {item.reason}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default PackingList;
