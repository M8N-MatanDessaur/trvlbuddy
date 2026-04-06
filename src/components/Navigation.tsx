import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Compass, CalendarDays, Languages } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Trip' },
  { path: '/explore', icon: Compass, label: 'Explore' },
  { path: '/planner', icon: CalendarDays, label: 'Planner' },
  { path: '/language', icon: Languages, label: 'Language' },
];

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="nav-container fixed bottom-0 left-0 right-0 w-full z-50 py-2 px-4 rounded-t-2xl">
      <ul className="flex items-center justify-around max-w-md mx-auto">
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
                className={`nav-link flex flex-col items-center gap-0.5 px-4 py-2 ${isActive ? 'active' : ''}`}
                aria-label={item.label}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default Navigation;
