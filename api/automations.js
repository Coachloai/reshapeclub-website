/* ══════════════════════════════════════
   ReShape — Nurture Automation Engine
   Email (Resend) + SMS (Twilio) + WhatsApp (Twilio)
   All API calls routed through Supabase Edge Function
══════════════════════════════════════ */

// Config loaded from api/config.js (public settings only — no API keys)
var AUTOMATION_CONFIG = window.__AUTOMATION_CONFIG || {
  coach_email: 'coach@reshape.fit',
  google_calendar_id: '',
  google_client_id: '',
  google_client_secret: '',
  google_refresh_token: '',
  icloud_enabled: true,
  from_email: 'coach@reshape.fit',
  from_name: 'Jaime | ReShape',
  booking_url: 'https://reshape.fit/booking',
};

// Edge Function URL
var EDGE_FUNCTION_URL = 'https://lvizldmdficsfpgegehp.supabase.co/functions/v1/process-queue';

/* ── VERIFY PHONE (format + auto-convert UK numbers) ── */
async function verifyPhone(phone, inputEl) {
  var cleaned = phone.replace(/[\s\-\(\)]/g, '');
  // Auto-convert UK local numbers to international format
  if (/^0[1-9]\d{8,10}$/.test(cleaned)) {
    cleaned = '+44' + cleaned.substring(1);
    // Update the input field with the converted number
    if (inputEl) inputEl.value = cleaned;
  }
  // Also handle 44 without the +
  if (/^44\d{10,11}$/.test(cleaned)) {
    cleaned = '+' + cleaned;
    if (inputEl) inputEl.value = cleaned;
  }
  if (!/^\+\d{10,15}$/.test(cleaned)) return { valid: false, error: 'Enter a valid phone number (e.g. 07700 000000 or +44 7700 000000)' };
  // Country-specific length validation
  var rules = {
    '+44': { min: 12, max: 13, label: 'UK' },
    '+1': { min: 11, max: 11, label: 'US/CA' },
    '+353': { min: 12, max: 13, label: 'Ireland' },
    '+61': { min: 11, max: 12, label: 'Australia' },
    '+91': { min: 12, max: 13, label: 'India' },
  };
  for (var prefix in rules) {
    if (cleaned.startsWith(prefix)) {
      var r = rules[prefix];
      if (cleaned.length < r.min || cleaned.length > r.max) {
        return { valid: false, error: r.label + ' numbers should be ' + r.min + '-' + r.max + ' digits' };
      }
      return { valid: true, cleaned: cleaned };
    }
  }
  if (cleaned.length < 10 || cleaned.length > 15) return { valid: false, error: 'Phone number length doesn\'t look right' };
  return { valid: true, cleaned: cleaned };
}

/* ── VERIFY EMAIL DOMAIN (MX record check) ── */
async function verifyEmail(email) {
  try {
    var domain = email.split('@')[1];
    if (!domain) return { valid: false, error: 'Invalid email format' };
    // Use a free DNS lookup API to check MX records
    var res = await fetch('https://dns.google/resolve?name=' + domain + '&type=MX');
    var data = await res.json();
    if (data.Answer && data.Answer.length > 0) return { valid: true };
    if (data.Status === 3 || !data.Answer) return { valid: false, error: 'Email domain does not exist' };
    return { valid: true };
  } catch (e) { return { valid: true }; } // On error, don't block
}

/* ── CALL EDGE FUNCTION (all API calls go through server) ── */
async function callEdgeFunction(payload) {
  try {
    var res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (e) { return { success: false, error: e.message }; }
}

/* ── SEND EMAIL via Edge Function ── */
async function sendEmail(to, subject, htmlBody, attachments) {
  return callEdgeFunction({
    action: 'send_message',
    channel: 'email',
    to_email: to,
    subject: subject,
    html_body: htmlBody,
    attachments: attachments || null
  });
}

/* ── SEND SMS via Edge Function ── */
async function sendSMS(to, body) {
  return callEdgeFunction({
    action: 'send_message',
    channel: 'sms',
    to_phone: to,
    text_body: body
  });
}

/* ── SEND WHATSAPP via Edge Function ── */
async function sendWhatsApp(to, body) {
  return callEdgeFunction({
    action: 'send_message',
    channel: 'whatsapp',
    to_phone: to,
    text_body: body
  });
}

/* ── GENERATE .ICS CALENDAR FILE ── */
function generateICS(booking, leadName, opts) {
  var o = opts || {};
  var dt = new Date(booking.datetime);
  var endDt = new Date(dt.getTime() + 3600000); // 1 hour duration
  function icsDate(d) {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }
  var location = booking.location === 'Ipswich' ? 'ReShape, Ipswich' : booking.location === 'Colchester' ? 'ReShape, Colchester' : 'ReShape, ' + (booking.location || '');
  var isCoach = o.forCoach;
  var summary = isCoach ? 'Consult: ' + (leadName || 'New Lead') : 'ReShape Consultation';
  var description = isCoach
    ? 'Consultation with ' + (leadName || 'Lead') + (o.leadEmail ? ' (' + o.leadEmail + ')' : '') + (o.leadPhone ? ' | Phone: ' + o.leadPhone : '')
    : 'Your in-person consultation with ReShape. Wear something comfortable!';
  return 'BEGIN:VCALENDAR\r\n' +
    'VERSION:2.0\r\n' +
    'PRODID:-//ReShape//Booking//EN\r\n' +
    'CALSCALE:GREGORIAN\r\n' +
    'METHOD:' + (isCoach ? 'REQUEST' : 'PUBLISH') + '\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:' + icsDate(dt) + '\r\n' +
    'DTEND:' + icsDate(endDt) + '\r\n' +
    'SUMMARY:' + summary + '\r\n' +
    'DESCRIPTION:' + description + '\r\n' +
    'LOCATION:' + location + '\r\n' +
    'STATUS:CONFIRMED\r\n' +
    'UID:reshape-' + dt.getTime() + '-' + (isCoach ? 'coach' : 'lead') + '@reshape.fit\r\n' +
    (isCoach && AUTOMATION_CONFIG.from_email ? 'ORGANIZER:mailto:' + AUTOMATION_CONFIG.from_email + '\r\n' : '') +
    'END:VEVENT\r\n' +
    'END:VCALENDAR';
}

/* ── GOOGLE CALENDAR — GET ACCESS TOKEN ── */
async function getGoogleAccessToken() {
  var res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: AUTOMATION_CONFIG.google_client_id,
      client_secret: AUTOMATION_CONFIG.google_client_secret,
      refresh_token: AUTOMATION_CONFIG.google_refresh_token,
      grant_type: 'refresh_token'
    }).toString()
  });
  var data = await res.json();
  return data.access_token || null;
}

