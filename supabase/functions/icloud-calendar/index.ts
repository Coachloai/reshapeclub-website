// ReShape — iCloud CalDAV bridge.
//
// Actions:
//   default (or action="create"): write a VEVENT to a calendar.
//     POST { leadName, leadEmail?, leadPhone?, datetime, durationMinutes?, location?, summary?, description?, calendarName? }
//   action="list": enumerate calendars.
//     POST { action: "list" } → { success, calendars: [{ name, href }] }
//   action="busy": busy time windows across one or more calendars.
//     POST { action: "busy", calendarNames?: string[], from: ISO, to: ISO }
//          omit calendarNames to query every VEVENT-capable calendar
//     → { success, busy: [{ calendar, start, end, summary? }] }
//
// Env required:
//   ICLOUD_USERNAME       — Apple ID email
//   ICLOUD_APP_PASSWORD   — app-specific password from appleid.apple.com
// Env optional:
//   ICLOUD_CALENDAR_NAME  — default calendar for create when calendarName isn't supplied
//
// Notes:
//   - iCloud often 301s root requests to a per-user pod (e.g. p01-caldav.icloud.com).
//     Deno's automatic redirect strips the Authorization header on cross-origin hops,
//     so we follow redirects manually and re-send Basic auth.
//   - Discovery (principal → home → calendars) is cached per cold start; busted on failure.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ICLOUD_ROOT = 'https://caldav.icloud.com/';

interface CalendarInfo {
  href: string;        // absolute URL, ends with /
  displayName: string;
  supportsVEvent: boolean;
}

