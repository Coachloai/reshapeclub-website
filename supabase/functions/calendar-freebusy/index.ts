// ReShape — unified free/busy lookup for Google + iCloud calendars.
//
// POST {
//   from: ISO, to: ISO,
//   calendars: string[]  // mixed identifiers, e.g. ["icloud:Work", "google:primary", "google:abc@group.calendar.google.com"]
// }
// → { success, busy: [{ start, end, calendar, provider }] }
//
// Env required:
//   ICLOUD_USERNAME, ICLOUD_APP_PASSWORD     — for icloud:* identifiers
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
//   GOOGLE_REFRESH_TOKEN                     — for google:* identifiers
//
// The public booking page calls this with each appointment type's conflict_calendars
// and the slot date range, then filters out slots that overlap any returned window.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface BusyWindow { start: string; end: string; calendar: string; provider: 'google' | 'icloud' }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    if (!body.from || !body.to) return json({ success: false, error: 'from and to required' }, 400);
    if (!Array.isArray(body.calendars)) return json({ success: false, error: 'calendars[] required' }, 400);

    const icloudNames: string[] = [];
    const googleIds: string[] = [];
    for (const id of body.calendars) {
      if (typeof id !== 'string') continue;
      if (id.startsWith('icloud:')) icloudNames.push(id.slice('icloud:'.length));
      else if (id.startsWith('google:')) googleIds.push(id.slice('google:'.length));
    }

    const tasks: Promise<BusyWindow[]>[] = [];
    if (googleIds.length > 0) tasks.push(googleFreeBusy(googleIds, body.from, body.to).catch(e => {
      console.warn('google freebusy failed:', e.message); return [];
    }));
    if (icloudNames.length > 0) tasks.push(icloudBusy(icloudNames, body.from, body.to).catch(e => {
      console.warn('icloud busy failed:', e.message); return [];
    }));

    const results = await Promise.all(tasks);
    return json({ success: true, busy: results.flat() });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

// ─── Google ──────────────────────────────────────────────────────────────

async function googleFreeBusy(calendarIds: string[], fromIso: string, toIso: string): Promise<BusyWindow[]> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Google credentials not configured');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('Google token exchange failed: ' + (tokenData.error_description || 'no token'));

  const fbRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + tokenData.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: new Date(fromIso).toISOString(),
      timeMax: new Date(toIso).toISOString(),
      items: calendarIds.map(id => ({ id })),
    }),
  });
  const fb = await fbRes.json();
  if (fb.error) throw new Error('Google freeBusy: ' + (fb.error.message || 'unknown'));

  const out: BusyWindow[] = [];
  for (const calId of Object.keys(fb.calendars || {})) {
    const cal = fb.calendars[calId];
    for (const win of (cal.busy || [])) {
      out.push({ start: win.start, end: win.end, calendar: calId, provider: 'google' });
    }
  }
  return out;
}

// ─── iCloud (delegates to the icloud-calendar function) ──────────────────

async function icloudBusy(calendarNames: string[], fromIso: string, toIso: string): Promise<BusyWindow[]> {
  // Call our own icloud-calendar function so credentials stay in one place.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL env missing');
  const fnUrl = supabaseUrl.replace(/\/$/, '') + '/functions/v1/icloud-calendar';
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'busy', calendarNames, from: fromIso, to: toIso }),
  });
  const data = await res.json();
  if (!data.success) throw new Error('icloud-calendar busy: ' + (data.error || res.status));
  return (data.busy || []).map((w: any) => ({
    start: w.start, end: w.end, calendar: w.calendar, provider: 'icloud' as const,
  }));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