/* ── GOOGLE CALENDAR — CREATE EVENT ── */
async function addToGoogleCalendar(lead, booking, calendarIdOverride) {
  var token = await getGoogleAccessToken();
  if (!token) return { success: false, error: 'No access token' };
  var calendarId = calendarIdOverride || AUTOMATION_CONFIG.google_calendar_id || 'primary';
  var leadName = ((lead.first_name || '') + ' ' + (lead.last_name || '')).trim();
  var dt = new Date(booking.datetime);
  var endDt = new Date(dt.getTime() + 3600000);
  var location = booking.location === 'Ipswich' ? 'ReShape, Ipswich' : booking.location === 'Colchester' ? 'ReShape, Colchester' : 'ReShape, ' + (booking.location || '');
  var event = {
    summary: 'Consult: ' + (leadName || 'New Lead'),
    description: 'Consultation with ' + leadName +
      '\nEmail: ' + (lead.email || '') +
      '\nPhone: ' + (lead.phone || '') +
      '\nLocation: ' + (booking.location || ''),
    location: location,
    start: { dateTime: dt.toISOString(), timeZone: 'Europe/London' },
    end: { dateTime: endDt.toISOString(), timeZone: 'Europe/London' },
    reminders: { useDefault: false, overrides: [
      { method: 'popup', minutes: 60 },
      { method: 'popup', minutes: 15 }
    ]}
  };
  var res = await fetch('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendarId) + '/events', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
  var data = await res.json();
  return data.id ? { success: true, id: data.id, calendarId: calendarId } : { success: false, error: data.error ? data.error.message : 'Unknown error' };
}

/* ── GOOGLE CALENDAR — DELETE EVENT ── */
async function deleteFromGoogleCalendar(eventId, calendarIdOverride) {
  var token = await getGoogleAccessToken();
  if (!token) return { success: false, error: 'No access token' };
  var calendarId = calendarIdOverride || AUTOMATION_CONFIG.google_calendar_id || 'primary';
  var res = await fetch('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendarId) + '/events/' + encodeURIComponent(eventId), {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return (res.status >= 200 && res.status < 300) || res.status === 404 ? { success: true } : { success: false, error: 'HTTP ' + res.status };
}

/* ── ICLOUD CALENDAR — DELETE EVENT (via Supabase Edge Function) ── */
async function deleteFromIcloudCalendar(eventUrl) {
  var res = await fetch('https://lvizldmdficsfpgegehp.supabase.co/functions/v1/icloud-calendar', {
    method: 'POST',
    headers: edgeHeaders(),
    body: JSON.stringify({ action: 'delete', eventUrl: eventUrl }),
  });
  var data = await res.json().catch(function(){ return {}; });
  return data && data.success ? { success: true } : { success: false, error: (data && data.error) || ('HTTP ' + res.status) };
}

/* ── DELETE CALENDAR EVENT (auto-detect provider) ── */
async function deleteCalendarEvent(booking) {
  if (!booking.calendar_event_id && !booking.calendar_event_url) return;
  try {
    if (booking.calendar_provider === 'icloud' && booking.calendar_event_url) {
      await deleteFromIcloudCalendar(booking.calendar_event_url);
    } else if (booking.calendar_provider === 'google' && booking.calendar_event_id) {
      await deleteFromGoogleCalendar(booking.calendar_event_id);
    }
  } catch (e) { console.warn('Calendar event delete failed:', e); }
}

// Supabase anon key (public — safe to include) for hitting the edge functions
// that have JWT verification enabled.
var SUPABASE_ANON_KEY_PUBLIC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aXpsZG1kZmljc2ZwZ2VnZWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTk4NDQsImV4cCI6MjA4OTI3NTg0NH0.72wHbZaTvqNzW6DTb6Ae1vi9QpOg_-KiEO-Jjm9mn0k';

function edgeHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY_PUBLIC,
    'apikey': SUPABASE_ANON_KEY_PUBLIC,
  };
}

