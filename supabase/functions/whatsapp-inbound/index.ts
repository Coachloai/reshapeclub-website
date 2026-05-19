// ReShape — inbound SMS/WhatsApp webhook.
//
// Twilio POSTs application/x-www-form-urlencoded to this URL whenever a
// recipient replies to one of our outbound messages. We write the inbound
// into public.inbound_messages and respond with empty TwiML so Twilio
// doesn't send anything back to the user.
//
// Deploy with: supabase functions deploy whatsapp-inbound --no-verify-jwt
//   (Twilio's webhook can't carry our anon-key Authorization header.)
//
// Configure in Twilio: Phone Numbers → your WhatsApp/SMS number →
// "A message comes in" → Webhook → POST →
//   https://lvizldmdficsfpgegehp.supabase.co/functions/v1/whatsapp-inbound

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const ctype = (req.headers.get('content-type') || '').toLowerCase();
    let params: URLSearchParams;
    if (ctype.includes('application/x-www-form-urlencoded')) {
      params = new URLSearchParams(await req.text());
    } else if (ctype.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      params = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) params.set(k, String(v));
    } else {
      params = new URLSearchParams(await req.text());
    }

    const fromRaw = params.get('From') || '';      // e.g. 'whatsapp:+447...' or '+447...'
    const toRaw   = params.get('To')   || '';
    const body    = params.get('Body') || '';
    const sid     = params.get('MessageSid') || params.get('SmsSid') || '';
    const profile = params.get('ProfileName') || null;
    const numMediaStr = params.get('NumMedia') || '0';
    const numMedia = Math.max(0, parseInt(numMediaStr, 10) || 0);

    const channel = fromRaw.startsWith('whatsapp:') ? 'whatsapp' : 'sms';
    const fromPhone = stripPrefix(fromRaw);
    const toPhone   = stripPrefix(toRaw);

    const mediaUrls: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const u = params.get('MediaUrl' + i);
      if (u) mediaUrls.push(u);
    }

    if (!fromPhone || !sid) {
      console.warn('inbound: missing From or MessageSid', { fromRaw, sid });
      return twiml();
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      console.error('inbound: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
      return twiml();
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
        channel,
        from_phone: fromPhone,
        to_phone: toPhone,
        body,
        message_sid: sid,
        profile_name: profile,
        num_media: numMedia,
        media_urls: mediaUrls,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('inbound: insert failed', res.status, text.slice(0, 500));
    }
  } catch (e) {
    console.error('inbound: unhandled', (e as Error).message);
  }

  return twiml();
});

function stripPrefix(s: string): string {
  return s.replace(/^whatsapp:/i, '').trim();
}

function twiml(): Response {
  return new Response(TWIML_OK, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
  });
}
