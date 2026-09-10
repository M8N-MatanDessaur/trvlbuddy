import { supabase } from '../lib/supabase';

/**
 * What people say about a place.
 *
 * Ordered by what is useful to whoever is standing there now: how many people
 * found it helpful, and how recent it is. Never by anything about the author
 *, there is no author score in this file, and nothing here adds up to one.
 */
export interface Tip {
  id: string;
  activityId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  /** How many people said this helped. */
  helpfulCount: number;
  /** Whether you are one of them. */
  helpfulByMe: boolean;
  /** Answers to this tip, oldest first, a conversation reads forwards. */
  replies: Tip[];
}

interface TipRow {
  id: string;
  activity_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  author: { id: string; display_name: string | null; avatar_url: string | null } | null;
}

/**
 * How long a tip counts as fresh, in days.
 *
 * A tip about the queue at 8pm is worth a lot this month and little next year.
 * Ranking leans on recency so that what rises is what is currently true,
 * rather than whatever has been accumulating marks the longest.
 */
const HALF_LIFE_DAYS = 90;

function score(tip: { helpfulCount: number; createdAt: string }): number {
  const ageDays = (Date.now() - new Date(tip.createdAt).getTime()) / 86_400_000;
  const freshness = Math.pow(0.5, Math.max(0, ageDays) / HALF_LIFE_DAYS);
  // +1 so a brand new tip with no marks still outranks a stale one with none.
  return (tip.helpfulCount + 1) * freshness;
}

export async function listTips(activityId: string, viewerId?: string | null): Promise<Tip[]> {
  const { data, error } = await supabase
    .from('activity_tips')
    .select(
      'id, activity_id, user_id, parent_id, body, created_at, edited_at,' +
        ' author:profiles!activity_tips_user_id_fkey(id, display_name, avatar_url)',
    )
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  const rows = data as unknown as TipRow[];
  if (rows.length === 0) return [];

  // Counts in one query rather than one per tip.
  const ids = rows.map((r) => r.id);
  const { data: marks } = await supabase
    .from('activity_tip_helpful')
    .select('tip_id, user_id')
    .in('tip_id', ids);

  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const m of (marks || []) as Array<{ tip_id: string; user_id: string }>) {
    counts.set(m.tip_id, (counts.get(m.tip_id) || 0) + 1);
    if (viewerId && m.user_id === viewerId) mine.add(m.tip_id);
  }

  const build = (row: TipRow): Tip => ({
    id: row.id,
    activityId: row.activity_id,
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    author: row.author
      ? {
          id: row.author.id,
          displayName: row.author.display_name,
          avatarUrl: row.author.avatar_url,
        }
      : null,
    helpfulCount: counts.get(row.id) || 0,
    helpfulByMe: mine.has(row.id),
    replies: [],
  });

  const tips = new Map<string, Tip>();
  for (const row of rows) if (!row.parent_id) tips.set(row.id, build(row));
  for (const row of rows) {
    if (!row.parent_id) continue;
    tips.get(row.parent_id)?.replies.push(build(row));
  }

  return [...tips.values()].sort((a, b) => score(b) - score(a));
}

export async function addTip(params: {
  activityId: string;
  userId: string;
  body: string;
  /** Set when answering an existing tip. */
  parentId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const body = params.body.trim();
  if (!body) return { ok: false, error: 'Write something first.' };
  if (body.length > 600) return { ok: false, error: 'Tips are 600 characters or less.' };

  const { error } = await supabase.from('activity_tips').insert({
    activity_id: params.activityId,
    user_id: params.userId,
    body,
    parent_id: params.parentId ?? null,
  });
  if (error) return { ok: false, error: 'Could not post that. Try again.' };
  return { ok: true };
}

export async function editTip(params: {
  tipId: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const body = params.body.trim();
  if (!body) return { ok: false, error: 'Write something first.' };
  const { error } = await supabase
    .from('activity_tips')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', params.tipId);
  if (error) return { ok: false, error: 'Could not save that.' };
  return { ok: true };
}

export async function deleteTip(tipId: string): Promise<boolean> {
  const { error } = await supabase.from('activity_tips').delete().eq('id', tipId);
  return !error;
}

/** Mark a tip helpful, or take the mark back. */
export async function setHelpful(params: {
  tipId: string;
  userId: string;
  helpful: boolean;
}): Promise<boolean> {
  if (params.helpful) {
    const { error } = await supabase
      .from('activity_tip_helpful')
      .insert({ tip_id: params.tipId, user_id: params.userId });
    // Already marked is the state the caller wanted, not a failure.
    return !error || error.code === '23505';
  }
  const { error } = await supabase
    .from('activity_tip_helpful')
    .delete()
    .eq('tip_id', params.tipId)
    .eq('user_id', params.userId);
  return !error;
}

/**
 * How many tips each of these places has, for the feed.
 *
 * A place with something said about it should look different from one with
 * nothing, and that has to be answerable for a whole screenful at once.
 */
export async function countTipsByActivity(activityIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (activityIds.length === 0) return out;
  const { data } = await supabase
    .from('activity_tips')
    .select('activity_id')
    .in('activity_id', activityIds)
    .is('parent_id', null);
  for (const row of (data || []) as Array<{ activity_id: string }>) {
    out.set(row.activity_id, (out.get(row.activity_id) || 0) + 1);
  }
  return out;
}
