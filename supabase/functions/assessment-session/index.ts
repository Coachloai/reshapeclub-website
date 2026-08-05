// assessment-session Edge Function
// Three actions:
//   start          → create a session row, return session_id
//   capture_email  → upsert lead, link to session, queue abandonment reminder
//   submit_answer  → upsert one answer, return progress %
//
// Anon clients call this; service role is used internally.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WEIGHTS } from "../score-assessment/scoring.ts";

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

function ipCountry(req: Request): string | null {
  // Cloudflare adds cf-ipcountry; many CDNs add x-vercel-ip-country.
  return (
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-country-code") ||
    null
  );
}

const TOTAL_QUESTIONS_WOMEN = 14;
const TOTAL_QUESTIONS_MEN = 12;

// Normalise UK phone numbers to E.164 (+44...) so downstream WhatsApp/SMS
// always receives a valid international format regardless of how the user
// entered it. Defaults to UK because the funnel targets UK only.
//
//   "07700 900123"   → "+447700900123"
//   "7700900123"     → "+447700900123"
//   "447700900123"   → "+447700900123"
//   "00447700900123" → "+447700900123"
//   "+447700900123"  → "+447700900123" (unchanged)
//   ""               → ""              (unchanged)
function toE164UK(input: string): string {
  if (!input) return input;
  const digits = input.replace(/\D/g, "");
  if (input.startsWith("+")) return "+" + digits;
  if (digits.startsWith("00")) return "+" + digits.slice(2);
  if (digits.startsWith("44")) return "+" + digits;
  if (digits.startsWith("0")) return "+44" + digits.slice(1);
  // 10-digit number with no country/trunk prefix — assume UK mobile/landline.
  if (digits.length === 10) return "+44" + digits;
  return input;
}

