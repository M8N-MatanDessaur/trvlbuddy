import React, { useState } from 'react';
import { Plane, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { getAuthRedirectUrl } from '../lib/authRedirect';

const GoogleGlyph: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const AppleGlyph: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M17.051 12.533c-.026-2.68 2.186-3.963 2.286-4.026-1.245-1.82-3.185-2.068-3.874-2.095-1.651-.166-3.225.968-4.066.968-.841 0-2.134-.942-3.507-.917-1.803.026-3.47 1.046-4.4 2.657-1.874 3.25-.48 8.064 1.348 10.71.893 1.294 1.96 2.746 3.359 2.694 1.348-.053 1.857-.87 3.49-.87 1.628 0 2.095.87 3.525.844 1.453-.027 2.374-1.317 3.263-2.614 1.028-1.499 1.452-2.95 1.478-3.024-.032-.016-2.838-1.088-2.902-4.327zM14.44 4.91c.741-.901 1.242-2.149 1.106-3.391-1.068.044-2.364.711-3.133 1.611-.687.795-1.29 2.073-1.129 3.28 1.196.093 2.414-.606 3.156-1.5z" />
  </svg>
);

const SignInScreen: React.FC = () => {
  const { signInWithGoogle, signInWithApple, signInWithPassword, signUpWithPassword } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onGoogle = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await signInWithGoogle();
    if (err) setError(err);
    setBusy(false);
  };

  const onApple = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await signInWithApple();
    if (err) setError(err);
    setBusy(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = mode === 'signin'
      ? await signInWithPassword(email, password)
      : await signUpWithPassword(email, password, displayName || undefined);
    if (result.error) setError(result.error);
    setBusy(false);
  };

  const onForgotPassword = async () => {
    if (!email) {
      setError('Enter your email first, then tap Forgot password');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl(),
    });
    setBusy(false);
    if (err) setError(err.message);
    else toast('Password reset email sent', 'success');
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
        {/* Soft accent backdrop at top */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-44"
          style={{
            background:
              'radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 65%)',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-44 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(to right, var(--outline) 1px, transparent 1px), linear-gradient(to bottom, var(--outline) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
          }}
          aria-hidden="true"
        />

        <div className="relative px-5 pt-6 pb-5 sm:px-6 sm:pt-9 sm:pb-7">
          {/* Brand badge */}
          <div className="flex justify-center mb-3 sm:mb-5">
            <div
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center"
              style={{
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 70%, transparent)',
              }}
            >
              <Plane className="w-[22px] h-[22px] sm:w-[26px] sm:h-[26px]" />
            </div>
          </div>

          <h1 className="text-center text-[26px] font-extrabold tracking-tight leading-tight">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p
            className="text-center text-[13.5px] mt-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            {mode === 'signin'
              ? 'Please enter your details to sign in.'
              : 'Save trips, share places, earn Influence.'}
          </p>

          {/* Social providers */}
          <div className="grid grid-cols-1 gap-2.5 mt-4 sm:mt-6">
            <button
              type="button"
              onClick={onGoogle}
              disabled={busy}
              className="flex items-center justify-center gap-3 py-3 sm:py-3.5 rounded-2xl transition active:scale-[0.985] disabled:opacity-60"
              style={{
                background: 'var(--surface-container-high)',
                border: '1px solid var(--outline)',
                color: 'var(--text-primary)',
              }}
            >
              <GoogleGlyph size={20} />
              <span className="text-[14px] font-bold">Continue with Google</span>
            </button>
            <button
              type="button"
              onClick={onApple}
              disabled={busy}
              className="flex items-center justify-center gap-3 py-3 sm:py-3.5 rounded-2xl transition active:scale-[0.985] disabled:opacity-60"
              style={{
                background: '#000',
                border: '1px solid #000',
                color: '#fff',
              }}
            >
              <AppleGlyph size={20} />
              <span className="text-[14px] font-bold">Continue with Apple</span>
            </button>
          </div>

          {/* OR divider */}
          <div className="flex items-center gap-3 my-3 sm:my-5">
            <div className="flex-1 h-px" style={{ background: 'var(--outline)' }} />
            <span
              className="text-[10.5px] font-semibold tracking-[0.18em]"
              style={{ color: 'var(--text-tertiary)' }}
            >
              OR
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--outline)' }} />
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:gap-4">
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-[12.5px] font-bold mb-1 sm:mb-1.5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Display Name
                </label>
                <input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How should we call you?"
                  autoComplete="name"
                  className="w-full rounded-2xl px-4 py-2.5 sm:py-3 text-[14px] outline-none transition-colors"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--outline)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-[12.5px] font-bold mb-1 sm:mb-1.5"
                style={{ color: 'var(--text-primary)' }}
              >
                E-Mail Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email..."
                required
                autoComplete="email"
                className="w-full rounded-2xl px-4 py-2.5 sm:py-3 text-[14px] outline-none transition-colors"
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--outline)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[12.5px] font-bold mb-1 sm:mb-1.5"
                style={{ color: 'var(--text-primary)' }}
              >
                Password
              </label>
              <div
                className="relative flex items-center rounded-2xl"
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--outline)',
                }}
              >
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="flex-1 bg-transparent outline-none px-4 py-2.5 sm:py-3 text-[14px]"
                  style={{ color: 'var(--text-primary)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="px-3 py-2 mr-1 rounded-xl"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between -mt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                  Remember me
                </span>
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-[12.5px] font-semibold underline underline-offset-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Forgot password?
                </button>
              )}
            </div>

            {error && (
              <div
                className="rounded-xl px-3.5 py-2.5 text-[12.5px]"
                style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#b91c1c' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 sm:py-3.5 rounded-2xl text-[14.5px] font-bold transition active:scale-[0.985] disabled:opacity-60 mt-1"
              style={{
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
              }}
            >
              {busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p
            className="text-center text-[13px] mt-3 sm:mt-5"
            style={{ color: 'var(--text-secondary)' }}
          >
            {mode === 'signin' ? "Don't have an account yet? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode(mode === 'signin' ? 'signup' : 'signin');
              }}
              className="font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {mode === 'signin' ? 'Sign Up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignInScreen;
