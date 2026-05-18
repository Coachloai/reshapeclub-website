// ReShape — iCloud CalDAV bridge
// POST { leadName, leadEmail?, leadPhone?, datetime, durationMinutes?, location?, summary?, description? }
//   datetime: ISO string. durationMinutes defaults to 45 (consultation length).
// Env required:
//   ICLOUD_USERNAME       — Apple ID email (e.g. you@icloud.com)
//   ICLOUD_APP_PASSWORD   — app-specific password from appleid.apple.com
// Env optional:
//   ICLOUD_CALENDAR_NAME  — display name of target calendar; defaults to first calendar that supports VEVENT.
//
// Notes:
//   - iCloud often 301s root requests to a per-user pod (e.g. p01-caldav.icloud.com).
//     Deno's automatic redirect strips the Authorization header on cross-origin hops,
//     so we follow redirects manually and re-send Basic auth.
//   - Discovery is cached per cold start to avoid 3 round-trips per event.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ICLOUD_ROOT = 'https://caldav.icloud.com/';

interface CalendarTarget {
  url: string;          // absolute URL of the calendar collection (ends with /)
  displayName: string;
}

let cachedTarget: CalendarTarget | null = null;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const username = Deno.env.get('ICLOUD_USERNAME');
    const password = Deno.env.get('ICLOUD_APP_PASSWORD');
    if (!username || !password) {
      return json({ success: false, error: 'iCloud credentials not configured' }, 500);
    }

    const body = await req.json();
    if (!body.datetime) return json({ success: false, error: 'datetime required' }, 400);

    const auth = 'Basic ' + btoa(username + ':' + password);
    const target = cachedTarget ?? (cachedTarget = await discoverCalendar(auth, Deno.env.get('ICLOUD_CALENDAR_NAME')));

    const uid = crypto.randomUUID();
    const ics = buildICS({
      uid,
      summary: body.summary || ('Visit: ' + (body.leadName || 'New Lead')),
      description: body.description || buildDescription(body),
      location: formatLocation(body.location),
      start: new Date(body.datetime),
      durationMinutes: body.durationMinutes || 45,
      organizerEmail: username,
    });

    const eventUrl = target.url + uid + '.ics';
    const put = await caldavFetch(eventUrl, {
      method: 'PUT',
      headers: {
        'Authorization': auth,
        'Content-Type': 'text/calendar; charset=utf-8',
        'If-None-Match': '*',
      },
      body: ics,
    });

    if (put.res.status >= 200 && put.res.status < 300) {
      return json({ success: true, id: uid, url: eventUrl, calendar: target.displayName });
    }
    // Bust the cache so the next request rediscovers — calendar URL may have changed.
    cachedTarget = null;
    const text = await put.res.text();
    return json({ success: false, error: 'iCloud PUT ' + put.res.status, detail: text.slice(0, 500) }, 502);
  } catch (e) {
    cachedTarget = null;
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

// ─── CalDAV discovery ────────────────────────────────────────────────────

async function discoverCalendar(auth: string, preferredName?: string | null): Promise<CalendarTarget> {
  // 1. current-user-principal
  const principalRes = await caldavFetch(ICLOUD_ROOT, {
    method: 'PROPFIND',
    headers: { Authorization: auth, Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
    body:
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>',
  });
  const principalXml = await principalRes.res.text();
  const principalPath = extractHref(principalXml, 'current-user-principal');
  if (!principalPath) throw new Error('No current-user-principal in response');
  const principalUrl = resolveUrl(principalRes.finalUrl, principalPath);

  // 2. calendar-home-set
  const homeRes = await caldavFetch(principalUrl, {
    method: 'PROPFIND',
    headers: { Authorization: auth, Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
    body:
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
      '<d:prop><c:calendar-home-set/></d:prop></d:propfind>',
  });
  const homeXml = await homeRes.res.text();
  const homePath = extractHref(homeXml, 'calendar-home-set');
  if (!homePath) throw new Error('No calendar-home-set in response');
  const homeUrl = resolveUrl(homeRes.finalUrl, homePath);

  // 3. list calendars
  const listRes = await caldavFetch(homeUrl, {
    method: 'PROPFIND',
    headers: { Authorization: auth, Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
    body:
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
      '<d:prop><d:displayname/><d:resourcetype/>' +
      '<c:supported-calendar-component-set/></d:prop></d:propfind>',
  });
  const listXml = await listRes.res.text();
  const calendars = parseCalendarList(listXml).filter(c => c.supportsVEvent);
  if (calendars.length === 0) throw new Error('No VEVENT-capable calendars found');

  const chosen = (preferredName
    ? calendars.find(c => c.displayName.toLowerCase() === preferredName.toLowerCase())
    : null) ?? calendars[0];

  return {
    url: resolveUrl(listRes.finalUrl, chosen.href).replace(/\/?$/, '/'),
    displayName: chosen.displayName,
  };
}

interface ParsedCal { href: string; displayName: string; supportsVEvent: boolean; }

function parseCalendarList(xml: string): ParsedCal[] {
  const out: ParsedCal[] = [];
  // Split into <response> blocks — works on both DAV: and d: namespace prefixes.
  const blocks = xml.split(/<[^>]*?:response[\s>]/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/<\/[^>]*?:response>/i)[0];
    const hrefMatch = block.match(/<[^>]*?:href>([^<]+)<\/[^>]*?:href>/i);
    if (!hrefMatch) continue;
    const nameMatch = block.match(/<[^>]*?:displayname>([^<]*)<\/[^>]*?:displayname>/i);
    const isCalendar = /<[^>]*?:calendar\s*\/>/i.test(block);
    if (!isCalendar) continue;
    const compSet = block.match(/<[^>]*?:supported-calendar-component-set[^>]*>([\s\S]*?)<\/[^>]*?:supported-calendar-component-set>/i);
    const supportsVEvent = !compSet || /name="VEVENT"/i.test(compSet[1]);
    out.push({
      href: hrefMatch[1],
      displayName: decodeEntities(nameMatch ? nameMatch[1] : ''),
      supportsVEvent,
    });
  }
  return out;
}

function extractHref(xml: string, propLocalName: string): string | null {
  const re = new RegExp(
    '<[^>]*?:' + propLocalName + '[^>]*>([\\s\\S]*?)<\\/[^>]*?:' + propLocalName + '>',
    'i'
  );
  const m = xml.match(re);
  if (!m) return null;
  const hrefMatch = m[1].match(/<[^>]*?:href>([^<]+)<\/[^>]*?:href>/i);
  return hrefMatch ? hrefMatch[1].trim() : null;
}

function resolveUrl(base: string, ref: string): string {
  return new URL(ref, base).toString();
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// Manual redirect follow so Authorization survives cross-host hops within iCloud's pods.
async function caldavFetch(url: string, init: RequestInit): Promise<{ res: Response; finalUrl: string }> {
  let current = url;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { res, finalUrl: current };
      await res.body?.cancel();
      current = new URL(loc, current).toString();
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new Error('Too many redirects from ' + url);
}

// ─── ICS building ────────────────────────────────────────────────────────

interface ICSInput {
  uid: string;
  summary: string;
  description: string;
  location: string;
  start: Date;
  durationMinutes: number;
  organizerEmail: string;
}

function buildICS(e: ICSInput): string {
  const end = new Date(e.start.getTime() + e.durationMinutes * 60_000);
  const dtstamp = icsDate(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ReShape//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + e.uid + '@reshape.fit',
    'DTSTAMP:' + dtstamp,
    'DTSTART:' + icsDate(e.start),
    'DTEND:' + icsDate(end),
    'SUMMARY:' + escapeText(e.summary),
    'DESCRIPTION:' + escapeText(e.description),
    'LOCATION:' + escapeText(e.location),
    'ORGANIZER:mailto:' + e.organizerEmail,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'TRIGGER:-PT60M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function buildDescription(body: any): string {
  const parts: string[] = [];
  if (body.leadName) parts.push('Lead: ' + body.leadName);
  if (body.leadEmail) parts.push('Email: ' + body.leadEmail);
  if (body.leadPhone) parts.push('Phone: ' + body.leadPhone);
  if (body.location) parts.push('Location: ' + body.location);
  return parts.join('\n');
}

function formatLocation(loc?: string): string {
  if (!loc) return 'ReShape';
  if (loc === 'Ipswich' || loc === 'Colchester') return 'ReShape, ' + loc;
  return loc.startsWith('ReShape') ? loc : 'ReShape, ' + loc;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
