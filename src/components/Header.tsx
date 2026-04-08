import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sun, Moon, Settings, RotateCcw, Plane, Share2, X, Send, Download, Upload } from 'lucide-react';
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const currentPage = pages?.find(p => p.path === location.pathname) || pages?.[0];

  const handleShareClick = () => {
    if (!currentPlan) return;
    setShowMenu(false);
    setShowShareModal(true);
  };

  const handleShareConfirm = async () => {
    if (!currentPlan) return;
    setShowShareModal(false);
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
                    onClick={handleShareClick}
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

      {/* Share Trip Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
          <div className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" style={{ background: 'var(--surface-container)' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--outline)', background: 'var(--surface-container-high)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)', color: 'white' }}>
                  <Share2 size={16} />
                </div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Share Trip</h3>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-2 rounded-full transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Your trip will be shared as a <strong style={{ color: 'var(--text-primary)' }}>.trvlbuddy</strong> file containing all your destinations, activities, translations, and emergency contacts.
              </p>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  How the recipient can open it
                </p>

                <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-primary)' }}>
                  <Send size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Share to app</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      If they have TrvlBuddy installed, they can share the file to the app directly from their share menu.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-primary)' }}>
                  <Upload size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Import in app</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      Open TrvlBuddy and tap "Import Shared Trip" on the welcome screen to select the file.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-primary)' }}>
                  <Download size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Save for later</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      The file can be saved and imported anytime.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 pt-0 flex gap-3">
              <button
                onClick={() => setShowShareModal(false)}
                className="flex-1 px-4 py-3 rounded-2xl text-sm font-medium border-2 transition-colors"
                style={{ borderColor: 'var(--outline)', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleShareConfirm}
                className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                <Share2 size={15} />
                Share Now
              </button>
            </div>
          </div>
        </div>
      )}

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
