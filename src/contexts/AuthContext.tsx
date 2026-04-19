import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from '../lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  markOnboarded: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) void fetchProfile(next.user.id);
      else setProfile(null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle: AuthContextValue['signInWithGoogle'] = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
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
      options: { data: displayName ? { full_name: displayName } : {} },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

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
    signInWithGoogle,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    refreshProfile,
    markOnboarded,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
