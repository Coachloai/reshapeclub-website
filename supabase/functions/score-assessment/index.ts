// score-assessment Edge Function
// Loads all answers for a session, scores them, persists the result, and
// returns the archetype + (Pass 4) personalised readout.
//
// Pass 1: scoring + persistence only. Readout is stubbed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isScoringError, scoreAssessment } from "./scoring.ts";
import { buildReadout } from "./readout.ts";

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

// Replace template variables in a step body / subject.
function replaceVars(text: string | null, lead: { first_name?: string | null; email?: string | null; phone?: string | null }): string {
  if (!text) return "";
  return text
    .replace(/\{first_name\}/g, lead.first_name || "")
    .replace(/\{email\}/g, lead.email || "")
    .replace(/\{phone\}/g, lead.phone || "");
}

// Wrap a plain-text body in the existing branded email shell.
function wrapEmailBody(subject: string, body: string): string {
  let html = body.replace(/\\n/g, "\n");
  if (!html.includes("<")) {
    html = "<p>" + html.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>") + "</p>";
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>` +
    `<body style="margin:0;padding:0;background:#0B0B0B;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">` +
    `<div style="max-width:560px;margin:0 auto;padding:40px 24px">` +
    `<div style="text-align:center;margin-bottom:32px"><span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px">Re<span style="color:#ED5C25">Shape</span></span></div>` +
    `<div style="background:#111213;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 28px">` +
    `<h1 style="font-size:22px;font-weight:800;color:#fff;margin:0 0 16px;line-height:1.3">${subject}</h1>` +
    `<div style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7">${html}</div>` +
    `</div>` +
    `<div style="text-align:center;margin-top:24px;font-size:12px;color:rgba(255,255,255,0.3)">ReShape Body Transformation &middot; Ipswich &amp; Colchester</div>` +
    `</div></body></html>`;
}

// Fire a nurture sequence by trigger_type for the given lead.
// Mirrors queueSequence() in /api/automations.js but runs server-side.
// deno-lint-ignore no-explicit-any
async function fireSequence(supabase: any, trigger_type: string, lead_id: string) {
  const { data: lead } = await supabase
    .from("leads")
    .select("id, first_name, last_name, email, phone")
    .eq("id", lead_id)
    .maybeSingle();
  if (!lead || !lead.email) return;

  const { data: seqs } = await supabase
    .from("automation_sequences")
    .select("id, name")
    .eq("trigger_type", trigger_type)
    .eq("is_active", true)
    .limit(1);
  const seq = (seqs || [])[0];
  if (!seq) return; // no sequence configured yet — silent skip

  const { data: steps } = await supabase
    .from("automation_steps")
    .select("step_order, channel, subject, body, delay_seconds, is_active")
    .eq("sequence_id", seq.id)
    .eq("is_active", true)
    .order("step_order", { ascending: true });
  if (!steps || steps.length === 0) return;

  // Cancel any previously queued messages for this lead + sequence.
  await supabase
    .from("message_queue")
    .update({ status: "cancelled" })
    .eq("lead_email", lead.email)
    .eq("sequence", trigger_type)
    .eq("status", "queued");

  const now = Date.now();
  // deno-lint-ignore no-explicit-any
  const messages = steps.map((step: any, i: number) => {
    const send_at = new Date(now + (step.delay_seconds || 0) * 1000).toISOString();
    const subject = replaceVars(step.subject, lead);
    const body = step.channel === "email"
      ? wrapEmailBody(subject || "ReShape", replaceVars(step.body, lead))
      : replaceVars(step.body, lead);
    return {
      lead_email: lead.email,
      lead_phone: lead.phone || null,
      lead_name: ((lead.first_name || "") + " " + (lead.last_name || "")).trim(),
      sequence: trigger_type,
      step_index: i,
      channel: step.channel,
      subject,
      body,
      send_at,
      status: "queued",
    };
  });

  await supabase.from("message_queue").insert(messages);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase    = createClient(supabaseUrl, serviceKey);

    const ip = clientIp(req);

    // 5 score requests per IP per hour. (Per Section 6 of the build spec.)
    const { data: rateOk } = await supabase.rpc("check_rate_limit", {
      p_ip: ip,
      p_bucket: "score_assessment",
      p_limit: 5,
      p_window_seconds: 3600,
    });
    if (rateOk === false) {
      return jsonResponse({ error: "rate_limited" }, 429);
    }

    let body: { session_id?: string } = {};
    try { body = await req.json(); } catch (_e) { /* empty body */ }
    const session_id = body.session_id;
    if (!session_id) return jsonResponse({ error: "session_id required" }, 400);

    const { data: assessment, error: aErr } = await supabase
      .from("assessments")
      .select("session_id, completed_at, lead_id, primary_archetype, secondary_archetype, hormone_scores, cluster_scores, flags, readout")
      .eq("session_id", session_id)
      .maybeSingle();
    if (aErr)        return jsonResponse({ error: aErr.message }, 500);
    if (!assessment) return jsonResponse({ error: "session not found" }, 404);

    // Idempotency: if already scored, return the stored result without
    // re-firing the nurture sequence.
    if (assessment.completed_at && assessment.primary_archetype) {
      return jsonResponse({
        ok: true,
        primary_archetype:   assessment.primary_archetype,
        secondary_archetype: assessment.secondary_archetype,
        hormone_scores:      assessment.hormone_scores,
        cluster_scores:      assessment.cluster_scores,
        flags:               assessment.flags,
        readout:             assessment.readout || { stub: true },
      });
    }

    const { data: answerRows, error: ansErr } = await supabase
      .from("assessment_answers")
      .select("question_id, answer_value")
      .eq("session_id", session_id);
    if (ansErr) return jsonResponse({ error: ansErr.message }, 500);

    const answers: Record<string, string> = {};
    for (const a of answerRows || []) answers[a.question_id] = a.answer_value;

    const result = scoreAssessment(answers);
    if (isScoringError(result)) {
      return jsonResponse(result, 400);
    }

    const readout = buildReadout(result, answers);

    const { error: updErr } = await supabase
      .from("assessments")
      .update({
        primary_archetype:   result.primary_archetype,
        secondary_archetype: result.secondary_archetype,
        hormone_scores:      result.hormone_scores,
        cluster_scores:      result.cluster_scores,
        flags:               result.flags,
        readout:             readout,
        completed_at:        new Date().toISOString(),
      })
      .eq("session_id", session_id);
    if (updErr) return jsonResponse({ error: updErr.message }, 500);

    // Cancel the abandonment reminder — they finished.
    await supabase
      .from("message_queue")
      .update({ status: "cancelled" })
      .eq("sequence", "hormonal_assessment_reminder")
      .eq("status", "queued")
      .ilike("body", `%${session_id}%`);

    // Fire the post-quiz nurture sequence keyed to the archetype.
    const TRIGGER_MAP: Record<string, string> = {
      stress_driven_plateau: "hormonal_stress_driven",
      hormonal_shift:        "hormonal_shift_pattern",
      metabolic_resistance:  "hormonal_metabolic",
      compound_pattern:      "hormonal_compound",
    };
    if (assessment.lead_id) {
      await fireSequence(supabase, TRIGGER_MAP[result.primary_archetype], assessment.lead_id);
    }

    return jsonResponse({
      ok: true,
      primary_archetype:   result.primary_archetype,
      secondary_archetype: result.secondary_archetype,
      hormone_scores:      result.hormone_scores,
      cluster_scores:      result.cluster_scores,
      flags:               result.flags,
      readout:             readout,
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
