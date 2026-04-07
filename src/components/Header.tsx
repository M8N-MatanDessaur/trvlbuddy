import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sun, Moon, Settings, RotateCcw, Plane, Share2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { exportTrip, shareTrip } from '../utils/tripShare';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { useTravel } from '../contexts/TravelContext';
import ConfirmationModal from './ConfirmationModal';
import type { PageDef } from './SwipeNavigator';

interface Props {
  pages?: PageDef[];
}

const Header: React.FC<Props> = ({ pages }) => {
  const { theme, toggleTheme } = useTheme();
  const { currentPlan, activities, translations, emergencyContacts, savedActivities, setCurrentPlan, setActivities, setTranslations, setEmergencyContacts, setHasCompletedOnboarding } = useTravel();
  const { toast } = useToast();
  const [showResetModal, setShowResetModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const currentPage = pages?.find(p => p.path === location.pathname) || pages?.[0];

  const handleShare = async () => {
    if (!currentPlan) return;
    setShowMenu(false);
    const bundle = exportTrip(currentPlan, activities, translations, emergencyContacts, savedActivities);
    const shared = await shareTrip(bundle);
    if (shared) toast('Trip shared!', 'success');
  };

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
    localStorage.removeItem('savedActivities');
    localStorage.removeItem('theme-manual');
    window.location.href = '/';
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
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5" style={{ height: '3.25rem', background: 'var(--bg-primary)', borderBottom: '0.33px solid var(--outline)' }}>
        {/* Left: page title */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)', color: 'white' }}>
            <Plane size={13} />
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={currentPage?.label || 'app'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="text-sm font-extrabold tracking-tight"
            >
              {currentPage?.label || 'TrvlBuddy'}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-0.5">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Settings"
            >
              <Settings size={16} />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-2xl p-1.5 z-50 animate-[slideUp_0.15s_ease-out]" style={{ background: 'var(--surface-container)', boxShadow: 'var(--shadow-xl)', border: '0.5px solid var(--outline)' }}>
                <button
                  onClick={() => { toggleTheme(); setShowMenu(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 text-sm rounded-xl transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
                  {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                </button>
                {currentPlan && (
                  <button
                    onClick={handleShare}
                    className="w-full flex items-center gap-3 px-3.5 py-3 text-sm rounded-xl transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <Share2 size={15} />
                    Share Trip
                  </button>
                )}
                <button
                  onClick={() => { setShowResetModal(true); setShowMenu(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 text-sm rounded-xl transition-colors"
                  style={{ color: 'var(--error)' }}
                >
                  <RotateCcw size={15} />
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
