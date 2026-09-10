import React from 'react';
import { LocateFixed } from 'lucide-react';

interface Props {
  /** "Montreal, QC", when we know it already. */
  locality?: string | null;
  /** True while we are still asking the device where you are. */
  locating?: boolean;
}

/**
 * The feed before it has anything in it.
 *
 * The pager rendered nothing until the first item arrived, so opening Nearby
 * showed a black screen for as long as the search took and then snapped into
 * a photograph. This is the same page with its contents not filled in yet:
 * the picture, the tag, the name, the two ways out. It says the app is
 * working rather than that something is broken.
 */
const NearbyPageSkeleton: React.FC<Props> = ({ locality, locating = false }) => (
  <div className="relative h-full" aria-busy="true" aria-label="Finding what is around you">
    <div
      className="pager-stage relative h-full overflow-hidden"
      style={{ background: 'var(--surface-container)' }}
    >
      {/* The photograph. A slow drift rather than a blink, because this is
          often on screen for a couple of seconds and a flashing block is a
          worse thing to look at than a calm one. */}
      <div
        className="absolute inset-0 tb-skeleton-drift"
        style={{
          background:
            'linear-gradient(160deg, var(--surface-container-high) 0%, var(--surface-container) 55%, var(--surface-container-high) 100%)',
        }}
        aria-hidden="true"
      />

      {/* The same scrim the real page has, so the shapes below sit in the
          same light. */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: '55%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0))',
        }}
        aria-hidden="true"
      />

      {/* Where you are. Real as soon as it is known, which is usually before
          the places are. */}
      <div className="absolute left-4 top-4 z-10">
        <div
          className="px-4 rounded-full text-[12.5px] font-bold inline-flex items-center gap-1.5"
          style={{
            height: '44px',
            background: 'rgba(22,22,26,0.62)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.22)',
          }}
        >
          <LocateFixed size={13} className={locating ? 'animate-spin' : undefined} />
          <span>{locality || 'Finding you...'}</span>
        </div>
      </div>

      <div className="absolute left-4 right-4 bottom-6 z-10 flex flex-col gap-2.5">
        <div
          className="rounded-full activity-card-shimmer"
          style={{ width: '7.5rem', height: '26px', background: 'rgba(255,255,255,0.22)' }}
        />
        <div
          className="rounded-lg activity-card-shimmer"
          style={{ width: '78%', height: '28px', background: 'rgba(255,255,255,0.28)' }}
        />
        <div
          className="rounded-lg activity-card-shimmer"
          style={{ width: '45%', height: '16px', background: 'rgba(255,255,255,0.18)' }}
        />
        <div className="flex items-center gap-2 mt-1.5">
          <div
            className="rounded-full activity-card-shimmer"
            style={{ width: '5.5rem', height: '40px', background: 'rgba(255,255,255,0.85)' }}
          />
          <div
            className="rounded-full activity-card-shimmer"
            style={{ width: '7rem', height: '40px', background: 'rgba(255,255,255,0.2)' }}
          />
        </div>
      </div>
    </div>
  </div>
);

export default NearbyPageSkeleton;
