// email-inbound Edge Function
//
// Resend posts here on every `email.received` event (replies to nurture
// emails sent FROM reshape.fit). The webhook payload only contains
// metadata, so we fetch the full email via the Resend API and persist
// it into inbound_messages — same table the dashboard Inbox reads from.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, svix-signature, svix-timestamp, svix-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function textResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")     return textResponse("method not allowed", 405);

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try { payload = await req.json(); } catch { return textResponse("invalid json", 400); }

  if (payload?.type !== "email.received") {
    // Quietly accept other event types so Resend doesn't retry.
    return textResponse("ignored: " + (payload?.type || "unknown"));
  }

  const emailId: string | undefined = payload?.data?.email_id;
  if (!emailId) return textResponse("no email_id", 400);

  const resendKey = Deno.env.get("RESEND_KEY");
  if (!resendKey) return textResponse("RESEND_KEY missing", 500);

  // Pull the full email content from Resend.
  const fetchRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${resendKey}` },
  });
  if (!fetchRes.ok) {
    const errBody = await fetchRes.text();
    console.error("Resend retrieve failed", fetchRes.status, errBody);
    return textResponse("resend retrieve failed: " + fetchRes.status, 500);
  }
  // deno-lint-ignore no-explicit-any
  const email: any = await fetchRes.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Idempotency — skip if we've already persisted this email_id.
  const { data: existing } = await supabase
    .from("inbound_messages")
    .select("id")
    .eq("message_sid", emailId)
    .maybeSingle();
  if (existing) return textResponse("ok (already stored)");

  const fromEmail = String(email.from || "").trim().toLowerCase();
  const toEmail   = Array.isArray(email.to) ? (email.to[0] || "") : String(email.to || "");
  const subject   = String(email.subject || "");
  const text      = String(email.text || "");
  const html      = String(email.html || "");
  // Prefer plain text. Fall back to a stripped HTML version for the snippet.
  const body = text || html.replace(/<style[\s\S]*?<\/style>/gi, "")
                            .replace(/<script[\s\S]*?<\/script>/gi, "")
                            .replace(/<[^>]+>/g, "")
                            .replace(/&nbsp;/g, " ")
                            .replace(/\s+\n/g, "\n")
                            .trim();
  const numAttach = Array.isArray(email.attachments) ? email.attachments.length : 0;

  const { error: insErr } = await supabase.from("inbound_messages").insert({
    channel:      "email",
    from_email:   fromEmail || null,
    to_email:     toEmail || null,
    subject:      subject || null,
    body:         body.slice(0, 8000),
    html_body:    html ? html.slice(0, 80000) : null,
    message_sid:  emailId,             // reuse this column as the dedupe key
    num_media:    numAttach,
    raw_payload:  email,
  });

  if (insErr) {
    console.error("inbound_messages insert failed:", insErr.message);
    return textResponse("db insert failed: " + insErr.message, 500);
  }

  return textResponse("ok");
});