const REMINDER_BODY = (siteUrl: string, sessionId: string, name: string) =>
  `<p>Hi ${name || "there"},</p>
   <p>You started your ReShape hormonal pattern assessment but didn't quite finish. Your answers are saved — we just need the last few to send you your full pattern report.</p>
   <p><a href="${siteUrl}/hormonal-assessment/?resume=${sessionId}" style="display:inline-block;background:#ED5C25;color:#fff;padding:14px 28px;border-radius:12px;font-weight:700;text-decoration:none">Finish My Assessment</a></p>
   <p style="color:#999;font-size:13px;margin-top:24px">session: ${sessionId}</p>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const siteUrl     = Deno.env.get("SITE_URL") || "https://reshape.fit";
    const supabase    = createClient(supabaseUrl, serviceKey);

    const ip = clientIp(req);

    // 30 requests per IP per hour across all assessment-session actions.
    const { data: rateOk } = await supabase.rpc("check_rate_limit", {
      p_ip: ip,
      p_bucket: "assessment_session",
      p_limit: 30,
      p_window_seconds: 3600,
    });
    if (rateOk === false) return jsonResponse({ error: "rate_limited" }, 429);

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch (_e) { /* empty */ }
    const action = body.action as string | undefined;

    // ── start ──
    if (action === "start") {
      const ua = req.headers.get("user-agent") || null;
      const country = ipCountry(req);

      const session_id = crypto.randomUUID();
      const { error } = await supabase.from("assessments").insert({
        session_id,
        utm_source:    (body.utm_source as string) || null,
        utm_campaign:  (body.utm_campaign as string) || null,
        user_agent:    ua,
        ip_country:    country,
      });
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ session_id });
    }

    // ── capture_email ──
    if (action === "capture_email") {
      const session_id = body.session_id as string | undefined;
      const name       = ((body.name as string) || "").trim();
      const email      = ((body.email as string) || "").trim().toLowerCase();
      const phoneRaw   = ((body.phone as string) || "").trim();
      // Strip whitespace/dashes/parens; accept +intl, UK 0-prefixed, or 44-prefixed.
      const phoneCleanedRaw = phoneRaw.replace(/[\s\-()]/g, "");
      const phoneOk = !phoneCleanedRaw ||
        /^(\+\d{10,15}|0[1-9]\d{8,10}|44\d{10,11})$/.test(phoneCleanedRaw);
      // Normalise to E.164 (+44...) so downstream messaging tooling always
      // receives a sendable international format.
      const phoneCleaned = toE164UK(phoneCleanedRaw);
      // Age: optional but validated when provided. 18–99 prevents kids and
      // typos like 999. Captured at gate so it lands on the lead row from
      // the start (not only after quiz completion).
      const ageRaw = body.age;
      const age = ageRaw != null && ageRaw !== "" ? Number(ageRaw) : null;
      const ageOk = age == null || (Number.isFinite(age) && age >= 18 && age <= 99);
      if (!session_id || !email) {
        return jsonResponse({ error: "session_id and email required" }, 400);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse({ error: "invalid email" }, 400);
      }
      if (!phoneOk) {
        return jsonResponse({ error: "invalid phone" }, 400);
      }
      if (!ageOk) {
        return jsonResponse({ error: "invalid age" }, 400);
      }

      // Upsert into leads. The existing leads table has first_name + last_name
      // NOT NULL, so we always preserve richer data and only fill blanks.
      const { data: existing } = await supabase
        .from("leads")
        .select("id, first_name, last_name, phone, gender")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const inferredGender = (body.funnel === "mens") ? "Male" : "Female";
      let lead_id: string;
      if (existing) {
        lead_id = existing.id;
        const patch: Record<string, string | number> = {};
        if (!existing.first_name && name) patch.first_name = name;
        if (!existing.phone && phoneCleaned) patch.phone = phoneCleaned;
        if (!existing.gender) patch.gender = inferredGender;
        if (age != null) patch.age = age;
        if (Object.keys(patch).length) {
          await supabase.from("leads").update(patch).eq("id", lead_id);
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("leads")
          .insert({
            form_name:  (body.funnel === "mens") ? "Men's Performance Assessment" : "Hormonal Assessment",
            gender:     (body.funnel === "mens") ? "Male" : "Female",
            first_name: name || "Friend",
            last_name:  "-",
            email,
            phone:      phoneCleaned || null,
            age:        age,
          })
          .select("id")
          .single();
        if (error || !inserted) return jsonResponse({ error: error?.message || "lead insert failed" }, 500);
        lead_id = inserted.id;
      }

      const captured_at = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("assessments")
        .update({ lead_id, email_captured_at: captured_at })
        .eq("session_id", session_id);
      if (updErr) return jsonResponse({ error: updErr.message }, 500);

      // Cancel any prior reminder for this session, then queue a fresh one
      // that fires in 1 hour if the assessment is still incomplete.
      await supabase
        .from("message_queue")
        .update({ status: "cancelled" })
        .eq("sequence", "hormonal_assessment_reminder")
        .eq("status", "queued")
        .ilike("body", `%${session_id}%`);

      const sendAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await supabase.from("message_queue").insert({
        lead_email: email,
        lead_name:  name || "Friend",
        sequence:   "hormonal_assessment_reminder",
        step_index: 0,
        channel:    "email",
        subject:    "Finish your ReShape pattern report",
        body:       REMINDER_BODY(siteUrl, session_id, name),
        send_at:    sendAt,
        status:     "queued",
      });

      return jsonResponse({ ok: true, lead_id });
    }

    // ── submit_answer ──
    if (action === "submit_answer") {
      const session_id   = body.session_id as string | undefined;
      const question_id  = body.question_id as string | undefined;
      const answer_value = body.answer_value as string | undefined;
      if (!session_id || !question_id || answer_value === undefined) {
        return jsonResponse({ error: "session_id, question_id, answer_value required" }, 400);
      }

      // Validate against the canonical weight table — never trust the client.
      if (!(question_id in WEIGHTS)) {
        return jsonResponse({ error: `unknown question ${question_id}` }, 400);
      }
      const multiSelectQ = question_id === "Q13" || question_id === "MQ11";
      if (multiSelectQ) {
        const keys = answer_value.split(",").map((s) => s.trim()).filter(Boolean);
        for (const k of keys) {
          if (!(k in WEIGHTS[question_id])) {
            return jsonResponse({ error: `${question_id} unknown answer ${k}` }, 400);
          }
        }
      } else if (!(answer_value in WEIGHTS[question_id])) {
        return jsonResponse({ error: `${question_id} unknown answer ${answer_value}` }, 400);
      }

      // Confirm session exists before writing an answer.
      const { data: sess } = await supabase
        .from("assessments")
        .select("session_id")
        .eq("session_id", session_id)
        .maybeSingle();
      if (!sess) return jsonResponse({ error: "session not found" }, 404);

      const { error: upErr } = await supabase
        .from("assessment_answers")
        .upsert({
          session_id,
          question_id,
          answer_value,
          answered_at: new Date().toISOString(),
        }, { onConflict: "session_id,question_id" });
      if (upErr) return jsonResponse({ error: upErr.message }, 500);

      const { count } = await supabase
        .from("assessment_answers")
        .select("question_id", { count: "exact", head: true })
        .eq("session_id", session_id);

      const isMens = question_id.startsWith("MQ");
      const totalQ = isMens ? TOTAL_QUESTIONS_MEN : TOTAL_QUESTIONS_WOMEN;
      const progress_pct = Math.round(((count || 0) / totalQ) * 100);
      return jsonResponse({ ok: true, progress_pct });
    }

    return jsonResponse({ error: `unknown action ${action || ""}` }, 400);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
