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
  "perimenopausal": "Perimenopausal",
  "menopausal":     "Menopausal / post-menopausal",
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

    return jsonResponse({ ok: true, lead_id: inserted.id });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message || "server error" }, 500);
  }
});
