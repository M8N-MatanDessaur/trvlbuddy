import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Settings, RotateCcw, Plane } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useTravel } from '../contexts/TravelContext';
import ConfirmationModal from './ConfirmationModal';

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { setCurrentPlan, setActivities, setTranslations, setEmergencyContacts, setHasCompletedOnboarding } = useTravel();
  const [showResetModal, setShowResetModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleReset = () => {
    setCurrentPlan(null);
    setActivities([]);
    setTranslations([]);
    setEmergencyContacts([]);
    setHasCompletedOnboarding(false);
    localStorage.removeItem('currentTravelPlan');
    localStorage.removeItem('generatedActivities');
    localStorage.removeItem('generatedTranslations');
    localStorage.removeItem('emergencyContacts');
    localStorage.removeItem('hasCompletedOnboarding');
    window.location.reload();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between px-4 glass-card rounded-none border-t-0 border-x-0">
        <div className="flex items-center gap-2">
          <Plane size={18} className="text-[var(--accent)]" />
          <span className="text-sm font-bold tracking-tight text-text-primary">TrvlBuddy</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-container-high transition-all"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-container-high transition-all"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 glass-card p-1 z-50 animate-[slideUp_0.15s_ease-out]">
                <button
                  onClick={() => { setShowResetModal(true); setShowMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[var(--error)] hover:bg-[var(--error-container)] rounded-lg transition-colors"
                >
                  <RotateCcw size={16} />
                  Reset Trip Data
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <ConfirmationModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleReset}
        title="Reset Travel Guide"
        message="Are you sure you want to reset the app? This will permanently delete all your travel data, activities, and preferences. You'll need to complete the setup process again."
        confirmText="Reset App"
        cancelText="Keep Data"
        type="danger"
      />
    </>
  );
};

export default Header;