/* ── ICLOUD CALENDAR — CREATE EVENT (via Supabase Edge Function) ── */
async function addToIcloudCalendar(lead, booking, calendarNameOverride) {
  var leadName = ((lead.first_name || '') + ' ' + (lead.last_name || '')).trim();
  var res = await fetch('https://lvizldmdficsfpgegehp.supabase.co/functions/v1/icloud-calendar', {
    method: 'POST',
    headers: edgeHeaders(),
    body: JSON.stringify({
      leadName: leadName,
      leadEmail: lead.email,
      leadPhone: lead.phone,
      datetime: booking.datetime,
      location: booking.location,
      durationMinutes: 45,
      calendarName: calendarNameOverride || undefined,
    }),
  });
  var data = await res.json().catch(function(){ return {}; });
  return data && data.success ? { success: true, id: data.id, calendar: data.calendar } : { success: false, error: (data && data.error) || ('HTTP ' + res.status) };
}

/* ── LOAD GLOBAL CALENDAR SETTINGS ── */
async function loadGlobalCalendarSettings() {
  var sbClient = (typeof window !== 'undefined' && window.__supabaseClient) || null;
  if (!sbClient) return null;
  try {
    var res = await sbClient.from('calendar_settings').select('default_target_calendar, include_buffers').eq('id', 'global').maybeSingle();
    return res.data || null;
  } catch (e) { return null; }
}

/* ── LOAD PER-TYPE OVERRIDE ── */
async function loadApptTypeTarget(booking) {
  var sbClient = (typeof window !== 'undefined' && window.__supabaseClient) || null;
  if (!sbClient || !booking || !booking.appointment_type_id) return null;
  try {
    var res = await sbClient.from('appointment_types').select('calendar_targets').eq('id', booking.appointment_type_id).maybeSingle();
    var arr = res.data && Array.isArray(res.data.calendar_targets) ? res.data.calendar_targets : [];
    return arr[0] || null;
  } catch (e) { return null; }
}

/* ── SEND COACH CALENDAR INVITE ── */
async function sendCoachCalendarInvite(lead, booking) {
  if (!booking || !booking.datetime) return;

  // Resolve where to write the event: per-type override first, else the
  // global default from calendar_settings.
  var typeTarget = await loadApptTypeTarget(booking);
  var target = typeTarget;
  if (!target) {
    var settings = await loadGlobalCalendarSettings();
    target = settings && settings.default_target_calendar;
  }

  console.log('[Calendar] Booking location:', booking.location, '| typeTarget:', typeTarget, '| resolvedTarget:', target, '| bookingId:', booking.id || 'n/a');

  var tasks = [];
  if (target) {
    if (target.indexOf('icloud') === 0 && AUTOMATION_CONFIG.icloud_enabled) {
      var icalName = target === 'icloud' ? null : target.slice('icloud:'.length);
      tasks.push(addToIcloudCalendar(lead, booking, icalName).then(
        function(r){ return { name: 'icloud' + (icalName ? ':' + icalName : ''), provider: 'icloud', result: r }; },
        function(e){ return { name: 'icloud', provider: 'icloud', result: { success: false, error: e.message } }; }
      ));
    } else if (target.indexOf('google:') === 0 && AUTOMATION_CONFIG.google_client_id && AUTOMATION_CONFIG.google_refresh_token) {
      var calId = target.slice('google:'.length) || 'primary';
      tasks.push(addToGoogleCalendar(lead, booking, calId).then(
        function(r){ return { name: 'google:' + calId, provider: 'google', result: r }; },
        function(e){ return { name: 'google:' + calId, provider: 'google', result: { success: false, error: e.message } }; }
      ));
    }
  }
  // If nothing's been configured globally, fall back to whatever's connected so existing
  // installs don't suddenly lose calendar events.
  if (tasks.length === 0) {
    if (AUTOMATION_CONFIG.icloud_enabled) {
      tasks.push(addToIcloudCalendar(lead, booking).then(
        function(r){ return { name: 'icloud', provider: 'icloud', result: r }; },
        function(e){ return { name: 'icloud', provider: 'icloud', result: { success: false, error: e.message } }; }
      ));
    }
    if (AUTOMATION_CONFIG.google_client_id && AUTOMATION_CONFIG.google_refresh_token) {
      tasks.push(addToGoogleCalendar(lead, booking).then(
        function(r){ return { name: 'google', provider: 'google', result: r }; },
        function(e){ return { name: 'google', provider: 'google', result: { success: false, error: e.message } }; }
      ));
    }
  }

  if (tasks.length > 0) {
    var outcomes = await Promise.all(tasks);
    var anySuccess = false;
    for (var i = 0; i < outcomes.length; i++) {
      var o = outcomes[i];
      if (o.result.success) {
        console.log(o.name + ' calendar event created:', o.result.id);
        anySuccess = true;
        // Save calendar event reference back to the booking row for future delete/update
        if (booking.id) {
          var sbClient = (typeof window !== 'undefined' && window.__supabaseClient) || null;
          if (sbClient) {
            sbClient.from('bookings').update({
              calendar_event_id: o.result.id || null,
              calendar_event_url: o.result.url || null,
              calendar_provider: o.provider
            }).eq('id', booking.id).then(function(){}, function(e){ console.warn('Failed to save calendar event ref:', e); });
          }
        }
      } else {
        console.warn(o.name + ' calendar failed:', o.result.error);
      }
    }
    if (anySuccess) return;
  }

  // Fallback: send .ics email invite
  var coachEmail = AUTOMATION_CONFIG.coach_email || AUTOMATION_CONFIG.from_email;
  var leadName = ((lead.first_name || '') + ' ' + (lead.last_name || '')).trim();
  var icsContent = generateICS(booking, leadName, {
    forCoach: true,
    leadEmail: lead.email,
    leadPhone: lead.phone
  });
  var htmlBody = emailTemplate(
    'New Booking: ' + leadName,
    '<p>A new visit has been booked:</p>' +
    '<div style="background:rgba(237,92,37,0.08);border:1px solid rgba(237,92,37,0.2);border-radius:12px;padding:16px 20px;margin:16px 0">' +
    '<p style="margin:4px 0"><strong>Name:</strong> ' + leadName + '</p>' +
    '<p style="margin:4px 0"><strong>Email:</strong> ' + (lead.email || '') + '</p>' +
    '<p style="margin:4px 0"><strong>Phone:</strong> ' + (lead.phone || '') + '</p>' +
    '<p style="margin:4px 0"><strong>Date:</strong> ' + (booking.date || '') + '</p>' +
    '<p style="margin:4px 0"><strong>Time:</strong> ' + (booking.time || '') + '</p>' +
    '<p style="margin:4px 0"><strong>Location:</strong> ' + (booking.location || '') + '</p></div>' +
    '<p style="font-size:14px;color:rgba(255,255,255,0.5)">This event has been added to your calendar automatically.</p>',
    '', ''
  );
  var attachments = [{ filename: 'invite.ics', content: btoa(icsContent) }];
  await sendEmail(coachEmail, 'New Booking: ' + leadName + ' \u2014 ' + (booking.date || ''), htmlBody, attachments);
}

