import React, { useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import type { PageDef } from './SwipeNavigator';

interface Props {
  pages: PageDef[];
  currentIndex: number;
  onPageSelect: (index: number) => void;
}

const SWIPE_THRESHOLD = 40;
const VELOCITY_THRESHOLD = 200;
// Movement under this is a press, not a swipe.
const TAP_SLOP = 8;

const PageIndicator: React.FC<Props> = ({ pages, currentIndex, onPageSelect }) => {
  // Whether the last gesture actually moved. framer-motion fires onDragEnd
  // for a press that shifts a pixel, and the buttons live inside the draggable
  // element, so a tap became a drag, the drag changed page, and the button's
  // own click was swallowed. Tracking real movement lets a tap be a tap.
  const dragged = useRef(false);

  const handleDragStart = () => { dragged.current = false; };

  const handleDrag = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > TAP_SLOP) dragged.current = true;
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    // A gesture that never travelled is a tap on whichever tab was pressed,
    // and that button's onClick has already handled it.
    if (Math.abs(offset.x) <= TAP_SLOP && Math.abs(velocity.x) < VELOCITY_THRESHOLD) return;
    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
      onPageSelect(currentIndex + 1);
    } else if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
      onPageSelect(currentIndex - 1);
    }
  };

  return (
    <motion.div
      className="flex items-center justify-center gap-0.5 py-3 px-2 select-none"
      style={{
        // No rule above the bar: the feed runs full-bleed to the bottom and a
        // hairline there cuts the screen in two.
        borderTop: 'none',
        background: 'var(--bg-primary)',
        touchAction: 'pan-y',
        cursor: 'grab',
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.1}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
    >
      {pages.map((page, i) => {
        const isActive = i === currentIndex;
        const Icon = page.icon;

        return (
          <button
            key={page.path}
            type="button"
            onClick={() => onPageSelect(i)}
            aria-label={page.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              // Was `display: contents`, which gives a button no box at all --
              // no hit area of its own, and a known source of broken
              // accessibility. It is a real flex item now, sized by its
              // content so the pill looks identical.
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 0,
              padding: 0,
              // Comfortable to hit without changing how the bar looks.
              minHeight: '44px',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div
              className="flex items-center justify-center gap-1.5 transition-all"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                padding: isActive ? '6px 14px' : '6px 4px',
                background: isActive ? 'var(--accent-container)' : 'transparent',
                borderRadius: '20px',
                // 32px was under the comfortable minimum for a thumb.
                minHeight: '40px',
                cursor: 'pointer',
              }}
            >
              <Icon size={isActive ? 16 : 14} strokeWidth={isActive ? 2.2 : 1.6} />
              <AnimatePresence mode="wait">
                {isActive && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-[11px] font-bold overflow-hidden whitespace-nowrap"
                  >
                    {page.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </button>
        );
      })}
    </motion.div>
  );
};

export default PageIndicator;
