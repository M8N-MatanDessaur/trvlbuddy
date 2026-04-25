import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from '../lib/supabase';
import { getAuthRedirectUrl } from '../lib/authRedirect';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  recoveryMode: boolean;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<{ error: string | null }>;
  updateEmail: (nextEmail: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  markOnboarded: () => Promise<void>;
  exitRecoveryMode: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // True while the user is mid password-recovery flow. The app shell reads
  // this and routes to the reset-password screen instead of the main app,
  // so a magic-link click always ends at "set a new password", not the feed.
  const [recoveryMode, setRecoveryMode] = useState(false);
  const profileFetchRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    profileFetchRef.current = userId;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (profileFetchRef.current !== userId) return;
    if (error) {
      console.error('profile fetch failed', error);
      setProfile(null);
      return;
    }
    setProfile(data);
  };

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setIsLoading(false);
      if (data.session?.user) void fetchProfile(data.session.user.id);
    }).catch((err) => {
      console.error('getSession failed', err);
      if (alive) setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (next?.user) void fetchProfile(next.user.id);
      else setProfile(null);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      else if (event === 'SIGNED_OUT') setRecoveryMode(false);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle: AuthContextValue['signInWithGoogle'] = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthRedirectUrl() },
    });
    return { error: error?.message ?? null };
  };

  const signInWithApple: AuthContextValue['signInWithApple'] = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: getAuthRedirectUrl() },
    });
    return { error: error?.message ?? null };
  };

  const signInWithPassword: AuthContextValue['signInWithPassword'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUpWithPassword: AuthContextValue['signUpWithPassword'] = async (email, password, displayName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: displayName ? { full_name: displayName } : {},
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const signOutEverywhere: AuthContextValue['signOutEverywhere'] = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    return { error: error?.message ?? null };
  };

  const updateEmail: AuthContextValue['updateEmail'] = async (nextEmail) => {
    const { error } = await supabase.auth.updateUser(
      { email: nextEmail },
      { emailRedirectTo: getAuthRedirectUrl() },
    );
    return { error: error?.message ?? null };
  };

  const updatePassword: AuthContextValue['updatePassword'] = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  };

  // Calls the `delete-account` edge function, which authenticates the caller
  // via their own JWT then performs a service-role cascade delete + auth
  // admin delete. On success we sign out locally so the UI drops back to the
  // sign-in screen cleanly.
  const deleteAccount: AuthContextValue['deleteAccount'] = async () => {
    const { error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error) {
      return { error: error.message || 'Could not delete account' };
    }
    await supabase.auth.signOut();
    return { error: null };
  };

  const exitRecoveryMode = () => setRecoveryMode(false);

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user.id);
  };

  const markOnboarded = async () => {
    if (!session?.user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', session.user.id);
    if (!error) await fetchProfile(session.user.id);
  };

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    isLoading,
    recoveryMode,
    signInWithGoogle,
    signInWithApple,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    signOutEverywhere,
    updateEmail,
    updatePassword,
    deleteAccount,
    refreshProfile,
    markOnboarded,
    exitRecoveryMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
