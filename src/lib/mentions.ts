import { supabase } from './supabase';

// Mention wire format: `@[display_name](user_id)`. The name inside the
// brackets is what we render; the uuid in parens is what we link to and
// what populates the comment_mentions table.

export interface MentionSuggestion {
  id: string;
  display_name: string;
  avatar_url: string | null;
  influence: number;
}

const MENTION_PATTERN = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/gi;

export function extractMentionedUserIds(body: string): string[] {
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  MENTION_PATTERN.lastIndex = 0;
  while ((match = MENTION_PATTERN.exec(body)) !== null) {
    ids.add(match[2]);
  }
  return Array.from(ids);
}

export interface MentionToken {
  kind: 'text' | 'mention';
  value: string;
  userId?: string;
}

// Tokenize a comment body into alternating text / mention spans so the UI
// can render mentions as links without regex-walking at paint time.
export function tokenizeMentions(body: string): MentionToken[] {
  const tokens: MentionToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MENTION_PATTERN.lastIndex = 0;
  while ((match = MENTION_PATTERN.exec(body)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: 'text', value: body.slice(lastIndex, match.index) });
    }
    tokens.push({ kind: 'mention', value: match[1], userId: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) {
    tokens.push({ kind: 'text', value: body.slice(lastIndex) });
  }
  return tokens;
}

export async function searchMentionCandidates(query: string, limit = 5): Promise<MentionSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, influence')
    .ilike('display_name', `${trimmed}%`)
    .order('influence', { ascending: false })
    .limit(limit);
  return (data || []).map((row) => ({
    id: row.id,
    display_name: row.display_name ?? '',
    avatar_url: row.avatar_url ?? null,
    influence: row.influence ?? 0,
  })).filter((row) => row.display_name.length > 0);
}

// Given the current input string + caret position, returns the active
// mention "fragment" if the caret is inside one. Used to drive the
// suggestion popover — when it returns non-null, show the dropdown.
export interface MentionQueryContext {
  query: string;
  start: number;   // index of the '@'
  end: number;     // caret position
}

export function getActiveMentionQuery(value: string, caret: number): MentionQueryContext | null {
  // Scan backwards from caret for a '@' that is at the start of input or
  // preceded by whitespace. A space between '@' and the caret terminates
  // the query (so "hey @foo bar" doesn't keep showing suggestions).
  let i = caret - 1;
  while (i >= 0) {
    const ch = value[i];
    if (ch === '@') {
      const before = i === 0 ? ' ' : value[i - 1];
      if (/\s/.test(before) || i === 0) {
        return { query: value.slice(i + 1, caret), start: i, end: caret };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i -= 1;
  }
  return null;
}
