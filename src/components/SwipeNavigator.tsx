import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import PageIndicator from './PageIndicator';

export interface PageDef {
  path: string;
  component: React.LazyExoticComponent<React.FC>;
  icon: React.FC<any>;
  label: string;
}

interface Props {
  pages: PageDef[];
  /** False when the tabs live somewhere else, as they do in the desktop rail. */
  showBar?: boolean;
}

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="loader" />
  </div>
);

const SwipeNavigator: React.FC<Props> = ({ pages, showBar = true }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isSwipeNav = useRef(false);

  const getIndexFromPath = useCallback((pathname: string) => {
    const idx = pages.findIndex(p => p.path === pathname);
    if (idx >= 0) return idx;
    // An unknown path lands on the set's home: the trip on a trip, and the
    // first tab otherwise. This used to be the literal index 1, which was
    // only ever right because of where each tab happened to sit in the array
    //, reordering the local tabs silently changed where the app fell back to.
    const home = pages.findIndex(p => p.path === '/');
    return home >= 0 ? home : 0;
  }, [pages]);

  const [pageIndex, setPageIndex] = useState(() => getIndexFromPath(location.pathname));
  const [direction, setDirection] = useState(0);

  // Sync URL -> pageIndex
  useEffect(() => {
    if (isSwipeNav.current) {
      isSwipeNav.current = false;
      return;
    }
    const idx = getIndexFromPath(location.pathname);
    if (idx !== pageIndex) {
      setDirection(idx > pageIndex ? 1 : -1);
      setPageIndex(idx);
    }
  }, [location.pathname, getIndexFromPath, pageIndex]);

  const goToPage = useCallback((newIndex: number) => {
    if (newIndex < 0 || newIndex >= pages.length || newIndex === pageIndex) return;
    setDirection(newIndex > pageIndex ? 1 : -1);
    setPageIndex(newIndex);
    isSwipeNav.current = true;
    navigate(pages[newIndex].path, { replace: true });
  }, [pageIndex, pages, navigate]);

  const CurrentPage = pages[pageIndex].component;

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '40%' : '-40%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-20%' : '20%', opacity: 0 }),
  };

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {/* Page content - no drag here, just animated transitions */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={pageIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 400, damping: 35, mass: 0.8 },
              opacity: { duration: 0.15 },
            }}
            className="absolute inset-0 overflow-y-auto"
          >
            <div className="h-full px-5 pb-8 flex flex-col">
              <Suspense fallback={<PageLoader />}>
                <CurrentPage />
              </Suspense>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom bar with swipe - swipe only happens HERE */}
      {showBar && (
        <PageIndicator
          pages={pages}
          currentIndex={pageIndex}
          onPageSelect={goToPage}
        />
      )}
    </div>
  );
};

export default SwipeNavigator;
