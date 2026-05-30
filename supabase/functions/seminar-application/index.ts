// seminar-application Edge Function
// Receives one POST per applicant from /seminar-application/, writes a row
// into the existing `leads` table with form_name = 'Seminar Application'.
// The dashboard's Website filter then surfaces these alongside other leads.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

const LIFE_STAGE_LABEL: Record<string, string> = {
  "20s":            "In her 20s",
  "30s":            "In her 30s",
  "40s":            "In her 40s",
  "50s":            "In her 50s",
  "perimenopausal": "Perimenopausal",
  "menopausal":     "Menopausal / post-menopausal",
};

const LIFE_STAGE_AGE: Record<string, number> = {
  "20s": 25, "30s": 35, "40s": 45, "50s": 55,
  "perimenopausal": 45, "menopausal": 55,
};

const STRUGGLE_LABEL: Record<string, string> = {
  weight_body: "Weight & body composition",
  energy:      "Low energy / fatigue",
  sleep:       "Sleep",
  mood:        "Mood, stress, or overwhelm",
  hormonal:    "Hormonal symptoms",
  other:       "Something else",
};

function buildBigGoal(p: {
  life_stage?: string;
  top_struggle?: string;
  tried?: string;
  wants?: string;
  extra?: string;
}): string {
  const parts: string[] = [];
  if (p.life_stage)   parts.push(`Life stage: ${LIFE_STAGE_LABEL[p.life_stage] || p.life_stage}`);
  if (p.top_struggle) parts.push(`Top struggle: ${STRUGGLE_LABEL[p.top_struggle] || p.top_struggle}`);
  if (p.wants)        parts.push(`Wants from seminar: ${p.wants}`);
  if (p.tried)        parts.push(`Already tried: ${p.tried}`);
  if (p.extra)        parts.push(`Notes: ${p.extra}`);
  return parts.join("\n\n");
}

// ── Email templates (terracotta + charcoal, matches site brand) ──
const ICS_URL = "https://reshapeclub.com/seminar-application/reshape-seminar-jun-5.ics";
const GCAL_URL = "https://www.google.com/calendar/render?action=TEMPLATE&text=ReShape%20Seminar&dates=20260605T174500Z/20260605T191500Z&details=Your%20seat%20at%20the%20ReShape%20seminar%20with%20Coach%20Loai.&location=ReShape%20Colchester";

