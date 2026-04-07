import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Compass, Languages, Wrench } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Trip' },
  { path: '/explore', icon: Compass, label: 'Explore' },
  { path: '/language', icon: Languages, label: 'Language' },
  { path: '/utilities', icon: Wrench, label: 'Tools' },
];

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="nav-container fixed bottom-0 left-0 right-0 w-full z-50 py-2 px-4">
      <ul className="flex items-center justify-around max-w-sm mx-auto">
        {navItems.map(item => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <li key={item.path}>
              <button
                onClick={() => {
                  navigate(item.path);
                  window.scrollTo({ top: 0, behavior: 'instant' });
                }}
                className="flex flex-col items-center gap-1 px-3 py-1.5 transition-colors"
                style={{ color: isActive ? 'var(--accent)' : 'var(--text-tertiary)' }}
                aria-label={item.label}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
                  style={{ background: isActive ? 'var(--accent-container)' : 'transparent' }}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.2 : 1.6} />
                </div>
                <span className="text-[10px] font-semibold leading-none">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default Navigation;
