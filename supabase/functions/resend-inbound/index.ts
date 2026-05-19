// ReShape — inbound email webhook (Resend Inbound).
//
// Resend POSTs JSON to this URL whenever an email arrives at an address
// configured under its Inbound feature. We persist into public.inbound_messages
// with channel='email' so the dashboard Inbox shows it alongside SMS/WhatsApp.
//
// Deploy: supabase functions deploy resend-inbound --no-verify-jwt
// Configure: Resend Dashboard → Inbound → Add endpoint → POST →
//   https://lvizldmdficsfpgegehp.supabase.co/functions/v1/resend-inbound
//
// Expected payload (Resend Inbound webhook):
// {
//   "type": "email.received",
//   "data": {
//     "id": "<message-id>",
//     "from": "sender@example.com",
//     "to": ["coach@reshape.fit"],
//     "subject": "...",
//     "text": "plain body",
//     "html": "<p>html body</p>",
//     ...
//   }
// }
//
// Resend's exact field names have shifted across betas, so we tolerate a few
// variants and also support the "compatible-with-SendGrid" form-encoded shape
// (in case the user configured forwarding via SendGrid Inbound Parse instead).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ParsedEmail {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string | null;
  fromName?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const ctype = (req.headers.get('content-type') || '').toLowerCase();
    let parsed: ParsedEmail | null = null;

    if (ctype.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      parsed = parseResendPayload(body);
    } else if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
      // SendGrid Inbound Parse format (fallback)
      const form = await req.formData();
      parsed = parseSendgridPayload(form);
    } else {
      // Best-effort: try JSON anyway
      const text = await req.text();
      try { parsed = parseResendPayload(JSON.parse(text)); } catch { /* ignore */ }
    }

    if (!parsed || !parsed.from || !parsed.messageId) {
      console.warn('resend-inbound: could not parse payload', { ctype });
      return ok();
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      console.error('resend-inbound: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
      return ok();
    }

    const res = await fetch(supabaseUrl.replace(/\/$/, '') + '/rest/v1/inbound_messages?on_conflict=message_sid', {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: 'Bearer ' + serviceKey,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        channel: 'email',
        from_email: parsed.from,
        to_email: parsed.to,
        from_phone: null,
        to_phone: null,
        body: parsed.text || '',
        html_body: parsed.html,
        subject: parsed.subject,
        message_sid: parsed.messageId,
        profile_name: parsed.fromName || null,
        num_media: 0,
        media_urls: [],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('resend-inbound: insert failed', res.status, text.slice(0, 500));
    }
  } catch (e) {
    console.error('resend-inbound: unhandled', (e as Error).message);
  }

  return ok();
});

function parseResendPayload(raw: any): ParsedEmail | null {
  // Resend nests the email under `data`; sometimes flat.
  const d = raw?.data ?? raw;
  if (!d) return null;

  const messageId = String(d.id ?? d.email_id ?? d.message_id ?? '').trim() || crypto.randomUUID();
  const from      = extractAddress(d.from);
  const fromName  = extractName(d.from);
  const to        = Array.isArray(d.to) ? extractAddress(d.to[0]) : extractAddress(d.to);
  const subject   = String(d.subject ?? '').slice(0, 500);
  const text      = String(d.text ?? d.plain ?? '');
  const html      = d.html ? String(d.html) : null;

  if (!from) return null;
  return { messageId, from, to: to || '', subject, text, html, fromName };
}

function parseSendgridPayload(form: FormData): ParsedEmail | null {
  const from = extractAddress(form.get('from'));
  if (!from) return null;
  const to = extractAddress(form.get('to'));
  const subject = String(form.get('subject') || '').slice(0, 500);
  const text = String(form.get('text') || '');
  const html = form.get('html') ? String(form.get('html')) : null;
  // SendGrid uses headers as a blob; the message-id is buried in it.
  const headers = String(form.get('headers') || '');
  const idMatch = headers.match(/Message-ID:\s*<([^>]+)>/i);
  const messageId = (idMatch ? idMatch[1] : '') || crypto.randomUUID();
  const fromName = extractName(form.get('from'));
  return { messageId, from, to: to || '', subject, text, html, fromName };
}

// "John Doe <john@x.com>" → "john@x.com"; "john@x.com" → "john@x.com"
function extractAddress(raw: unknown): string {
  if (raw == null) return '';
  const s = String(raw);
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
}

function extractName(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw);
  const m = s.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : undefined;
}

function ok(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
