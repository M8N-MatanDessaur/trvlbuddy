import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="mt-16 py-8 border-t border-outline bg-surface-container">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <div className="flex flex-col items-center gap-4">
          {/* App Info */}
          <div className="text-sm text-text-secondary">
            <p className="mb-2">TravelBuddy - Your AI-Powered Travel Companion</p>
            <p>&copy; 2024 TravelBuddy. Made with ❤️ for travelers worldwide.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;