import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, Loader2 } from 'lucide-react';
import { impact as hapticImpact } from '../lib/haptics';

interface Props {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  threshold?: number;
  disabled?: boolean;
}

// Native-feeling pull-to-refresh wrapper. Activates only when the nearest
// scrollable ancestor is at the top so normal scroll isn't hijacked. Uses a
// rubber-band curve past the threshold and fires a haptic tap the instant
// the user crosses the "will-refresh" line, so they feel the commitment
// before they release. The indicator lives above the content and rides
// along with a spring return.

const ENGAGE_DISTANCE = 12; // ignore tiny finger jitter — require a real downward pull

const PullToRefresh: React.FC<Props> = ({
  onRefresh,
  children,
  threshold = 90,
  disabled = false,
}) => {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLElement | Window | null>(null);
  const touchStart = useRef<number | null>(null);
  const touchStartedAtTop = useRef(false);
  const disqualified = useRef(false);
  const armed = useRef(false);

  // Find the nearest scrollable ancestor on mount. The page-level scroll
  // container in SwipeNavigator owns the scroll position, not window — so
  // checking window.scrollY would always read 0 and falsely report "at top".
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let node: HTMLElement | null = el.parentElement;
    while (node) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') break;
      node = node.parentElement;
    }
    scrollerRef.current = node ?? window;
  }, []);

  const getScrollTop = (): number => {
    const s = scrollerRef.current;
    if (!s) return 0;
    if (s === window) return window.scrollY || document.documentElement.scrollTop || 0;
    return (s as HTMLElement).scrollTop;
  };

  const isAtTop = () => getScrollTop() <= 0;

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
    // If the scroll container has moved off the top since the gesture
    // started, also bail — the user is scrolling normally, not refreshing.
    if (!isAtTop()) {
      disqualified.current = true;
      setPullY(0);
      armed.current = false;
      return;
    }
    // Require a deliberate downward pull before showing the indicator. Tiny
    // finger jitter at the top (e.g. starting a scroll-down gesture) should
    // not engage PTR.
    if (dy < ENGAGE_DISTANCE) {
      setPullY(0);
      armed.current = false;
      return;
    }
    // Subtract the engage distance so the indicator starts at 0 once we
    // commit, instead of jumping up by ENGAGE_DISTANCE pixels.
    const effective = dy - ENGAGE_DISTANCE;
    // Linear until threshold, then heavy rubber-band so further pulling
    // feels weighted — matches the feel of iOS scroll bounce.
    const eased = effective <= threshold ? effective : threshold + (effective - threshold) * 0.35;
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
      ref={containerRef}
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
