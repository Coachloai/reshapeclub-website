const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const UNSUBSCRIBE_URL = Deno.env.get('UNSUBSCRIBE_URL') || 'https://reshape.fit/unsubscribe';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};
    const action = body.action || 'process_queue';

    if (action === 'send_message')       return ok(await sendMessage(body));
    if (action === 'process_queue')      return ok(await processQueue());
    if (action === 'list_wa_templates')  return ok(await listWhatsAppTemplates());
    if (action === 'preview_audience')   return ok(await previewAudience(body));
    if (action === 'send_broadcast')     return ok(await sendBroadcast(body));

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── SEND A SINGLE MESSAGE ──────────────────────────────────────────
async function sendMessage(body: any) {
  const { channel, to_email, to_phone, subject, html_body, text_body, attachments,
          template_sid, template_vars, consent_token } = body;

  if (channel === 'email') {
    const html = appendUnsubscribeFooter(html_body, 'email', consent_token);
    return await sendEmail(to_email, subject, html, attachments);
  }
  if (channel === 'sms')      return await sendSMS(to_phone, text_body);
  if (channel === 'whatsapp') return await sendWhatsApp(to_phone, text_body, template_sid, template_vars);
  return { success: false, error: 'Unknown channel: ' + channel };
}

// ── PROCESS QUEUED MESSAGES ────────────────────────────────────────
async function processQueue() {
  const now = new Date().toISOString();

  const fetchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/message_queue?status=in.(queued,sending)&send_at=lte.${now}&order=send_at.asc&limit=20`,
    { headers: srHeaders() }
  );
  const messages = await fetchRes.json();
  if (!Array.isArray(messages) || messages.length === 0) return { processed: 0 };

  let processed = 0;
  for (const msg of messages) {
    let result;
    try {
      // Re-check consent at send time so a same-second opt-out wins.
      const consent = await getConsent(msg.lead_email, msg.lead_phone, msg.channel);
      if (consent === 'opted_out') {
        result = { success: false, error: 'opted_out' };
      } else if (msg.channel === 'email') {
        const html = appendUnsubscribeFooter(msg.body, 'email', msg.consent_token);
        result = await sendEmail(msg.lead_email, msg.subject, html);
      } else if (msg.channel === 'sms' && msg.lead_phone) {
        result = await sendSMS(msg.lead_phone, msg.body);
      } else if (msg.channel === 'whatsapp' && msg.lead_phone) {
        result = await sendWhatsApp(
          msg.lead_phone,
          msg.body,
          msg.template_sid || null,
          msg.template_vars || null,
        );
      } else {
        result = { success: false, error: 'No phone for ' + msg.channel };
      }
    } catch (e) {
      result = { success: false, error: (e as Error).message };
    }

    await fetch(`${SUPABASE_URL}/rest/v1/message_queue?id=eq.${msg.id}`, {
      method: 'PATCH',
      headers: { ...srHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        status: result.success ? 'sent' : 'failed',
        sent_at: result.success ? new Date().toISOString() : null,
        error: result.error || null,
        external_id: result.id || result.sid || null,
      }),
    });

    if (msg.send_id) {
      // sent_count / failed_count are maintained by the trg_mq_update_send_counters
      // trigger added in migration 20260519200000.
    }

    processed++;
  }
  return { processed };
}

// ── BROADCAST: resolve audience + queue messages ───────────────────
// Body: { channel, audience, subject?, body?, template_sid?, template_vars?,
//         scheduled_at?, created_by? }
async function sendBroadcast(body: any) {
  const { channel, audience = {}, subject, body: msgBody, template_sid, template_vars,
          scheduled_at, created_by } = body;

  if (!['email','sms','whatsapp'].includes(channel))
    return { success: false, error: 'invalid channel' };

  const leads = await fetchAudience(audience, channel);
  if (!leads.length) return { success: false, error: 'no recipients match' };

  const sendAt = scheduled_at ? new Date(scheduled_at).toISOString() : new Date().toISOString();

  const sendRow = {
    created_by:      created_by || null,
    channel,
    audience_filter: audience,
    audience_size:   leads.length,
    subject:         subject || null,
    body:            msgBody || null,
    template_sid:    template_sid || null,
    template_vars:   template_vars || null,
    scheduled_at:    sendAt,
    status:          'queued',
  };
  const sendRes = await fetch(`${SUPABASE_URL}/rest/v1/message_sends`, {
    method:  'POST',
    headers: { ...srHeaders(), 'Prefer': 'return=representation' },
    body:    JSON.stringify(sendRow),
  });
  const sendData = await sendRes.json();
  if (!Array.isArray(sendData) || !sendData[0]?.id) {
    return { success: false, error: 'failed to create send: ' + JSON.stringify(sendData) };
  }
  const sendId = sendData[0].id;

  // Build queue rows in batches (Postgres REST takes arrays).
  // Replace personalisation tokens per-lead so the queued copy is final.
  const rows = leads.map((l: any) => ({
    send_id:       sendId,
    lead_email:    l.email,
    lead_phone:    l.phone,
    lead_name:     [l.first_name, l.last_name].filter(Boolean).join(' '),
    sequence:      'broadcast',
    step_index:    0,
    channel,
    subject:       subject ? fillTokens(subject, l) : null,
    body:          msgBody ? fillTokens(msgBody, l) : (template_sid ? '' : ''),
    template_sid:  template_sid || null,
    template_vars: template_vars || null,
    send_at:       sendAt,
    status:        'queued',
    consent_token: l.consent_token,
  }));

  // Postgres REST has a payload size limit; chunk at 500.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/message_queue`, {
      method:  'POST',
      headers: { ...srHeaders(), 'Prefer': 'return=minimal' },
      body:    JSON.stringify(slice),
    });
    if (!r.ok) return { success: false, error: 'queue insert failed: ' + await r.text() };
  }

  // Best-effort: kick the queue immediately so "Send now" feels instant.
  if (new Date(sendAt) <= new Date()) {
    processQueue().catch(() => {});
  }

  return { success: true, send_id: sendId, queued: leads.length };
}

