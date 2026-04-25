import { supabase } from '../lib/supabase';

export type NotificationType =
  | 'image_liked'
  | 'image_commented'
  | 'comment_replied'
  | 'influence_milestone';

export interface NotificationActor {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  subject_type: string | null;
  subject_id: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  actor: NotificationActor | null;
}

const PAGE_SIZE = 30;

export async function listNotifications(limit = PAGE_SIZE): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) return [];

  const actorIds = Array.from(
    new Set((data as Notification[]).map((n) => n.actor_id).filter(Boolean)),
  ) as string[];

  let actors = new Map<string, NotificationActor>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', actorIds);
    (profiles || []).forEach((row) => {
      actors.set(row.id, row);
    });
  }

  return (data as Notification[]).map((row) => ({
    ...row,
    actor: row.actor_id ? actors.get(row.actor_id) ?? null : null,
  }));
}

export async function countUnreadNotifications(): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  return { error: error?.message ?? null };
}

export async function markAllNotificationsRead(): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  return { error: error?.message ?? null };
}
