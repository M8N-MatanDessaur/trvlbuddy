import React, { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Radar, Map, MessageCircle, Wrench, Phone, type LucideIcon } from 'lucide-react';
import '../styles/design.css';
import './AppShell.css';

// One shell, three shapes: a bottom bar on a phone, an icon rail on a tablet,
// a labelled rail on a desktop. No phone mockup, no swipe pager, and one set
// of destinations regardless of whether you have a trip -- Nearby is always
// there, and Trip is always its own place to go.

interface Destination {
  to: string;
  label: string;
  icon: LucideIcon;
}

// Order is intent, not alphabet: Nearby first because "what do I do now" is
// the question the app exists to answer. SOS last, always reachable, never in
// the way.
const DESTINATIONS: Destination[] = [
  { to: '/nearby', label: 'Nearby', icon: Radar },
  { to: '/trips', label: 'Trips', icon: Map },
  { to: '/chat', label: 'Ask', icon: MessageCircle },
  { to: '/utilities', label: 'Tools', icon: Wrench },
  { to: '/emergency', label: 'SOS', icon: Phone },
];

const Fallback = () => (
  <div className="tb-feed" aria-busy="true">
    <div className="tb-skel tb-skel--feature" />
    <div className="tb-skel tb-skel--plain" />
    <div className="tb-skel tb-skel--plain" />
  </div>
);

const AppShell: React.FC = () => (
  <div className="shell">
    <nav className="shell-nav" aria-label="Main">
      <span className="shell-brand" aria-hidden="true">trvlbuddy</span>
      {DESTINATIONS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className="shell-tab">
          {({ isActive }) => (
            <>
              <span className="shell-tab-icon" aria-hidden="true">
                <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>

    <main className="shell-main">
      <div className="shell-content">
        <Suspense fallback={<Fallback />}>
          <Outlet />
        </Suspense>
      </div>
    </main>
  </div>
);

export default AppShell;