async function previewAudience(body: any) {
  const { channel = 'email', audience = {} } = body || {};
  const leads = await fetchAudience(audience, channel);
  return { count: leads.length, sample: leads.slice(0, 5).map((l: any) => ({
    name: [l.first_name, l.last_name].filter(Boolean).join(' '),
    email: l.email, phone: l.phone, form_name: l.form_name, location: l.location,
  })) };
}

// audience: { list?, form_name?, location_q?, gender?, age_min?, age_max?,
//             individual_ids?: string[] }
// Rules:
//   - individual_ids alone   → just those leads (consent-checked)
//   - filter criteria alone  → filter result (consent-checked)
//   - both                   → union, deduped by id
//   - neither                → all opted-in leads (preserves prior behaviour)
async function fetchAudience(audience: any, channel: string): Promise<any[]> {
  const individuals = toArr(audience.individual_ids);
  const hasFilter =
    toArr(audience.list ?? audience.form_name).length > 0 ||
    (audience.location_q && String(audience.location_q).trim()) ||
    toArr(audience.gender).length > 0 ||
    audience.age_min != null ||
    audience.age_max != null;

  let leads: any[] = [];
  if (individuals.length) {
    leads = leads.concat(await fetchLeadsBy({ ids: individuals }, channel));
    if (hasFilter) {
      leads = leads.concat(await fetchLeadsBy({ filter: audience }, channel));
    }
  } else {
    leads = await fetchLeadsBy({ filter: audience }, channel);
  }

  const seen = new Set<string>();
  return leads.filter((l) => {
    if (!l || !l.id) return false;
    if (seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
}

async function fetchLeadsBy(opts: { ids?: string[]; filter?: any }, channel: string): Promise<any[]> {
  const params = new URLSearchParams();
  params.set('select', 'id,first_name,last_name,email,phone,age,gender,location,form_name,consent_token,email_consent_status,sms_consent_status,wa_consent_status');
  params.set('limit', '5000');

  if (channel === 'email')    params.append('email_consent_status', 'eq.opted_in');
  if (channel === 'sms')      { params.append('sms_consent_status',  'eq.opted_in'); params.append('phone', 'not.is.null'); }
  if (channel === 'whatsapp') { params.append('wa_consent_status',   'eq.opted_in'); params.append('phone', 'not.is.null'); }

  if (opts.ids?.length) {
    params.append('id', `in.(${opts.ids.map((s: string) => `"${s}"`).join(',')})`);
  } else if (opts.filter) {
    const a = opts.filter;
    const lists = toArr(a.list ?? a.form_name);
    if (lists.length) params.append('form_name', `in.(${lists.map(quote).join(',')})`);
    if (a.location_q && String(a.location_q).trim()) {
      params.append('location', `ilike.*${String(a.location_q).trim()}*`);
    }
    const genders = toArr(a.gender);
    if (genders.length) params.append('gender', `in.(${genders.map(quote).join(',')})`);
    if (a.age_min != null) params.append('age', `gte.${Number(a.age_min)}`);
    if (a.age_max != null) params.append('age', `lte.${Number(a.age_max)}`);
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?${params.toString()}`, {
    headers: srHeaders(),
  });
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

function fillTokens(text: string, lead: any): string {
  if (!text) return text;
  const map: Record<string, string> = {
    first_name: lead.first_name || '',
    last_name:  lead.last_name  || '',
    name:       [lead.first_name, lead.last_name].filter(Boolean).join(' '),
    email:      lead.email      || '',
    phone:      lead.phone      || '',
    location:   lead.location   || '',
    form_name:  lead.form_name  || '',
  };
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
}

function toArr(v: any): string[] {
  if (v == null || v === '' || v === 'all') return [];
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [String(v)];
}
function quote(s: string) { return `"${s.replace(/"/g, '\\"')}"`; }

async function getConsent(email: string, phone: string | null, channel: string): Promise<string> {
  const col = channel === 'email' ? 'email_consent_status'
            : channel === 'sms'   ? 'sms_consent_status'
            :                       'wa_consent_status';
  const params = new URLSearchParams();
  params.set('select', col);
  params.set('limit', '1');
  if (email) params.append('email', `eq.${email}`);
  else if (phone) params.append('phone', `eq.${phone}`);
  else return 'opted_in';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?${params.toString()}`, { headers: srHeaders() });
  const rows = await res.json();
  return Array.isArray(rows) && rows[0]?.[col] === 'opted_out' ? 'opted_out' : 'opted_in';
}

function srHeaders() {
  return {
    'apikey':        SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
  };
}

// ── EMAIL via Resend ───────────────────────────────────────────────
async function sendEmail(to: string, subject: string, htmlBody: string, attachments?: any[]) {
  const resendKey     = Deno.env.get('RESEND_KEY');
  const fromEmail     = Deno.env.get('FROM_EMAIL') || 'coach@reshape.fit';
  const fromName      = Deno.env.get('FROM_NAME')  || 'Jaime | ReShape';
  const fallbackEmail = Deno.env.get('FALLBACK_EMAIL') || 'onboarding@resend.dev';
  if (!resendKey) return { success: false, error: 'RESEND_KEY not set' };

  const payload: any = {
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    subject,
    html: htmlBody,
  };
  if (attachments?.length) payload.attachments = attachments;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.id) return { success: true, id: data.id };

  if (data.statusCode === 403 || data.message?.includes('domain')) {
    const fallbackPayload = { ...payload, from: `${fromName} <${fallbackEmail}>` };
    const res2 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(fallbackPayload),
    });
    const data2 = await res2.json();
    return data2.id ? { success: true, id: data2.id } : { success: false, error: data2.message };
  }

  return { success: false, error: data.message || 'Unknown error' };
}

function appendUnsubscribeFooter(html: string, _channel: string, token?: string | null) {
  if (!token || !html) return html;
  const link = `${UNSUBSCRIBE_URL}?token=${encodeURIComponent(token)}`;
  const footer = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5DFD5;font-family:Inter,Arial,sans-serif;font-size:12px;color:#B8B2A8;line-height:1.5">
  You're receiving this from ReShape because you signed up via one of our forms.
  <a href="${link}" style="color:#ED5C25;text-decoration:underline">Manage your messaging preferences or unsubscribe</a>.
</div>`;
  // Insert before </body> if present, else append.
  return html.includes('</body>') ? html.replace('</body>', footer + '</body>') : html + footer;
}

// ── SMS via Twilio ─────────────────────────────────────────────────
async function sendSMS(to: string, body: string) {
  const sid       = Deno.env.get('TWILIO_SID');
  const auth      = Deno.env.get('TWILIO_AUTH');
  const phone     = Deno.env.get('TWILIO_PHONE');
  const msgSvcSid = Deno.env.get('TWILIO_MESSAGING_SID');
  if (!sid || !auth) return { success: false, error: 'Twilio credentials not set' };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const credentials = btoa(`${sid}:${auth}`);
  const params = new URLSearchParams();
  if (msgSvcSid)   params.append('MessagingServiceSid', msgSvcSid);
  else if (phone)  params.append('From', phone);
  params.append('To', to);
  params.append('Body', body);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  return data.sid ? { success: true, sid: data.sid } : { success: false, error: data.message || 'Failed' };
}

// ── WHATSAPP via Twilio (free-form OR Content template) ────────────
async function sendWhatsApp(to: string, body: string, templateSid?: string | null, templateVars?: any) {
  const sid   = Deno.env.get('TWILIO_SID');
  const auth  = Deno.env.get('TWILIO_AUTH');
  const phone = Deno.env.get('TWILIO_PHONE');
  if (!sid || !auth || !phone) return { success: false, error: 'Twilio/WhatsApp credentials not set' };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const credentials = btoa(`${sid}:${auth}`);
  const params = new URLSearchParams();
  params.append('From', `whatsapp:${phone}`);
  params.append('To',   `whatsapp:${to}`);

  if (templateSid) {
    params.append('ContentSid', templateSid);
    if (templateVars && Object.keys(templateVars).length) {
      params.append('ContentVariables', JSON.stringify(templateVars));
    }
  } else {
    params.append('Body', body);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  return data.sid ? { success: true, sid: data.sid } : { success: false, error: data.message || 'Failed' };
}

// ── WHATSAPP APPROVED TEMPLATE LIST (Twilio Content API) ───────────
async function listWhatsAppTemplates() {
  const sid  = Deno.env.get('TWILIO_SID');
  const auth = Deno.env.get('TWILIO_AUTH');
  if (!sid || !auth) return { templates: [], error: 'Twilio credentials not set' };

  const credentials = btoa(`${sid}:${auth}`);

  // Twilio Content API. Filter to templates that have been approved for WhatsApp.
  const res = await fetch('https://content.twilio.com/v1/Content?PageSize=50', {
    headers: { 'Authorization': `Basic ${credentials}` },
  });
  if (!res.ok) return { templates: [], error: await res.text() };
  const data = await res.json();
  const list = Array.isArray(data?.contents) ? data.contents : [];

  // For each template, fetch its WhatsApp approval status.
  const enriched = await Promise.all(list.map(async (t: any) => {
    let approved = false;
    try {
      const apprRes = await fetch(`https://content.twilio.com/v1/Content/${t.sid}/ApprovalRequests`, {
        headers: { 'Authorization': `Basic ${credentials}` },
      });
      if (apprRes.ok) {
        const apprData = await apprRes.json();
        const wa = apprData?.whatsapp || apprData;
        approved = (wa?.status || '').toLowerCase() === 'approved';
      }
    } catch (_) { /* leave approved=false */ }
    return {
      sid:           t.sid,
      friendly_name: t.friendly_name,
      language:      t.language,
      variables:     t.variables || {},
      types:         Object.keys(t.types || {}),
      body:          previewBody(t),
      approved,
    };
  }));

  return { templates: enriched };
}

function previewBody(t: any) {
  const ty = t.types || {};
  if (ty['twilio/text']?.body)          return ty['twilio/text'].body;
  if (ty['twilio/quick-reply']?.body)   return ty['twilio/quick-reply'].body;
  if (ty['twilio/call-to-action']?.body) return ty['twilio/call-to-action'].body;
  if (ty['twilio/card']?.body)          return ty['twilio/card'].body;
  return '';
}