/* ══════════════════════════════════════
   EMAIL TEMPLATES
══════════════════════════════════════ */
function emailTemplate(title, body, ctaText, ctaUrl) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#0B0B0B;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">' +
    '<div style="max-width:560px;margin:0 auto;padding:40px 24px">' +
    '<div style="text-align:center;margin-bottom:32px"><span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px">Re<span style="color:#ED5C25">Shape</span></span></div>' +
    '<div style="background:#111213;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 28px">' +
    '<h1 style="font-size:22px;font-weight:800;color:#fff;margin:0 0 16px;line-height:1.3">' + title + '</h1>' +
    '<div style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin-bottom:28px">' + body + '</div>' +
    (ctaText ? '<a href="' + ctaUrl + '" style="display:inline-block;background:#ED5C25;color:#fff;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none">' + ctaText + '</a>' : '') +
    '</div>' +
    '<div style="text-align:center;margin-top:24px;font-size:12px;color:rgba(255,255,255,0.3)">ReShape Body Transformation &middot; Ipswich &amp; Colchester</div>' +
    '</div></body></html>';
}

/* ══════════════════════════════════════
   TEAM NOTIFICATIONS — booking lifecycle events
══════════════════════════════════════ */
var TEAM_NOTIFY_EMAIL = 'reshape.nurturing@gmail.com';

// eventType: 'cancelled' | 'noshow' | 'rescheduled'
// oldBooking + newBooking are { date, time, location } shape; newBooking only for rescheduled.
async function notifyTeamBookingEvent(eventType, lead, oldBooking, newBooking) {
  var leadName = ((lead.first_name || '') + ' ' + (lead.last_name || '')).trim() || 'Unknown lead';
  var titles = {
    cancelled:   'Booking cancelled: ' + leadName,
    noshow:      'No-show: ' + leadName,
    rescheduled: 'Booking rescheduled: ' + leadName
  };
  var labels = {
    cancelled:   'was cancelled.',
    noshow:      'was marked no-show.',
    rescheduled: 'was rescheduled.'
  };
  var title = titles[eventType] || ('Booking event: ' + leadName);
  var label = labels[eventType] || 'changed.';

  var row = function(k, v) {
    return '<p style="margin:4px 0"><strong>' + k + ':</strong> ' + (v || '—') + '</p>';
  };
  var leadBlock =
    '<div style="background:rgba(237,92,37,0.08);border:1px solid rgba(237,92,37,0.2);border-radius:12px;padding:16px 20px;margin:16px 0">' +
    row('Name', leadName) +
    row('Email', lead.email) +
    row('Phone', lead.phone) +
    row('Location', (oldBooking && oldBooking.location) || (newBooking && newBooking.location)) +
    '</div>';

  var slotsBlock;
  if (eventType === 'rescheduled' && newBooking) {
    slotsBlock =
      '<p style="margin:16px 0 8px;color:rgba(255,255,255,0.5);font-size:13px;text-transform:uppercase;letter-spacing:0.08em">Was</p>' +
      '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 18px;margin:0 0 12px">' +
        row('Date', oldBooking && oldBooking.date) + row('Time', oldBooking && oldBooking.time) +
      '</div>' +
      '<p style="margin:16px 0 8px;color:rgba(255,255,255,0.5);font-size:13px;text-transform:uppercase;letter-spacing:0.08em">Now</p>' +
      '<div style="background:rgba(46,204,113,0.06);border:1px solid rgba(46,204,113,0.2);border-radius:12px;padding:14px 18px">' +
        row('Date', newBooking.date) + row('Time', newBooking.time) +
      '</div>';
  } else {
    slotsBlock =
      '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 18px;margin:16px 0">' +
        row('Date', oldBooking && oldBooking.date) + row('Time', oldBooking && oldBooking.time) +
      '</div>';
  }

  var body =
    '<p>The consultation with <strong>' + leadName + '</strong> ' + label + '</p>' +
    leadBlock + slotsBlock;
  var html = emailTemplate(title, body, '', '');

  try { return await sendEmail(TEAM_NOTIFY_EMAIL, title, html, null); }
  catch (e) { console.warn('Team notify failed:', e); return { success: false, error: e.message }; }
}

