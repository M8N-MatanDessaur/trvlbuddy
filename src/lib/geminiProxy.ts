import { supabase } from './supabase';

// The one way the client talks to Gemini.
//
// There used to be a VITE_GEMINI_API_KEY here and the browser called Google
// directly. Vite inlines every VITE_ variable into the shipped bundle, so that
// key was public and Gemini keys cannot be locked to a domain: anyone could
// read it off the site and spend the quota. The key now lives only in the
// gemini edge function, which checks the caller is signed in and holds them to
// a per-user quota.
//
// Callers pass a generateContent request body and get Gemini's response JSON
// back unchanged, so the shape at the call sites did not have to change.

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini`;

/** Thrown when the caller is over their AI quota, so callers can say so. */
export class GeminiQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiQuotaError';
  }
}

/** Thrown when nobody is signed in. AI features are for signed-in users. */
export class GeminiAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiAuthError';
  }
}

/**
 * The slice of Gemini's generateContent response the call sites actually read.
 * Everything is optional because a blocked or truncated generation returns a
 * candidate with no parts.
 */
export interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
    groundingMetadata?: unknown;
  }>;
  promptFeedback?: unknown;
  [key: string]: unknown;
}

export async function callGeminiProxy(
  requestBody: unknown,
  options: { signal?: AbortSignal } = {},
): Promise<GeminiResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new GeminiAuthError('Sign in to use the travel assistant');
  }

  const response = await fetch(FUNCTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      // The gateway wants an apikey header alongside the user token.
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify(requestBody),
    signal: options.signal,
  });

  if (response.status === 429) {
    const body = await response.json().catch(() => ({}));
    throw new GeminiQuotaError(body.error || 'You have reached the AI limit for now.');
  }
  if (response.status === 401) {
    throw new GeminiAuthError('Your session expired. Sign in again.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Assistant request failed (${response.status})`);
  }

  return response.json();
}
