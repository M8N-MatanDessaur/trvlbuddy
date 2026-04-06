import React, { useState } from 'react';
import { Sun, Moon, RotateCcw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useTravel } from '../contexts/TravelContext';
import ConfirmationModal from './ConfirmationModal';

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { setCurrentPlan, setActivities, setTranslations, setEmergencyContacts, setHasCompletedOnboarding } = useTravel();
  const [showResetModal, setShowResetModal] = useState(false);

  const handleReset = () => {
    // Clear all data
    setCurrentPlan(null);
    setActivities([]);
    setTranslations([]);
    setEmergencyContacts([]);
    setHasCompletedOnboarding(false);
    
    // Clear localStorage
    localStorage.removeItem('currentTravelPlan');
    localStorage.removeItem('generatedActivities');
    localStorage.removeItem('generatedTranslations');
    localStorage.removeItem('emergencyContacts');
    localStorage.removeItem('hasCompletedOnboarding');
    
    // Reload the page to ensure clean state
    window.location.reload();
  };

  // Choose the correct Bolt badge image based on theme
  const getBoltBadgeImage = () => {
    return theme === 'light' 
      ? 'https://cdn.sanity.io/images/e4zkjk7p/production/95682d92f81e981e0e9a03c6da4b0f0888e38af1-360x360.png'
      : 'https://cdn.sanity.io/images/e4zkjk7p/production/fbd4b7ef8cbb981ddce873727615dc5bb7cc2b12-360x360.png';
  };

  // Coffee SVG component
  const CoffeeIcon = () => (
    <svg 
      width="20" 
      height="20" 
      viewBox="0 0 24 24" 
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7"
      fill="currentColor"
    >
      <path d="M7 22h10a1 1 0 0 0 .99-.858L19.867 8H21V6h-1.382l-1.724-3.447A.998.998 0 0 0 17 2H7c-.379 0-.725.214-.895.553L4.382 6H3v2h1.133L6.01 21.142A1 1 0 0 0 7 22Zm10.418-11H6.582l-.429-3h11.693l-.428 3Zm-9.551 9-.429-3h9.123l-.429 3H7.867ZM7.618 4h8.764l1 2H6.618l1-2Z"></path>
    </svg>
  );

  return (
    <>
      <header className="relative">
        {/* Theme toggle: fixed top left */}
        <button
          onClick={toggleTheme}
          className="fixed top-4 left-4 z-50 w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center bg-surface-container border border-outline text-text-primary hover:bg-surface-container-high transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 shadow-lg"
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <Moon className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7" />
          ) : (
            <Sun className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7" />
          )}
        </button>

        {/* Buy Me a Coffee button: fixed top left, next to theme toggle */}
        <a
          href="https://coff.ee/matandessaur"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed top-4 left-20 md:left-20 lg:left-24 z-50 w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center bg-surface-container border border-outline text-text-primary hover:bg-surface-container-high transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 shadow-lg hover:scale-110"
          title="Buy me a coffee"
          aria-label="Buy me a coffee"
        >
          <CoffeeIcon />
        </a>

        {/* Built with Bolt badge: fixed top right, just before reset button */}
        <a
          href="https://bolt.new"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed top-4 right-20 md:right-20 lg:right-24 z-50 hover:scale-110 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          title="Built with Bolt"
          aria-label="Built with Bolt"
        >
          <img
            src={getBoltBadgeImage()}
            alt="Built with Bolt"
            className="w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 object-contain hover:scale-110 transition-transform rounded-full"
            onError={(e) => {
              console.error('Failed to load badge image:', getBoltBadgeImage());
              // Fallback to a simple text badge if image fails
              e.currentTarget.style.display = 'none';
              const fallback = document.createElement('div');
              fallback.className = 'w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 bg-primary text-on-primary rounded-full flex items-center justify-center text-xs md:text-sm lg:text-base font-bold';
              fallback.textContent = 'B';
              e.currentTarget.parentNode?.appendChild(fallback);
            }}
          />
        </a>

        {/* Reset button: fixed top right - SAME STYLE AS THEME TOGGLE */}
        <button
          onClick={() => setShowResetModal(true)}
          className="fixed top-4 right-4 z-50 w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center bg-surface-container border border-outline text-text-primary hover:bg-surface-container-high transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 shadow-lg"
          title="Reset app and start over"
          aria-label="Reset app and start over"
        >
          <RotateCcw className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7" />
        </button>
      </header>

      {/* Reset Confirmation Modal */}
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