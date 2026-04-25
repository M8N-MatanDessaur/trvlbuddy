import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

// Rendered when Supabase fires PASSWORD_RECOVERY — the user clicked a reset
// link and is signed in with a recovery-scoped session. Forcing them through
// this screen before any main-app routes prevents a half-finished recovery
// from leaving them logged in without changing their password.

const PasswordResetPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { updatePassword, exitRecoveryMode, signOut } = useAuth();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (pw !== confirm) { setError('Passwords do not match'); return; }
    setBusy(true);
    setError(null);
    const { error: err } = await updatePassword(pw);
    setBusy(false);
    if (err) { setError(err); return; }
    exitRecoveryMode();
    toast('Password updated — welcome back', 'success');
    navigate('/', { replace: true });
  };

  const onCancel = async () => {
    exitRecoveryMode();
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div
      className="auth-screen w-full flex items-center justify-center overflow-hidden px-4 py-3 sm:px-5 sm:py-6"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden"
        style={{
          background: 'var(--surface-container)',
          borderRadius: '28px',
          boxShadow: '0 30px 60px -20px rgba(0,0,0,0.15), 0 10px 30px -10px rgba(0,0,0,0.1)',
          border: '1px solid var(--outline)',
        }}
      >
        <div className="relative px-5 pt-6 pb-5 sm:px-6 sm:pt-9 sm:pb-7">
          <div className="flex justify-center mb-3 sm:mb-5">
            <div
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              <Lock className="w-[22px] h-[22px] sm:w-[26px] sm:h-[26px]" />
            </div>
          </div>

          <h1 className="text-center text-[22px] font-extrabold tracking-tight leading-tight">
            Set a new password
          </h1>
          <p className="text-center text-[13px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>
            You're signed in via a recovery link. Pick a new password to continue.
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-3 mt-5">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="New password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-2xl px-4 py-3 text-[14px] outline-none"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--outline)', color: 'var(--text-primary)' }}
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-2xl px-4 py-3 text-[14px] outline-none"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--outline)', color: 'var(--text-primary)' }}
            />
            {error && (
              <div className="rounded-xl px-3.5 py-2.5 text-[12.5px]"
                   style={{ background: 'rgba(220,38,38,0.1)', color: '#b91c1c' }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-2xl text-[14.5px] font-bold disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? 'Updating...' : 'Update password'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 rounded-2xl text-[13px] font-semibold"
              style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none' }}
            >
              Cancel and sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PasswordResetPage;