function emailShell(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#5A5550;line-height:1.6">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:32px 0">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E5DFD5;border-radius:12px;max-width:560px">
      <tr><td style="padding:32px 36px">
        <div style="font-family:Georgia,serif;font-size:22px;font-weight:500;color:#2A2724;letter-spacing:-0.01em;margin-bottom:24px">ReShape</div>
        ${bodyHtml}
      </td></tr>
    </table>
    <div style="font-size:12px;color:#B8B2A8;padding:20px 16px 0;max-width:520px">ReShape · Ipswich · Colchester · <a href="mailto:coach@reshape.fit" style="color:#B8B2A8">coach@reshape.fit</a></div>
  </td></tr>
</table></body></html>`;
}

function confirmationEmail(name: string): string {
  return emailShell(`
    <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;color:#2A2724;line-height:1.2;margin:0 0 16px">Your seat is booked, ${name}.</h1>
    <p style="font-size:16px;margin:0 0 16px">See you on <strong style="color:#2A2724">Friday 5 June 2026 at 6:45pm</strong>, at <strong style="color:#2A2724">ReShape Colchester</strong>.</p>

    <table cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr>
      <td style="padding-right:8px"><a href="${ICS_URL}" style="display:inline-block;background:#2A2724;color:#FAF7F2;padding:12px 22px;border-radius:999px;font-weight:500;text-decoration:none;font-size:14px">Add to calendar</a></td>
      <td><a href="${GCAL_URL}" style="display:inline-block;background:#fff;color:#2A2724;padding:11px 21px;border-radius:999px;font-weight:500;text-decoration:none;font-size:14px;border:1.5px solid #E5DFD5">Google Calendar</a></td>
    </tr></table>

    <div style="background:#FFF0E5;border:1px dashed #ED5C25;border-radius:10px;padding:18px 20px;margin:0 0 24px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#ED5C25;font-weight:600;margin-bottom:6px">Your seminar bonus</div>
      <div style="font-family:Georgia,serif;font-size:18px;color:#2A2724;margin-bottom:6px">Free metabolic &amp; body composition assessment</div>
      <div style="font-size:14px;color:#2A2724;opacity:.85">Show up on the night and claim a complimentary in-studio metabolic and body composition assessment — your real numbers, mapped against your goals, no charge.</div>
    </div>

    <p style="font-size:15px;margin:0 0 8px"><strong style="color:#2A2724">What to expect</strong></p>
    <p style="font-size:15px;margin:0 0 16px">An hour or so on the hormonal patterns behind plateaus, then Q&amp;A — Coach Loai will have read your application before the night, so the talk is shaped around the room.</p>

    <p style="font-size:14px;color:#B8B2A8;margin:24px 0 0">Need to change anything? Just reply to this email.</p>
  `);
}

function reminderEmail(name: string): string {
  return emailShell(`
    <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;color:#2A2724;line-height:1.2;margin:0 0 16px">Tomorrow at 6:45pm.</h1>
    <p style="font-size:16px;margin:0 0 16px">${name}, just a quick reminder — the ReShape seminar is <strong style="color:#2A2724">tomorrow, 5 June, at 6:45pm</strong> at <strong style="color:#2A2724">ReShape Colchester</strong>.</p>

    <p style="font-size:15px;margin:0 0 24px">Doors open 15 minutes before. Bring yourself, bring questions — that's it.</p>

    <div style="background:#FFF0E5;border:1px dashed #ED5C25;border-radius:10px;padding:16px 20px;margin:0 0 24px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#ED5C25;font-weight:600;margin-bottom:4px">Don't forget</div>
      <div style="font-size:14px;color:#2A2724">Your free metabolic &amp; body composition assessment is yours to claim on arrival — just ask any coach on the night.</div>
    </div>

    <p style="font-size:14px;color:#B8B2A8;margin:0">Can't make it after all? Reply to this email and we'll free your seat for someone on the waitlist.</p>
  `);
}

const SEMINAR_REMINDER_AT = "2026-06-04T10:00:00Z";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase    = createClient(supabaseUrl, serviceKey);

    const ip = clientIp(req);

    // 10 applications per IP per hour. Reuses the existing rate-limit RPC.
    const { data: rateOk } = await supabase.rpc("check_rate_limit", {
      p_ip: ip,
      p_bucket: "seminar_application",
      p_limit: 10,
      p_window_seconds: 3600,
    });
    if (rateOk === false) return jsonResponse({ error: "rate_limited" }, 429);

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch (_e) { /* empty */ }

    const first_name = String(body.first_name || "").trim();
    const last_name  = String(body.last_name  || "").trim();
    const email      = String(body.email      || "").trim().toLowerCase();
    const phoneRaw   = String(body.phone      || "").trim();
    const phone      = phoneRaw ? phoneRaw.replace(/\s+/g, "") : null;
    const consent    = body.consent_marketing === true;

    const life_stage   = String(body.life_stage   || "").trim();
    const top_struggle = String(body.top_struggle || "").trim();
    const tried        = String(body.tried        || "").trim();
    const wants        = String(body.wants        || "").trim();
    const extra        = String(body.extra        || "").trim();

    if (!first_name) return jsonResponse({ error: "first_name required" }, 400);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "invalid email" }, 400);
    }
    if (!life_stage)   return jsonResponse({ error: "life_stage required" }, 400);
    if (!top_struggle) return jsonResponse({ error: "top_struggle required" }, 400);
    if (!consent)      return jsonResponse({ error: "consent required" }, 400);

    const big_goal = buildBigGoal({ life_stage, top_struggle, tried, wants, extra });

    const { data: inserted, error } = await supabase
      .from("leads")
      .insert({
        form_name:    "Seminar Application",
        first_name,
        last_name:    last_name || "-",
        email,
        phone,
        age:          LIFE_STAGE_AGE[life_stage] || null,
        gender:       "Female",
        location:     "Colchester",
        looking_for:  LIFE_STAGE_LABEL[life_stage] || life_stage,
        reason:       STRUGGLE_LABEL[top_struggle] || top_struggle,
        big_goal,
        referral:     ["Seminar Application Form"],
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return jsonResponse({ error: error?.message || "insert failed" }, 500);
    }

    // Queue the confirmation (immediate) and reminder (day before) emails.
    // process-queue picks these up on its cron and sends via Resend.
    const nowIso = new Date().toISOString();
    await supabase.from("message_queue").insert([
      {
        lead_email: email,
        lead_name:  first_name,
        sequence:   "seminar_confirmation",
        step_index: 0,
        channel:    "email",
        subject:    "You're in — see you at the ReShape seminar, 5 June",
        body:       confirmationEmail(first_name),
        send_at:    nowIso,
        status:     "queued",
      },
      {
        lead_email: email,
        lead_name:  first_name,
        sequence:   "seminar_reminder",
        step_index: 1,
        channel:    "email",
        subject:    "Tomorrow at 6:45pm — your ReShape seminar seat",
        body:       reminderEmail(first_name),
        send_at:    SEMINAR_REMINDER_AT,
        status:     "queued",
      },
    ]);

    return jsonResponse({ ok: true, lead_id: inserted.id });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message || "server error" }, 500);
  }
});