/* ══════════════════════════════════════
   STUDIO META — coach name, address, maps link per studio
══════════════════════════════════════ */
function studioMeta(booking) {
  var loc = ((booking && booking.location) || '').toLowerCase();
  if (loc.indexOf('ipswich') >= 0) {
    return {
      coach:   'Sara',
      address: '12 Boss Hall Road, Ipswich, IP1 5BN',
      mapsUrl: 'https://share.google/HvwtMaMqe5KoVJrSF'
    };
  }
  return {
    coach:   'Sean',
    address: 'Unit 3 Building A, Chesterwell Mews, Colchester, CO4 6EE',
    mapsUrl: 'https://share.google/ZyRUxiyJeD3Ro8isK'
  };
}

/* ══════════════════════════════════════
   NURTURE SEQUENCES
══════════════════════════════════════ */
var SEQUENCES = {
  // After form submission (no booking)
  form_submitted: [
    { delay: 0,        channel: 'email',    subject: 'Application received \u2014 here\'s what happens next',
      body: function(lead) { return emailTemplate(
        'Hey ' + lead.first_name + ', we got your application! \uD83D\uDC4A',
        '<p>Thanks for applying to ReShape. We\'re reviewing your details now.</p><p>In the meantime, why not book your in-person visit? Spots fill up fast.</p>',
        'Book Your Visit', AUTOMATION_CONFIG.booking_url
      ); }
    },
    { delay: 3600,     channel: 'sms',
      body: function(lead) { return 'Hey ' + lead.first_name + ', it\'s Jaime from ReShape. We got your application! Book your in-person visit before spots fill up: ' + AUTOMATION_CONFIG.booking_url; }
    },
    { delay: 7200,     channel: 'whatsapp',
      body: function(lead) { return 'Hey ' + lead.first_name + '! 👋 It\'s Jaime from ReShape. Just seen your application come through — love that you\'re taking the first step! Fancy popping in for a visit? I\'d love to chat about your goals in person. Book here: ' + AUTOMATION_CONFIG.booking_url; }
    },
    { delay: 86400,    channel: 'email',    subject: 'People like you are getting results',
      body: function(lead) { return emailTemplate(
        lead.first_name + ', people just like you are transforming',
        '<p>Since you applied, 3 more people have started their journey with us.</p><p>Our members lose an average of 8\u201312kg in 12 weeks. And if they don\'t? We coach them for free until they do.</p><p>Don\'t let this opportunity pass \u2014 book your visit now.</p>',
        'Book Your Visit', AUTOMATION_CONFIG.booking_url
      ); }
    },
    { delay: 172800,   channel: 'whatsapp',
      body: function(lead) { return 'Hey ' + lead.first_name + ', quick one from Jaime 💪 I had a look at your application and I genuinely think we can help you hit your goals. Spots are filling up though — grab yours here: ' + AUTOMATION_CONFIG.booking_url; }
    },
    { delay: 259200,   channel: 'sms',
      body: function(lead) { return 'Hi ' + lead.first_name + ', just checking in! Have you had a chance to book your ReShape visit yet? We\'d love to show you around: ' + AUTOMATION_CONFIG.booking_url; }
    },
    { delay: 604800,   channel: 'email',    subject: 'Last chance \u2014 your spot won\'t wait forever',
      body: function(lead) { return emailTemplate(
        lead.first_name + ', your spot is still open \u2014 but not for long',
        '<p>It\'s been a week since you applied. We\'d love to help you start your transformation, but we can only hold spots for so long.</p><p>This is your final reminder \u2014 book your visit and let\'s make it happen.</p>',
        'Book Now', AUTOMATION_CONFIG.booking_url
      ); }
    },
  ],

  // After booking confirmed
  booking_confirmed: [
    { delay: 0,        channel: 'email',    subject: 'You\'re booked! \uD83C\uDF89 See you soon',
      attach_ics: true,
      body: function(lead, booking) { return emailTemplate(
        'You\'re booked, ' + lead.first_name + '! \uD83C\uDF89',
        '<p>We can\'t wait to meet you. Here are your visit details:</p>' +
        '<div style="background:rgba(237,92,37,0.08);border:1px solid rgba(237,92,37,0.2);border-radius:12px;padding:16px 20px;margin:16px 0">' +
        '<p style="margin:4px 0"><strong>Date:</strong> ' + (booking.date || '') + '</p>' +
        '<p style="margin:4px 0"><strong>Time:</strong> ' + (booking.time || '') + '</p>' +
        '<p style="margin:4px 0"><strong>Location:</strong> ' + (booking.location || '') + '</p></div>' +
        '<p>Wear something comfortable. We\'ll handle the rest.</p>' +
        '<p style="margin-top:16px;font-size:14px;color:rgba(255,255,255,0.5)">A calendar invite (.ics) is attached to this email.</p>' +
        (booking.id && booking.confirm_token ? '<p style="margin-top:12px;font-size:12px;color:rgba(255,255,255,0.3)">Need to cancel? <a href="https://reshape.fit/cancel?id=' + encodeURIComponent(booking.id) + '&token=' + encodeURIComponent(booking.confirm_token) + '" style="color:rgba(255,255,255,0.4);text-decoration:underline">Cancel booking</a></p>' : ''),
        '', ''
      ); }
    },
    { delay: 0,        channel: 'sms',
      body: function(lead, booking) { return 'You\'re booked, ' + lead.first_name + '! ' + (booking.date || '') + ' at ' + (booking.time || '') + ', ' + (booking.location || '') + '. Wear something comfortable - see you there!'; }
    },
    // Confirm-request WhatsApp — fires ~1 min after booking. Primary
    // place the confirm link goes out so it works regardless of booking
    // lead time. The 24h-before reminder below is a secondary nudge.
    { delay: 60,       channel: 'whatsapp',
      body: function(lead, booking) {
        var m = studioMeta(booking);
        var confirmUrl = (booking.id && booking.confirm_token)
          ? 'https://reshape.fit/confirm?id=' + encodeURIComponent(booking.id) + '&token=' + encodeURIComponent(booking.confirm_token)
          : 'https://reshape.fit/confirm';
        return 'Hey ' + (lead.first_name || '') + '\n\n' +
          'It\'s ' + m.coach + ' from ReShape :)\n\n' +
          'Just got your booking through for ' + (booking.date || '') + ' at ' + (booking.time || '') + '. I\'ve had a look at your application and I think this will be a great fit for you.\n\n' +
          'We only take confirmed appointments \u2014 please have a look at the page below and let me know if there\'s anyone on there you can relate to in terms of starting point and/or goal:\n\n' +
          confirmUrl + '\n\n' +
          'This helps us understand where we\'re starting from and how we can best help you.\n\n' +
          'The address is: ' + m.address + '\n' +
          '\uD83D\uDCCD ' + m.mapsUrl + '\n\n' +
          'Look forward to meeting you :)\n' +
          m.coach;
      }
    },
    { delay: -86400,   channel: 'whatsapp', is_reminder: true,
      body: function(lead, booking) {
        var m = studioMeta(booking);
        var resultsUrl = (booking.id && booking.confirm_token)
          ? 'https://reshape.fit/confirm?id=' + encodeURIComponent(booking.id) + '&token=' + encodeURIComponent(booking.confirm_token)
          : 'https://reshape.fit/confirm';
        return 'Hey ' + (lead.first_name || '') + '\n\n' +
          'It\'s ' + m.coach + ' from Re-Shape :)\n\n' +
          'Just a quick message to let you know your consult tomorrow at ' + (booking.time || '') + ' will be with me. I\'ve looked through your application and I think this will be a great fit for you!\n\n' +
          'We only take confirmed appointments \u2014 please have a look at the page below and let me know if there\'s anyone on there you can relate to in terms of starting point and/or goal:\n\n' +
          resultsUrl + '\n\n' +
          'This helps us understand where we\'re starting from and how we can best help you.\n\n' +
          'The address is: ' + m.address + '\n' +
          '\uD83D\uDCCD ' + m.mapsUrl + '\n\n' +
          'Look forward to meeting you at ' + (booking.time || '') + ' :)\n' +
          m.coach;
      }
    },
    { delay: -7200,    channel: 'sms',      is_reminder: true,
      body: function(lead, booking) {
        var m = studioMeta(booking);
        return 'Hey ' + (lead.first_name || '') + ', ' + m.coach + ' here — see you at ' + (booking.time || '') + ' for your consult. Address: ' + m.address + '. ' + m.mapsUrl;
      }
    },
    { delay: -7200,    channel: 'email',    is_reminder: true, subject: 'Your ReShape visit is in 2 hours!',
      body: function(lead, booking) { return emailTemplate(
        'See you in 2 hours, ' + lead.first_name + '! \uD83D\uDCAA',
        '<p>Your ReShape visit is coming up at <strong>' + (booking.time || '') + '</strong> at <strong>' + (booking.location || '') + '</strong>.</p><p>Wear something comfortable. We\'ll handle the rest. Can\'t wait to meet you!</p>',
        '', ''
      ); }
    },
  ],
};

