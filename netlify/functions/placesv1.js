// Proxy for Google Places API (New). The legacy redirect rule in
// netlify.toml ("/api/placesv1/* -> https://places.googleapis.com/v1/:splat")
// fails because the URL the client calls contains a literal ":" (e.g.
// "places:searchNearby"), which Netlify's redirect engine treats as a
// :param marker -- the rewrite never matches and the request 404s.
//
// This function takes the path after /api/placesv1/ (a method name like
// "searchNearby" or "searchText") and forwards the POST + headers + body to
// "https://places.googleapis.com/v1/places:<method>".

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // The function is invoked through the redirect /api/placesv1/* ->
  // /.netlify/functions/placesv1/:splat. event.path is the original request
  // path; the last segment is the method name we need.
  const path = event.path || '';
  const segments = path.split('/').filter(Boolean);
  const method = segments[segments.length - 1] || '';

  // Allow either bare method names ("searchNearby") or the full "places:method"
  // form so existing client code keeps working without changes.
  const cleanMethod = method.startsWith('places:') ? method.slice('places:'.length) : method;

  if (!cleanMethod || !/^[A-Za-z]+$/.test(cleanMethod)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing or invalid method', path }),
    };
  }

  const googleUrl = `https://places.googleapis.com/v1/places:${cleanMethod}`;

  // Forward only the headers Google needs (API key + field mask + content-type).
  const forwardedHeaders = { 'Content-Type': 'application/json' };
  for (const [k, v] of Object.entries(event.headers || {})) {
    const lower = k.toLowerCase();
    if (lower.startsWith('x-goog-')) forwardedHeaders[k] = String(v);
  }

  try {
    const upstream = await fetch(googleUrl, {
      method: 'POST',
      headers: forwardedHeaders,
      body: event.body || '',
    });
    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: 'Upstream proxy failed',
        detail: err && err.message ? err.message : String(err),
      }),
    };
  }
};
