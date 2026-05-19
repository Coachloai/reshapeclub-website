// Public endpoint for the per-channel unsubscribe / re-subscribe page.
//
// GET  ?token=xxx                          → returns lead's consent state
// POST { token, channel, action }          → 'unsubscribe' | 'resubscribe'
//
// channel ∈ 'email' | 'sms' | 'whatsapp'
// action  ∈ 'unsubscribe' | 'resubscribe'
//
// Writes a row into consent_audit_log for every change.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CHANNELS = ['email', 'sms', 'whatsapp'] as const;
type Channel = typeof CHANNELS[number];
const CHANNEL_COL: Record<Channel, string> = {
  email:    'email_consent',
  sms:      'sms_consent',
  whatsapp: 'wa_consent',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);

    if (req.method === 'GET') {
      const token = url.searchParams.get('token');
      if (!token) return json({ error: 'token required' }, 400);
      const lead = await fetchLead(token);
      if (!lead) return json({ error: 'not found' }, 404);
      return json({ lead: publicLead(lead) });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const { token, channel, action } = body || {};
      if (!token)                              return json({ error: 'token required' }, 400);
      if (!CHANNELS.includes(channel))         return json({ error: 'invalid channel' }, 400);
      if (action !== 'unsubscribe' && action !== 'resubscribe')
        return json({ error: 'invalid action' }, 400);

      const lead = await fetchLead(token);
      if (!lead) return json({ error: 'not found' }, 404);

      const col       = CHANNEL_COL[channel as Channel];
      const newStatus = action === 'unsubscribe' ? 'opted_out' : 'opted_in';
      const auditAct  = action === 'unsubscribe' ? 'revoked' : 'granted';

      const patch: Record<string, unknown> = {};
      patch[`${col}_status`] = newStatus;
      patch[`${col}_at`]     = new Date().toISOString();
      patch[`${col}_source`] = action === 'unsubscribe' ? 'self_unsubscribe' : 'self_resubscribe';

      const updRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${lead.id}`, {
        method:  'PATCH',
        headers: srHeaders(),
        body:    JSON.stringify(patch),
      });
      if (!updRes.ok) return json({ error: 'update failed: ' + await updRes.text() }, 500);

      await fetch(`${SUPABASE_URL}/rest/v1/consent_audit_log`, {
        method:  'POST',
        headers: srHeaders(),
        body: JSON.stringify({
          lead_id:    lead.id,
          channel,
          action:     auditAct,
          source:     'public_unsubscribe_page',
          ip:         req.headers.get('x-forwarded-for') || null,
          user_agent: req.headers.get('user-agent') || null,
        }),
      });

      const updated = await fetchLead(token);
      return json({ ok: true, lead: publicLead(updated) });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function srHeaders() {
  return {
    'apikey':        SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=minimal',
  };
}

async function fetchLead(token: string) {
  const safe = encodeURIComponent(token);
  const res  = await fetch(
    `${SUPABASE_URL}/rest/v1/leads?consent_token=eq.${safe}&select=id,first_name,last_name,email,phone,email_consent_status,sms_consent_status,wa_consent_status&limit=1`,
    { headers: srHeaders() }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function publicLead(l: any) {
  return {
    first_name: l.first_name,
    last_name:  l.last_name,
    email:      l.email,
    phone:      l.phone,
    email_consent_status: l.email_consent_status,
    sms_consent_status:   l.sms_consent_status,
    wa_consent_status:    l.wa_consent_status,
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