/* ══════════════════════════════════════
   DB SEQUENCE SUPPORT — variable substitution & template wrapping
══════════════════════════════════════ */

// Replace {variable} placeholders in a text string with actual values
function replaceVars(text, lead, booking) {
  if (!text) return '';
  var b = booking || {};
  var meta = studioMeta(b);
  var hp = lead && lead.hormonal_pattern;
  var resultsUrl = (b.id && b.confirm_token)
    ? 'https://reshape.fit/results/?id=' + encodeURIComponent(b.id) + '&token=' + encodeURIComponent(b.confirm_token)
    : 'https://reshape.fit/results';
  var vars = {
    first_name:    (lead && lead.first_name) || '',
    pattern:       hp ? 'your ' + hp + ' results' : 'the goals you shared with us',
    book_link:     AUTOMATION_CONFIG.booking_url || '',
    booking_url:   AUTOMATION_CONFIG.booking_url || '',  // alias used by some DB sequences
    coach:         meta.coach,
    studio:        (lead && lead.location) || b.location || 'Ipswich & Colchester',
    date:          b.date || '',
    time:          b.time || '',
    location:      b.location || '',
    booking_date:  b.date || '',                  // alias used by some DB sequences
    booking_time:  b.time || '',                  // alias used by some DB sequences
    results_url:   resultsUrl,                    // preferred — personalised /results page
    confirm_url:   resultsUrl,                    // legacy alias (was /confirm — renamed to /results)
    confirm_id:    b.id || '',
    confirm_token: b.confirm_token || '',
    cancel_url:    (b.id && b.confirm_token) ? 'https://reshape.fit/cancel?id=' + encodeURIComponent(b.id) + '&token=' + encodeURIComponent(b.confirm_token) : '',
    address:       meta.address || '',
    maps_url:      meta.mapsUrl || ''
  };
  return text.replace(/\{(\w+)\}/g, function(match, key) {
    return vars.hasOwnProperty(key) ? vars[key] : match;
  });
}

