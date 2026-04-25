import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, Loader2 } from 'lucide-react';
import { impact as hapticImpact } from '../lib/haptics';

interface Props {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  threshold?: number;
  disabled?: boolean;
}

// Native-feeling pull-to-refresh wrapper. Activates only when the page is
// already scrolled to the top so normal scroll isn't hijacked. Uses a
// rubber-band curve past the threshold and fires a haptic tap the instant
// the user crosses the "will-refresh" line, so they feel the commitment
// before they release. The indicator lives above the content and rides
// along with a spring return.

const PullToRefresh: React.FC<Props> = ({
  onRefresh,
  children,
  threshold = 90,
  disabled = false,
}) => {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStart = useRef<number | null>(null);
  const touchStartedAtTop = useRef(false);
  const disqualified = useRef(false);
  const armed = useRef(false);

  const isAtTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    touchStart.current = e.touches[0].clientY;
    touchStartedAtTop.current = isAtTop();
    disqualified.current = !touchStartedAtTop.current;
    armed.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart.current === null || refreshing || disabled) return;
    if (disqualified.current) return;
    const dy = e.touches[0].clientY - touchStart.current;
    // Any meaningful upward movement means this isn't a fresh pull — lock
    // PTR out for the rest of this touch so scrolling-up-past-top can't
    // bleed into a refresh gesture.
    if (dy < -4) {
      disqualified.current = true;
      setPullY(0);
      armed.current = false;
      return;
    }
    // If the page has scrolled since the gesture started, also bail.
    if (!isAtTop()) {
      disqualified.current = true;
      setPullY(0);
      armed.current = false;
      return;
    }
    if (dy <= 0) {
      setPullY(0);
      armed.current = false;
      return;
    }
    // Linear until threshold, then heavy rubber-band so further pulling
    // feels weighted — matches the feel of iOS scroll bounce.
    const eased = dy <= threshold ? dy : threshold + (dy - threshold) * 0.35;
    setPullY(eased);
    if (eased >= threshold && !armed.current) {
      armed.current = true;
      hapticImpact();
    } else if (eased < threshold && armed.current) {
      armed.current = false;
    }
  };

  const onTouchEnd = async () => {
    const distance = pullY;
    touchStart.current = null;
    if (!disqualified.current && distance >= threshold && !refreshing && !disabled) {
      setRefreshing(true);
      setPullY(52);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullY(0);
        armed.current = false;
      }
    } else {
      setPullY(0);
      armed.current = false;
    }
    disqualified.current = false;
  };

  const isArmed = pullY >= threshold;
  const progress = Math.min(1, pullY / threshold);
  const rotation = progress * 180;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ position: 'relative', overscrollBehaviorY: 'contain' }}
    >
      <motion.div
        animate={{ y: pullY }}
        transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.6 }}
        style={{ willChange: pullY > 0 || refreshing ? 'transform' : 'auto' }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -52,
            left: 0,
            right: 0,
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            color: isArmed || refreshing ? 'var(--accent)' : 'var(--text-tertiary)',
            opacity: refreshing ? 1 : progress,
            transition: 'color 0.15s, opacity 0.15s',
          }}
        >
          {refreshing ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <ArrowDown
              size={20}
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isArmed ? 'transform 0.18s ease' : 'none',
              }}
            />
          )}
        </div>
        {children}
      </motion.div>
    </div>
  );
};

export default PullToRefresh;
