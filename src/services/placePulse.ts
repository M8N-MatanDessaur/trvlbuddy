import { supabase } from '../lib/supabase';

/**
 * Signs of life on a place.
 *
 * The social question this app asks is "has anyone been here, and what did
 * they say", not "who is popular". So this is measured per place: how many
 * photographs, how many tips, who put them there and when, and the one tip
 * most worth reading. Nothing here is an author's total, and nothing about a
 * contributor changes what surfaces, a tip from a stranger who stood there
 * yesterday counts exactly as much as one from someone who posts constantly.
 */
export interface Contributor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface PlacePulse {
  activityId: string;
  photos: number;
  tips: number;
  /** Who put something here, most recent first. Capped: this is a signal, not a list. */
  contributors: Contributor[];
  /** The tip most worth reading, by the same helpful-and-recent rule as the place page. */
  topTip: { body: string; helpfulCount: number } | null;
  /** When the most recent contribution landed, for "this week" style phrasing. */
  lastAt: string | null;
}

/** Faces shown before it becomes a crowd rather than a signal. */
const MAX_FACES = 3;
/** A ceiling on how much history one batch pulls back. */
const ROW_CAP = 600;

const HALF_LIFE_DAYS = 90;
function freshness(iso: string): number {
  const ageDays = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return Math.pow(0.5, Math.max(0, ageDays) / HALF_LIFE_DAYS);
}

interface ProfileRef {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * The pulse for a screenful of places, in a handful of queries rather than a
 * handful per place.
 */
export async function pulseForSlugs(slugs: string[]): Promise<Map<string, PlacePulse>> {
  const out = new Map<string, PlacePulse>();
  if (slugs.length === 0) return out;

  const { data: activities } = await supabase
    .from('activities')
    .select('id, slug')
    .in('slug', slugs);
  if (!activities || activities.length === 0) return out;

  const slugById = new Map<string, string>();
  for (const row of activities) slugById.set(row.id, row.slug);
  const ids = [...slugById.keys()];

  const [photosResult, tipsResult] = await Promise.all([
    supabase
      .from('activity_images')
      .select('activity_id, uploaded_by, created_at,'
        + ' poster:profiles!activity_images_uploaded_by_fkey(id, display_name, avatar_url)')
      .in('activity_id', ids)
      .order('created_at', { ascending: false })
      .limit(ROW_CAP),
    supabase
      .from('activity_tips')
      .select('id, activity_id, user_id, body, created_at,'
        + ' author:profiles!activity_tips_user_id_fkey(id, display_name, avatar_url)')
      .in('activity_id', ids)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .limit(ROW_CAP),
  ]);

  type PhotoRow = {
    activity_id: string; uploaded_by: string; created_at: string; poster: ProfileRef | null;
  };
  type TipRow = {
    id: string; activity_id: string; user_id: string; body: string; created_at: string;
    author: ProfileRef | null;
  };
  const photos = (photosResult.data || []) as unknown as PhotoRow[];
  const tips = (tipsResult.data || []) as unknown as TipRow[];

  // Helpful marks, only for the tips actually in hand.
  const helpfulByTip = new Map<string, number>();
  if (tips.length > 0) {
    const { data: marks } = await supabase
      .from('activity_tip_helpful')
      .select('tip_id')
      .in('tip_id', tips.map((t) => t.id));
    for (const m of (marks || []) as Array<{ tip_id: string }>) {
      helpfulByTip.set(m.tip_id, (helpfulByTip.get(m.tip_id) || 0) + 1);
    }
  }

  const start = (activityId: string): PlacePulse => ({
    activityId,
    photos: 0,
    tips: 0,
    contributors: [],
    topTip: null,
    lastAt: null,
  });

  const byId = new Map<string, PlacePulse>();
  for (const id of ids) byId.set(id, start(id));

  // Contributors are gathered newest-first and de-duplicated, so a place three
  // people photographed shows three faces rather than one person's six visits.
  const seenPerPlace = new Map<string, Set<string>>();
  const addContributor = (activityId: string, profile: ProfileRef | null, at: string) => {
    const pulse = byId.get(activityId);
    if (!pulse) return;
    if (!pulse.lastAt || at > pulse.lastAt) pulse.lastAt = at;
    if (!profile) return;
    let seen = seenPerPlace.get(activityId);
    if (!seen) {
      seen = new Set();
      seenPerPlace.set(activityId, seen);
    }
    if (seen.has(profile.id)) return;
    seen.add(profile.id);
    if (pulse.contributors.length < MAX_FACES) {
      pulse.contributors.push({
        id: profile.id,
        name: profile.display_name,
        avatarUrl: profile.avatar_url,
      });
    }
  };

  for (const row of photos) {
    const pulse = byId.get(row.activity_id);
    if (!pulse) continue;
    pulse.photos += 1;
    addContributor(row.activity_id, row.poster, row.created_at);
  }

  const bestScore = new Map<string, number>();
  for (const row of tips) {
    const pulse = byId.get(row.activity_id);
    if (!pulse) continue;
    pulse.tips += 1;
    addContributor(row.activity_id, row.author, row.created_at);

    const helpfulCount = helpfulByTip.get(row.id) || 0;
    const score = (helpfulCount + 1) * freshness(row.created_at);
    if (score > (bestScore.get(row.activity_id) ?? -1)) {
      bestScore.set(row.activity_id, score);
      pulse.topTip = { body: row.body, helpfulCount };
    }
  }

  for (const [id, pulse] of byId) {
    // A place nobody has touched has no pulse, and saying so with zeroes
    // would put "0 photos" on every card in an empty city.
    if (pulse.photos === 0 && pulse.tips === 0) continue;
    const slug = slugById.get(id);
    if (slug) out.set(slug, pulse);
  }
  return out;
}

/** "3 photos, 2 tips", or just the half that exists. */
export function describePulse(pulse: PlacePulse): string {
  const parts: string[] = [];
  if (pulse.photos > 0) parts.push(`${pulse.photos} photo${pulse.photos === 1 ? '' : 's'}`);
  if (pulse.tips > 0) parts.push(`${pulse.tips} tip${pulse.tips === 1 ? '' : 's'}`);
  return parts.join(', ');
}
