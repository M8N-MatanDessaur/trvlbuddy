import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { warning as hapticWarning } from '../lib/haptics';

// Settings > Account. Four operations:
//   - change email (Supabase sends a confirm link to both old and new address)
//   - change password (user-initiated, must be signed in)
//   - log out everywhere (revokes every refresh token across devices)
//   - delete account (calls the delete-account edge function)

type Panel = 'menu' | 'email' | 'password' | 'delete';

const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    profile,
    user,
    updateEmail,
    updatePassword,
    signOutEverywhere,
    deleteAccount,
  } = useAuth();

  const [panel, setPanel] = useState<Panel>('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const goBack = () => {
    if (panel !== 'menu') {
      setPanel('menu');
      setError(null);
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate('/settings');
  };

  const onEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setBusy(true);
    setError(null);
    const { error: err } = await updateEmail(newEmail.trim());
    setBusy(false);
    if (err) { setError(err); return; }
    toast('Check both inboxes — confirmation emails sent', 'success');
    setNewEmail('');
    setPanel('menu');
  };

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setBusy(true);
    setError(null);
    const { error: err } = await updatePassword(newPassword);
    setBusy(false);
    if (err) { setError(err); return; }
    toast('Password updated', 'success');
    setNewPassword('');
    setConfirmPassword('');
    setPanel('menu');
  };

  const onLogoutEverywhere = async () => {
    setBusy(true);
    const { error: err } = await signOutEverywhere();
    setBusy(false);
    if (err) { toast(err, 'error'); return; }
    navigate('/', { replace: true });
  };

  const onDelete = async () => {
    if (deleteConfirm !== 'DELETE') { setError('Type DELETE to confirm'); return; }
    hapticWarning();
    setBusy(true);
    setError(null);
    const { error: err } = await deleteAccount();
    setBusy(false);
    if (err) { setError(err); return; }
    navigate('/', { replace: true });
  };

  const rowClass = 'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors';
  const sectionLabel = 'text-[11px] font-bold uppercase tracking-[0.12em] px-1 mb-2';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height: 'calc(3.25rem + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          background: 'var(--bg-primary)',
          borderBottom: '0.33px solid var(--outline)',
        }}
      >
        <button
          onClick={goBack}
          className="flex items-center gap-1 px-2 py-1 -ml-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-primary)' }}
          aria-label="Back"
        >
          <ChevronLeft size={20} />
          <span className="text-[14px] font-semibold">Back</span>
        </button>
        <span className="text-[15px] font-extrabold tracking-tight">Account</span>
        <span className="w-14" aria-hidden="true" />
      </header>

      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: 'calc(4rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
        }}
      >
        <div className="max-w-xl mx-auto px-5 space-y-6">
          {panel === 'menu' && (
            <>
              <section>
                <h2 className={sectionLabel} style={{ color: 'var(--text-tertiary)' }}>Sign-in info</h2>
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-container)' }}>
                  <button
                    onClick={() => { setPanel('email'); setError(null); }}
                    className={rowClass}
                    style={{ borderBottom: '0.33px solid var(--outline)' }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}>
                      <Mail size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold">Change email</div>
                      <div className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>
                        {profile?.email || user?.email || ''}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setPanel('password'); setError(null); }}
                    className={rowClass}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}>
                      <Lock size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold">Change password</div>
                      <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                        Requires being signed in.
                      </div>
                    </div>
                  </button>
                </div>
              </section>

              <section>
                <h2 className={sectionLabel} style={{ color: 'var(--text-tertiary)' }}>Sessions</h2>
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-container)' }}>
                  <button
                    onClick={onLogoutEverywhere}
                    disabled={busy}
                    className={rowClass + ' disabled:opacity-60'}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: 'var(--surface-container-high)', color: 'var(--text-primary)' }}>
                      {busy ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold">Log out everywhere</div>
                      <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                        Revoke every session on every device.
                      </div>
                    </div>
                  </button>
                </div>
              </section>

              <section>
                <h2 className={sectionLabel} style={{ color: '#dc2626' }}>Danger zone</h2>
                <div className="rounded-2xl overflow-hidden"
                     style={{ background: 'var(--surface-container)', border: '1px solid rgba(220,38,38,0.2)' }}>
                  <button
                    onClick={() => { setPanel('delete'); setError(null); }}
                    className={rowClass}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}>
                      <Trash2 size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold" style={{ color: '#dc2626' }}>
                        Delete my account
                      </div>
                      <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                        Permanent and non-reversible.
                      </div>
                    </div>
                  </button>
                </div>
              </section>
            </>
          )}

          {panel === 'email' && (
            <form onSubmit={onEmailSubmit} className="rounded-2xl p-5 space-y-3"
                  style={{ background: 'var(--surface-container)' }}>
              <div>
                <h3 className="text-[16px] font-extrabold tracking-tight">Change email</h3>
                <p className="text-[12.5px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                  We'll send a confirmation link to both your current and your new address.
                  The change only takes effect once you confirm from the new inbox.
                </p>
              </div>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                required
                autoComplete="email"
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
                disabled={busy || !newEmail.trim()}
                className="w-full py-3 rounded-2xl text-[14.5px] font-bold disabled:opacity-60"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                {busy ? 'Sending...' : 'Send confirmation'}
              </button>
            </form>
          )}

          {panel === 'password' && (
            <form onSubmit={onPasswordSubmit} className="rounded-2xl p-5 space-y-3"
                  style={{ background: 'var(--surface-container)' }}>
              <div>
                <h3 className="text-[16px] font-extrabold tracking-tight">Change password</h3>
                <p className="text-[12.5px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Must be at least 8 characters. The change applies immediately.
                </p>
              </div>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-2xl px-4 py-3 text-[14px] outline-none"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--outline)', color: 'var(--text-primary)' }}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                disabled={busy || !newPassword}
                className="w-full py-3 rounded-2xl text-[14.5px] font-bold disabled:opacity-60"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                {busy ? 'Updating...' : 'Update password'}
              </button>
            </form>
          )}

          {panel === 'delete' && (
            <div className="rounded-2xl p-5 space-y-3"
                 style={{ background: 'var(--surface-container)', border: '1px solid rgba(220,38,38,0.25)' }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-[16px] font-extrabold tracking-tight" style={{ color: '#dc2626' }}>
                    Delete my account
                  </h3>
                  <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    This removes your profile, all your photos, likes, comments, saved trips,
                    and influence history. Anything other users liked or commented on that
                    belongs to you will also be removed. Non-reversible.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-[12.5px] font-bold mb-1.5">
                  Type <span style={{ color: '#dc2626' }}>DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full rounded-2xl px-4 py-3 text-[14px] outline-none tracking-widest font-bold"
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--outline)', color: 'var(--text-primary)' }}
                />
              </div>
              {error && (
                <div className="rounded-xl px-3.5 py-2.5 text-[12.5px]"
                     style={{ background: 'rgba(220,38,38,0.1)', color: '#b91c1c' }}>
                  {error}
                </div>
              )}
              <button
                onClick={onDelete}
                disabled={busy || deleteConfirm !== 'DELETE'}
                className="w-full py-3 rounded-2xl text-[14.5px] font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: '#dc2626', color: 'white' }}
              >
                {busy && <Loader2 size={16} className="animate-spin" />}
                {busy ? 'Deleting...' : 'Permanently delete account'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AccountPage;
