import React from 'react';
import { Plane } from 'lucide-react';

const AuthSplash: React.FC = () => (
  <div
    className="min-h-screen flex items-center justify-center"
    style={{ background: 'var(--bg-primary)' }}
  >
    <div className="flex flex-col items-center gap-4">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          background: 'var(--accent)',
          color: 'white',
          boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 70%, transparent)',
        }}
      >
        <Plane size={22} />
      </div>
      <div
        className="loader"
        style={{ width: 22, height: 22, borderWidth: 2 }}
        aria-label="Loading"
      />
    </div>
  </div>
);

export default AuthSplash;
