import React from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import type { PageDef } from './SwipeNavigator';

interface Props {
  pages: PageDef[];
  currentIndex: number;
  onPageSelect: (index: number) => void;
}

const SWIPE_THRESHOLD = 40;
const VELOCITY_THRESHOLD = 200;

const PageIndicator: React.FC<Props> = ({ pages, currentIndex, onPageSelect }) => {

  const handleDragEnd = (_: any, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
      onPageSelect(currentIndex + 1);
    } else if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
      onPageSelect(currentIndex - 1);
    }
  };

  return (
    <motion.div
      className="flex items-center justify-center gap-2 py-3 px-4 select-none"
      style={{
        borderTop: '0.33px solid var(--outline)',
        background: 'var(--bg-primary)',
        touchAction: 'pan-y',
        cursor: 'grab',
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
    >
      {pages.map((page, i) => {
        const isActive = i === currentIndex;
        const Icon = page.icon;

        return (
          <button
            key={page.path}
            onClick={() => onPageSelect(i)}
            className="flex items-center justify-center gap-1.5 transition-all"
            style={{
              color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
              padding: isActive ? '6px 14px' : '6px',
              background: isActive ? 'var(--accent-container)' : 'transparent',
              borderRadius: '20px',
              minHeight: '32px',
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
          </button>
        );
      })}
    </motion.div>
  );
};

export default PageIndicator;