let cachedCalendars: CalendarInfo[] | null = null;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const username = Deno.env.get('ICLOUD_USERNAME');
    const password = Deno.env.get('ICLOUD_APP_PASSWORD');
    if (!username || !password) {
      return json({ success: false, error: 'iCloud credentials not configured' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const auth = 'Basic ' + btoa(username + ':' + password);
    const action = body.action || 'create';

    if (action === 'list') {
      const cals = await getCalendars(auth);
      return json({
        success: true,
        calendars: cals.filter(c => c.supportsVEvent).map(c => ({ name: c.displayName, href: c.href })),
      });
    }

    if (action === 'busy') {
      if (!body.from || !body.to) return json({ success: false, error: 'from and to (ISO) required' }, 400);
      const cals = (await getCalendars(auth)).filter(c => c.supportsVEvent);
      const wanted = body.calendarNames && Array.isArray(body.calendarNames) && body.calendarNames.length > 0
        ? cals.filter(c => body.calendarNames.map((n: string) => n.toLowerCase()).includes(c.displayName.toLowerCase()))
        : cals;
      if (wanted.length === 0) return json({ success: true, busy: [] });
      const busy = await collectBusy(auth, wanted, body.from, body.to);
      return json({ success: true, busy });
    }

    // default = create event
    if (!body.datetime) return json({ success: false, error: 'datetime required' }, 400);
    const cals = (await getCalendars(auth)).filter(c => c.supportsVEvent);
    if (cals.length === 0) throw new Error('No VEVENT-capable calendars found');
    const preferredName = body.calendarName || Deno.env.get('ICLOUD_CALENDAR_NAME') || null;
    const target = (preferredName
      ? cals.find(c => c.displayName.toLowerCase() === preferredName.toLowerCase())
      : null) ?? cals[0];

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

    const eventUrl = target.href + uid + '.ics';
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
    cachedCalendars = null;
    const text = await put.res.text();
    return json({ success: false, error: 'iCloud PUT ' + put.res.status, detail: text.slice(0, 500) }, 502);
  } catch (e) {
    cachedCalendars = null;
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

// ─── CalDAV discovery ────────────────────────────────────────────────────

async function getCalendars(auth: string): Promise<CalendarInfo[]> {
  if (cachedCalendars) return cachedCalendars;
  cachedCalendars = await discoverCalendars(auth);
  return cachedCalendars;
}

async function discoverCalendars(auth: string): Promise<CalendarInfo[]> {
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

  // 3. list calendars under the home set
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
  const raw = parseCalendarList(listXml);
  return raw.map(c => ({
    href: resolveUrl(listRes.finalUrl, c.href).replace(/\/?$/, '/'),
    displayName: c.displayName,
    supportsVEvent: c.supportsVEvent,
  }));
}

// ─── Busy time fetch (CalDAV calendar-query REPORT) ──────────────────────

interface BusyWindow { calendar: string; start: string; end: string; summary?: string }

async function collectBusy(
  auth: string,
  calendars: CalendarInfo[],
  fromIso: string,
  toIso: string,
): Promise<BusyWindow[]> {
  const from = formatUtc(new Date(fromIso));
  const to = formatUtc(new Date(toIso));
  const body =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
    '<d:prop><d:getetag/><c:calendar-data><c:expand start="' + from + '" end="' + to + '"/></c:calendar-data></d:prop>' +
    '<c:filter><c:comp-filter name="VCALENDAR">' +
    '<c:comp-filter name="VEVENT">' +
    '<c:time-range start="' + from + '" end="' + to + '"/>' +
    '</c:comp-filter></c:comp-filter></c:filter>' +
    '</c:calendar-query>';

  const out: BusyWindow[] = [];
  await Promise.all(calendars.map(async (cal) => {
    try {
      const res = await caldavFetch(cal.href, {
        method: 'REPORT',
        headers: { Authorization: auth, Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
        body,
      });
      const xml = await res.res.text();
      const events = extractCalendarData(xml);
      for (const ical of events) {
        for (const ev of parseVEvents(ical)) {
          if (ev.transp === 'TRANSPARENT') continue; // ignore "free" events
          out.push({ calendar: cal.displayName, start: ev.start, end: ev.end, summary: ev.summary });
        }
      }
    } catch (e) {
      console.warn('busy fetch failed for', cal.displayName, (e as Error).message);
    }
  }));
  return out;
}

function extractCalendarData(xml: string): string[] {
  const out: string[] = [];
  const re = /<[^>]*?:calendar-data[^>]*>([\s\S]*?)<\/[^>]*?:calendar-data>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) out.push(decodeEntities(m[1]).trim());
  return out;
}

interface VEvent { start: string; end: string; summary?: string; transp?: string }

function parseVEvents(ical: string): VEvent[] {
  // Unfold continuation lines (CRLF + space).
  const text = ical.replace(/\r?\n[ \t]/g, '');
  const events: VEvent[] = [];
  const lines = text.split(/\r?\n/);
  let cur: Partial<VEvent> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur && cur.start && cur.end) events.push(cur as VEvent);
      cur = null;
    } else if (cur) {
      const m = line.match(/^([A-Z\-]+)(?:;[^:]+)?:(.*)$/);
      if (!m) continue;
      const [, name, value] = m;
      if (name === 'DTSTART') cur.start = parseIcsDate(line);
      else if (name === 'DTEND') cur.end = parseIcsDate(line);
      else if (name === 'SUMMARY') cur.summary = value;
      else if (name === 'TRANSP') cur.transp = value;
    }
  }
  return events;
}

// Returns an ISO 8601 UTC string from a DTSTART/DTEND line (handles UTC, floating, and date-only).
function parseIcsDate(line: string): string {
  const m = line.match(/^(?:DTSTART|DTEND)(;[^:]+)?:(.+)$/);
  if (!m) return '';
  const params = m[1] || '';
  const v = m[2].trim();
  if (/^\d{8}$/.test(v)) {
    // date-only — treat as full-day in UTC (start of day)
    return v.slice(0, 4) + '-' + v.slice(4, 6) + '-' + v.slice(6, 8) + 'T00:00:00.000Z';
  }
  const isUtc = /Z$/.test(v) || /TZID=UTC/i.test(params);
  const iso = v.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2}).*$/, '$1-$2-$3T$4:$5:$6');
  return new Date(isUtc ? iso + 'Z' : iso + 'Z').toISOString(); // floating treated as UTC; close enough for conflict checks
}

function formatUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// ─── XML helpers ─────────────────────────────────────────────────────────

interface ParsedCal { href: string; displayName: string; supportsVEvent: boolean }

function parseCalendarList(xml: string): ParsedCal[] {
  const out: ParsedCal[] = [];
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
    'i',
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
