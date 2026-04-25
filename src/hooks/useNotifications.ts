import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '../services/notificationsService';

interface State {
  items: Notification[];
  unread: number;
  loading: boolean;
}

interface UseNotificationsResult extends State {
  reload: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

// Subscribes to Postgres changes on notifications for the signed-in user,
// so the bell badge + list both update without polling. Falls back to a
// one-shot list on sign-in changes.
export function useNotifications(): UseNotificationsResult {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ items: [], unread: 0, loading: false });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const reload = useCallback(async () => {
    if (!user) {
      setState({ items: [], unread: 0, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const [items, unread] = await Promise.all([
      listNotifications(),
      countUnreadNotifications(),
    ]);
    setState({ items, unread, loading: false });
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          void reload();
        },
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      channel.unsubscribe().catch(() => {});
      channelRef.current = null;
    };
  }, [user, reload]);

  const markRead = useCallback(async (id: string) => {
    setState((s) => ({
      ...s,
      items: s.items.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      unread: Math.max(0, s.unread - 1),
    }));
    const { error } = await markNotificationRead(id);
    if (error) void reload();
  }, [reload]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setState((s) => ({
      ...s,
      items: s.items.map((n) => (n.read_at ? n : { ...n, read_at: now })),
      unread: 0,
    }));
    const { error } = await markAllNotificationsRead();
    if (error) void reload();
  }, [reload]);

  return { ...state, reload, markRead, markAllRead };
}
