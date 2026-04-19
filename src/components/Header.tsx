import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plane } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';
import type { PageDef } from './SwipeNavigator';

interface Props {
  pages?: PageDef[];
}

const Header: React.FC<Props> = ({ pages }) => {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const currentPage = pages?.find(p => p.path === location.pathname) || pages?.[0];

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5"
      style={{
        height: '3.25rem',
        background: 'var(--bg-primary)',
        borderBottom: '0.33px solid var(--outline)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
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

      <button
        onClick={() => navigate('/profile')}
        className="flex items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          padding: 0,
          border: '1.5px solid var(--outline)',
          background: 'transparent',
        }}
        aria-label="Open profile"
      >
        <Avatar profile={profile} size={30} />
      </button>
    </header>
  );
};

export default Header;
