import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';

interface Props {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  maxHeight?: React.CSSProperties['maxHeight'];
  pxPerSecond?: number;
  pauseMs?: number;
}

/**
 * Vertically clips children and, if the content overflows, slowly animates
 * the inner block up and back down so the whole text is readable without
 * interaction. The animation only runs while the element is actually visible
 * in its scroll parent (IntersectionObserver gate), so off-screen cards stay
 * paused at the top until scrolled into view.
 */
const AutoScrollText: React.FC<Props> = ({
  children,
  className,
  style,
  maxHeight = '2.6em',
  pxPerSecond = 6,
  pauseMs = 2200,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(0);
  const [inView, setInView] = useState(false);
  const controls = useAnimationControls();

  // Measure overflow whenever content or layout changes.
  useEffect(() => {
    const c = containerRef.current;
    const i = innerRef.current;
    if (!c || !i) return;
    const measure = () => {
      const diff = i.scrollHeight - c.clientHeight;
      setOverflow(Math.max(0, diff));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(c);
    ro.observe(i);
    return () => ro.disconnect();
  }, [children]);

  // Only animate cards that are actually in view in their scroll parent.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setInView(entry.isIntersecting && entry.intersectionRatio >= 0.7);
        }
      },
      { threshold: [0, 0.7, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Drive the animation based on overflow + in-view.
  useEffect(() => {
    if (overflow <= 2 || !inView) {
      controls.stop();
      controls.set({ y: 0 });
      return;
    }
    const travelSec = Math.max(7, overflow / pxPerSecond);
    const pauseSec = pauseMs / 1000;
    const total = travelSec * 2 + pauseSec * 2;
    const t1 = travelSec / total;
    const t2 = (travelSec + pauseSec) / total;
    const t3 = (travelSec * 2 + pauseSec) / total;
    controls.start({
      y: [0, -overflow, -overflow, 0, 0],
      transition: {
        duration: total,
        times: [0, t1, t2, t3, 1],
        repeat: Infinity,
        ease: 'linear',
      },
    });
    return () => {
      controls.stop();
    };
  }, [overflow, inView, pxPerSecond, pauseMs, controls]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        maxHeight,
        ...style,
      }}
    >
      <motion.div
        ref={innerRef}
        animate={controls}
        initial={{ y: 0 }}
        transformTemplate={(_, generated) => `${generated} translateZ(0)`}
        style={{
          backfaceVisibility: 'hidden',
          willChange: overflow > 2 && inView ? 'transform' : 'auto',
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default AutoScrollText;