// Convert plain text body (from database) into HTML email via emailTemplate()
// bodyText uses \n\n to separate paragraphs; ctaText/ctaUrl are optional
function wrapEmailBody(subject, bodyText, ctaText, ctaUrl) {
  // Normalise literal \n sequences (stored as text in some DB rows) to real newlines
  bodyText = bodyText.replace(/\\n/g, '\n');
  var paragraphs = bodyText.split(/\n\n/);
  var html = '';
  for (var i = 0; i < paragraphs.length; i++) {
    var p = paragraphs[i].trim();
    if (p) html += '<p>' + p + '</p>';
  }
  return emailTemplate(subject, html, ctaText || '', ctaUrl || '');
}

// Queue a nurture sequence by reading steps from the Supabase database
async function queueSequenceFromDB(sequenceName, lead, booking, supabaseClient) {
  if (!supabaseClient) return false;

  // 1. Look up the sequence by trigger_type (machine-readable name)
  var seqRes = await supabaseClient
    .from('automation_sequences')
    .select('id, name, trigger_type, is_active')
    .eq('trigger_type', sequenceName)
    .eq('is_active', true)
    .single();

  if (!seqRes.data) return false; // not found in DB — caller will fall back

  var sequenceId = seqRes.data.id;

  // 2. Fetch all active steps ordered by step_order
  var stepsRes = await supabaseClient
    .from('automation_steps')
    .select('id, step_order, channel, delay_seconds, subject, body, is_active')
    .eq('sequence_id', sequenceId)
    .eq('is_active', true)
    .order('step_order', { ascending: true });

  var steps = stepsRes.data || [];
  if (steps.length === 0) return false;

  // 3. Cancel any existing pending messages for this lead + sequence (deduplication)
  await supabaseClient
    .from('message_queue')
    .update({ status: 'cancelled' })
    .eq('lead_email', lead.email)
    .eq('sequence', sequenceName)
    .in('status', ['queued', 'sending']);

  // 4. Build messages from DB steps
  var now = Date.now();
  var messages = [];

  for (var i = 0; i < steps.length; i++) {
    var step = steps[i];
    // Negative delay_seconds = schedule relative to booking.datetime
    // (e.g. -86400 = 24h before, -7200 = 2h before). See
    // supabase/seeds/booking_confirmed_dbdriven.sql for the convention.
    var sendAt;
    if (step.delay_seconds < 0 && booking && booking.datetime) {
      sendAt = new Date(new Date(booking.datetime).getTime() + (step.delay_seconds * 1000)).toISOString();
    } else {
      sendAt = new Date(now + (step.delay_seconds * 1000)).toISOString();
    }

    // Skip steps whose scheduled time is already in the past.
    // Happens when a booking is made <24h ahead and the -86400s "TOMORROW"
    // reminder would have fired yesterday. Without this, the queue fires it
    // immediately, sending a misleading "TOMORROW" message right after booking.
    if (new Date(sendAt).getTime() < now - 5 * 60 * 1000) {
      continue;
    }

    // Apply variable substitution
    var bodyText = replaceVars(step.body || '', lead, booking);
    var subjectText = replaceVars(step.subject || '', lead, booking);

    // Normalise literal \n from DB rows into real newlines
    bodyText = bodyText.replace(/\\n/g, '\n');

    // Wrap email bodies in HTML template
    var finalBody;
    if (step.channel === 'email') {
      finalBody = wrapEmailBody(subjectText, bodyText, '', '');
    } else {
      finalBody = bodyText;
    }

    messages.push({
      lead_email: lead.email,
      lead_phone: lead.phone || null,
      lead_name: lead.first_name + ' ' + (lead.last_name || ''),
      sequence: sequenceName,
      step_index: step.step_order,
      channel: step.channel,
      subject: subjectText,
      body: finalBody,
      send_at: sendAt,
      status: step.delay_seconds === 0 ? 'sending' : 'queued',
    });
  }

  // 5. Insert into message_queue
  if (messages.length > 0) {
    var insertRes = await supabaseClient.from('message_queue').insert(messages).select();
    var inserted = insertRes.data || [];

    // 6. For delay=0 messages, call the Edge Function to send immediately
    for (var j = 0; j < inserted.length; j++) {
      if (inserted[j].status === 'sending') {
        await processMessage(inserted[j], supabaseClient, null);
      }
    }
  }

  return true; // successfully queued from DB
}

