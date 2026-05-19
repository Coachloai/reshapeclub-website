const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};
    const action = body.action || 'process_queue';

    if (action === 'send_message') {
      const result = await sendMessage(body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'process_queue') {
      const result = await processQueue();
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── SEND A SINGLE MESSAGE ──
async function sendMessage(body: any) {
  const { channel, to_email, to_phone, subject, html_body, text_body, attachments } = body;

  if (channel === 'email') {
    return await sendEmail(to_email, subject, html_body, attachments);
  } else if (channel === 'sms') {
    return await sendSMS(to_phone, text_body);
  } else if (channel === 'whatsapp') {
    return await sendWhatsApp(to_phone, text_body);
  }
  return { success: false, error: 'Unknown channel: ' + channel };
}

// ── PROCESS QUEUED MESSAGES ──
async function processQueue() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const now = new Date().toISOString();

  // Fetch due messages
  const fetchRes = await fetch(
    `${supabaseUrl}/rest/v1/message_queue?status=in.(queued,sending)&send_at=lte.${now}&order=send_at.asc&limit=20`,
    {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const messages = await fetchRes.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return { processed: 0 };
  }

  let processed = 0;
  for (const msg of messages) {
    let result;
    try {
      if (msg.channel === 'email') {
        result = await sendEmail(msg.lead_email, msg.subject, msg.body);
      } else if (msg.channel === 'sms' && msg.lead_phone) {
        result = await sendSMS(msg.lead_phone, msg.body);
      } else if (msg.channel === 'whatsapp' && msg.lead_phone) {
        result = await sendWhatsApp(msg.lead_phone, msg.body);
      } else {
        result = { success: false, error: 'No phone for ' + msg.channel };
      }
    } catch (e) {
      result = { success: false, error: e.message };
    }

    // Update status
    await fetch(`${supabaseUrl}/rest/v1/message_queue?id=eq.${msg.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        status: result.success ? 'sent' : 'failed',
        sent_at: result.success ? new Date().toISOString() : null,
        error: result.error || null,
        external_id: result.id || result.sid || null,
      }),
    });

    processed++;
  }

  return { processed };
}

// ── EMAIL via Resend ──
async function sendEmail(to: string, subject: string, htmlBody: string, attachments?: any[]) {
  const resendKey = Deno.env.get('RESEND_KEY');
  const fromEmail = Deno.env.get('FROM_EMAIL') || 'coach@reshape.fit';
  const fromName = Deno.env.get('FROM_NAME') || 'Jaime | ReShape';
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

  // Fallback to resend.dev sender if domain issue
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

// ── SMS via Twilio ──
async function sendSMS(to: string, body: string) {
  const sid = Deno.env.get('TWILIO_SID');
  const auth = Deno.env.get('TWILIO_AUTH');
  const phone = Deno.env.get('TWILIO_PHONE');
  const msgSvcSid = Deno.env.get('TWILIO_MESSAGING_SID');

  if (!sid || !auth) return { success: false, error: 'Twilio credentials not set' };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const credentials = btoa(`${sid}:${auth}`);
  const params = new URLSearchParams();

  if (msgSvcSid) {
    params.append('MessagingServiceSid', msgSvcSid);
  } else if (phone) {
    params.append('From', phone);
  }
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

// ── WHATSAPP via Twilio ──
async function sendWhatsApp(to: string, body: string) {
  const sid = Deno.env.get('TWILIO_SID');
  const auth = Deno.env.get('TWILIO_AUTH');
  const phone = Deno.env.get('TWILIO_PHONE');

  if (!sid || !auth || !phone) return { success: false, error: 'Twilio/WhatsApp credentials not set' };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const credentials = btoa(`${sid}:${auth}`);
  const params = new URLSearchParams();
  params.append('From', `whatsapp:${phone}`);
  params.append('To', `whatsapp:${to}`);
  params.append('Body', body);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  return data.sid ? { success: true, sid: data.sid } : { success: false, error: data.message || 'Failed' };
}
