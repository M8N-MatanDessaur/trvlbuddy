import React from 'react';
import { Droplets, Plug, ReceiptText, TramFront } from 'lucide-react';
import type { QuickFact } from '../../data/countryFacts';

interface Props {
  /** Where these facts are about. "Japan", or "Montreal, QC". */
  place: string | null;
  facts: QuickFact;
  /** True while we are still working out where you are. */
  loading?: boolean;
}

function waterLine(water: QuickFact['water']): string | null {
  switch (water) {
    case 'safe':
      return 'Tap water is safe to drink.';
    case 'caution':
      return 'Tap water is treated, but many people stick to bottled.';
    case 'avoid':
      return 'Do not drink the tap water.';
    default:
      return null;
  }
}

/**
 * The things you look up in the first hour somewhere new.
 *
 * Tipping, plugs, water, getting around. All of it is bundled with the app,
 * so it answers at an airport with no signal and costs nothing to ask.
 *
 * Which country it is about depends on where you are standing, not on
 * whether you have planned a trip, so this works the same in Nearby as it
 * does on a trip to the other side of the world.
 */
const WhereYouAreCard: React.FC<Props> = ({ place, facts, loading = false }) => {
  const water = waterLine(facts.water);

  const rows: Array<{ icon: React.ReactNode; label: string; value: string }> = [
    { icon: <ReceiptText size={15} />, label: 'Tipping', value: facts.tipping },
    { icon: <Plug size={15} />, label: 'Plugs', value: `${facts.plug}, ${facts.voltage}` },
  ];
  if (water) rows.push({ icon: <Droplets size={15} />, label: 'Water', value: water });
  if (facts.transit) {
    rows.push({ icon: <TramFront size={15} />, label: 'Getting around', value: facts.transit });
  }

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.1em]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Good to know
        </span>
        {place && (
          <span className="text-[12px] font-bold truncate ml-2" style={{ color: 'var(--text-secondary)' }}>
            {loading ? 'Finding you...' : place}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-2.5">
            <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }}>
              {row.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--text-tertiary)' }}>
                {row.label}
              </p>
              <p className="text-[13px] leading-snug" style={{ color: 'var(--text-primary)' }}>
                {row.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Two words worth having before you need them, and the number to call.
          The full list lives on the SOS tab; this is the reminder. */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3.5 pt-3.5"
        style={{ borderTop: '0.5px solid var(--outline)' }}
      >
        <div>
          <p className="text-[11px] font-bold" style={{ color: 'var(--text-tertiary)' }}>Hello</p>
          <p className="text-[13px] font-bold">{facts.hello}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold" style={{ color: 'var(--text-tertiary)' }}>Thank you</p>
          <p className="text-[13px] font-bold">{facts.thanks}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[11px] font-bold" style={{ color: 'var(--text-tertiary)' }}>Emergency</p>
          <p className="text-[13px] font-bold" style={{ color: 'var(--error)' }}>{facts.emergency}</p>
        </div>
      </div>
    </div>
  );
};

export default WhereYouAreCard;