/* ══════════════════════════════════════
   QUEUE MANAGER
══════════════════════════════════════ */

// Queue a full nurture sequence for a lead
// Tries the database first, then falls back to hardcoded SEQUENCES
async function queueSequence(sequenceName, lead, booking, supabaseClient) {
  // Try database-driven sequences first
  try {
    var dbResult = await queueSequenceFromDB(sequenceName, lead, booking, supabaseClient);
    if (dbResult) {
      // Successfully queued from DB — still send coach calendar invite if needed
      if (sequenceName === 'booking_confirmed' && booking && booking.datetime) {
        sendCoachCalendarInvite(lead, booking);
      }
      return;
    }
  } catch (e) {
    console.warn('DB sequence lookup failed for "' + sequenceName + '", falling back to hardcoded:', e.message);
  }

  // Fall back to hardcoded SEQUENCES
  var seq = SEQUENCES[sequenceName];
  if (!seq) return;
  var now = Date.now();
  var messages = [];
  var icsMap = {}; // Track which steps need .ics attachment

  for (var i = 0; i < seq.length; i++) {
    var step = seq[i];
    var sendAt;
    if (step.is_reminder && booking && booking.datetime) {
      // Reminders: schedule relative to booking time (negative delay = before)
      sendAt = new Date(new Date(booking.datetime).getTime() + (step.delay * 1000)).toISOString();
    } else {
      sendAt = new Date(now + (step.delay * 1000)).toISOString();
    }

    var msgBody = typeof step.body === 'function' ? step.body(lead, booking || {}) : step.body;
    var subject = typeof step.subject === 'function' ? step.subject(lead) : (step.subject || '');

    // Generate .ics for booking confirmation emails
    if (step.attach_ics && booking && booking.datetime) {
      icsMap[i] = generateICS(booking, lead.first_name);
    }

    messages.push({
      lead_email: lead.email,
      lead_phone: lead.phone || null,
      lead_name: lead.first_name + ' ' + (lead.last_name || ''),
      sequence: sequenceName,
      step_index: i,
      channel: step.channel,
      subject: subject,
      body: msgBody,
      send_at: sendAt,
      status: step.delay === 0 ? 'sending' : 'queued',
    });
  }

  // Insert all messages into queue and get IDs back
  if (supabaseClient && messages.length > 0) {
    var insertRes = await supabaseClient.from('message_queue').insert(messages).select();
    var inserted = (insertRes.data || []);
    // Send immediate messages (delay === 0)
    for (var j = 0; j < inserted.length; j++) {
      if (inserted[j].status === 'sending') {
        var icsContent = icsMap[inserted[j].step_index] || null;
        await processMessage(inserted[j], supabaseClient, icsContent);
      }
    }
  }

  // Send coach calendar invite for new bookings
  if (sequenceName === 'booking_confirmed' && booking && booking.datetime) {
    sendCoachCalendarInvite(lead, booking);
  }
}

// Process a single message from the queue
async function processMessage(msg, supabaseClient, icsContent) {
  var result;
  if (msg.channel === 'email') {
    var attachments = null;
    if (icsContent) {
      attachments = [{ filename: 'reshape-visit.ics', content: btoa(icsContent) }];
    }
    result = await sendEmail(msg.lead_email, msg.subject, msg.body, attachments);
  } else if (msg.channel === 'sms' && msg.lead_phone) {
    result = await sendSMS(msg.lead_phone, msg.body);
  } else if (msg.channel === 'whatsapp' && msg.lead_phone) {
    result = await sendWhatsApp(msg.lead_phone, msg.body);
  } else {
    result = { success: false, error: 'No phone number for ' + msg.channel };
  }

  // Update status in database
  if (supabaseClient && msg.id) {
    await supabaseClient.from('message_queue').update({
      status: result.success ? 'sent' : 'failed',
      sent_at: result.success ? new Date().toISOString() : null,
      error: result.error || null,
      external_id: result.id || result.sid || null
    }).eq('id', msg.id);
  }

  return result;
}

// Process all pending messages that are due
async function processQueue(supabaseClient) {
  var now = new Date().toISOString();
  var res = await supabaseClient.from('message_queue')
    .select('*')
    .eq('status', 'queued')
    .lte('send_at', now)
    .order('send_at', { ascending: true })
    .limit(20);

  var messages = res.data || [];
  var processed = 0;

  for (var i = 0; i < messages.length; i++) {
    await processMessage(messages[i], supabaseClient);
    processed++;
    // Small delay between messages to avoid rate limits
    await new Promise(function(r) { setTimeout(r, 500); });
  }

  return processed;
}
