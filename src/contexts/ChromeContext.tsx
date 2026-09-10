import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * What the top-left pill says, and what it offers.
 *
 * The chrome is one component rendered once, so every tab looks the same and
 * nothing drifts. But the pill is not decoration, on Nearby it is where you
 * are, on a trip it is which city you are looking at, on Language it is the
 * language pair. So the pill's contents belong to the screen, and the screen
 * declares them here rather than the chrome trying to guess from the route.
 *
 * A screen that declares nothing gets its tab's name, which is the right
 * default: better a plain label than a pill pretending to do something.
 */
export interface ChromePill {
  label: string;
  icon?: LucideIcon;
  /** Rendered inside a panel under the pill. Omit for a pill that just says. */
  menu?: React.ReactNode;
  /** Used when there is no menu: a pill that does one thing on tap. */
  onPress?: () => void;
  /** Shows a spinner in the pill, for a pill whose action takes a moment. */
  busy?: boolean;
}

interface ChromeValue {
  pill: ChromePill | null;
  setPill: (pill: ChromePill | null) => void;
}

const ChromeContext = createContext<ChromeValue>({ pill: null, setPill: () => {} });

export const ChromeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pill, setPillState] = useState<ChromePill | null>(null);
  const setPill = useCallback((next: ChromePill | null) => setPillState(next), []);
  const value = useMemo(() => ({ pill, setPill }), [pill, setPill]);
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
};

export function useChrome(): ChromeValue {
  return useContext(ChromeContext);
}

/**
 * Declare this screen's pill for as long as the screen is mounted, and clear
 * it on the way out so the next screen never inherits the last one's.
 */
export function useChromePill(pill: ChromePill | null, deps: React.DependencyList): void {
  const { setPill } = useChrome();
  React.useEffect(() => {
    setPill(pill);
    return () => setPill(null);
    // The caller states what the pill depends on: it is rebuilt inline on
    // every render, so depending on the object itself would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default ChromeContext;
